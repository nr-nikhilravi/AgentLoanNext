import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Loader2,
  Sparkles,
  X,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Volume2,
} from "lucide-react";
import { api, navigate } from "./api.js";

/**
 * VoiceCopilot — global mic button for the RM cockpit.
 *
 * Flow:
 *   1. Click → MediaRecorder starts capturing the default mic.
 *   2. Click again (or auto-stop after 12s) → POST audio to /api/voice/command.
 *   3. Backend transcribes via Cloud STT, parses intent via Gemini.
 *   4. Show a confirmation card with the parsed intent + a single-tap action.
 *
 * The component is RM-only — App.jsx mounts it inside the Shell when role==="rm".
 */
export default function VoiceCopilot({ researchedSet, onResearched }) {
  const [phase, setPhase] = useState("idle");   // idle | recording | uploading | result | error
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const tickRef = useRef(null);
  const streamRef = useRef(null);
  const autoStopRef = useRef(null);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    if (tickRef.current) clearInterval(tickRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function start() {
    setError("");
    setResult(null);
    setSeconds(0);
    chunksRef.current = [];
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone is not available in this browser.");
      setPhase("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      const mime = mimeCandidates.find(
        (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
      ) || "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => finishUpload(rec.mimeType || mime || "audio/webm");
      rec.start();
      recorderRef.current = rec;
      setPhase("recording");
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      autoStopRef.current = setTimeout(stop, 12_000);
    } catch (e) {
      setError(
        e?.name === "NotAllowedError"
          ? "Microphone permission denied — please enable it in your browser."
          : `Could not start the microphone: ${e.message || e}`,
      );
      setPhase("error");
    }
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (tickRef.current) clearInterval(tickRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
  }

  async function finishUpload(mime) {
    cleanup();
    if (chunksRef.current.length === 0) {
      setPhase("idle");
      return;
    }
    setPhase("uploading");
    const blob = new Blob(chunksRef.current, { type: mime });
    try {
      const data = await api.voiceCommand(blob, mime, researchedSet);
      setResult(data);
      if (!data.action.blocked) {
        if (data.intent === "RESEARCH_COMPANY" && data.target_company_id) {
          onResearched?.(data.target_company_id);
        }
        if (data.action.navigate_to) {
          navigate(data.action.navigate_to);
        }
        dismiss();
      } else {
        setPhase("result");
      }
    } catch (e) {
      setError(e.message || "Voice command failed");
      setPhase("error");
    }
  }

  function dismiss() {
    setPhase("idle");
    setResult(null);
    setError("");
    setSeconds(0);
  }

  function executeAction() {
    if (!result || result.action.blocked) return;
    if (result.intent === "RESEARCH_COMPANY" && result.target_company_id) {
      onResearched?.(result.target_company_id);
    }
    if (result.action.navigate_to) {
      navigate(result.action.navigate_to);
    }
    dismiss();
  }

  return (
    <>
      <button
        onClick={phase === "recording" ? stop : start}
        disabled={phase === "uploading"}
        title={phase === "recording" ? "Stop recording" : "Voice Copilot — say a command"}
        className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
          phase === "recording"
            ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
            : phase === "uploading"
            ? "bg-warm-200 text-warm-500 cursor-wait"
            : "bg-electric-500 hover:bg-electric-600 text-white shadow-md shadow-electric-500/30"
        }`}
      >
        {phase === "recording" ? (
          <>
            <span className="absolute -left-1 -top-1 w-3 h-3 rounded-full bg-rose-300 animate-ping" />
            <MicOff className="w-3.5 h-3.5" />
            <span className="font-mono">{`0:${String(seconds).padStart(2, "0")}`}</span>
          </>
        ) : phase === "uploading" ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Transcribing…
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5" /> Voice Copilot
          </>
        )}
      </button>

      {(phase === "result" || phase === "error") && (
        <ResultModal
          phase={phase}
          result={result}
          error={error}
          onDismiss={dismiss}
          onExecute={executeAction}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
function ResultModal({ phase, result, error, onDismiss, onExecute }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-warm-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-warm-200 max-w-lg w-full overflow-hidden">
        <div className="px-5 py-3 border-b border-warm-200 flex items-center justify-between bg-gradient-to-r from-electric-50 to-teal-50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-electric-600" />
            <span className="font-bold text-warm-900 text-sm">Copilot — Voice Intent</span>
          </div>
          <button onClick={onDismiss} className="text-warm-500 hover:text-warm-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-sm">
          {phase === "error" && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {phase === "result" && result && (
            <>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-warm-500 font-semibold mb-1">
                  Heard
                </div>
                <div className="bg-warm-50 border border-warm-200 rounded-lg p-3 italic text-warm-800 flex items-start gap-2">
                  <Volume2 className="w-4 h-4 mt-0.5 text-electric-500 flex-shrink-0" />
                  <span>“{result.transcript || "(silence)"}”</span>
                </div>
                <div className="mt-1 text-[11px] text-warm-500 flex flex-wrap gap-2">
                  <SourcePill kind="STT" label={result.stt?.source} />
                  <SourcePill kind="Intent" label={result.intent_source} />
                  {result.audio?.bytes ? (
                    <span className="text-warm-400">{(result.audio.bytes / 1024).toFixed(1)} KB</span>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-widest text-warm-500 font-semibold mb-1">
                  Parsed intent
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Pill k="Intent" v={result.intent} tone="electric" />
                  <Pill
                    k="Target"
                    v={result.target_company_name || "—"}
                    tone={result.target_company_id ? "teal" : "warm"}
                  />
                  <Pill
                    k="Confidence"
                    v={
                      typeof result.intent_confidence === "number"
                        ? `${Math.round(result.intent_confidence * 100)}%`
                        : "—"
                    }
                  />
                  <Pill k="Action" v={result.action.label} />
                </div>
              </div>

              {result.action.blocked && (
                <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 text-amber-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{result.action.blocked_reason}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-warm-200 bg-warm-50 flex items-center justify-end gap-2">
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-warm-600 hover:text-warm-900"
          >
            Cancel
          </button>
          {phase === "result" && result && !result.action.blocked && result.action.navigate_to && (
            <button
              onClick={onExecute}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-electric-500 hover:bg-electric-600 text-white shadow"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {result.action.label}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ k, v, tone = "warm" }) {
  const cls =
    tone === "electric"
      ? "bg-electric-50 text-electric-700 ring-electric-500/30"
      : tone === "teal"
      ? "bg-teal-50 text-teal-700 ring-teal-500/30"
      : "bg-warm-100 text-warm-700 ring-warm-300/40";
  return (
    <div className={`rounded-lg ring-1 px-3 py-2 ${cls}`}>
      <div className="text-[9px] uppercase tracking-widest opacity-70">{k}</div>
      <div className="font-semibold truncate">{v}</div>
    </div>
  );
}

function SourcePill({ kind, label }) {
  if (!label) return null;
  const live = label === "GCP_STT" || label === "GEMINI_LIVE";
  const tone = live
    ? "bg-teal-100 text-teal-700"
    : label?.startsWith("FALLBACK") || label?.endsWith("FALLBACK")
    ? "bg-amber-100 text-amber-700"
    : "bg-warm-100 text-warm-600";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${tone}`}>
      {kind}: <span className="font-mono">{label}</span>
    </span>
  );
}
