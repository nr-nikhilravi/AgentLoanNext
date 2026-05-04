"""
AgentLoanNext — Copilot Voice Module
====================================
Pipeline:
    1. Receive an audio blob from the browser MediaRecorder.
    2. Transcribe via Google Cloud Speech-to-Text (`speech.googleapis.com`).
    3. Pass the transcript to Gemini for structured intent extraction.
    4. Map the intent to a concrete navigation / orchestration action.

Both Cloud STT and Gemini are optional — if either is unavailable, the
module degrades gracefully so the demo never blocks:
    - No `GOOGLE_APPLICATION_CREDENTIALS` / Cloud SDK → naive header-name
      keyword extraction (so the demo still flows)
    - No `GEMINI_API_KEY` → deterministic keyword-based intent parser

Supported intents:
    RESEARCH_COMPANY     → unlock research_completed for that company
    INITIATE_LOAN        → only valid if the RM has researched the target
    OPEN_VAULT           → navigate to /admin/vault
    OPEN_PORTFOLIO       → navigate to /rm-dashboard
    UNKNOWN              → no action; surface transcript only
"""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime
from typing import Any, Dict, Optional

LOG = logging.getLogger("voice")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyD0LQCyJwT2ihJtub8wvlxLIt9C-RmImfM")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
STT_LANGUAGE = os.environ.get("STT_LANGUAGE_CODE", "en-IN")     # Indian English by default

# ---------------------------------------------------------------------------
# Company alias table — maps anything the RM might say to a portfolio id
# ---------------------------------------------------------------------------

COMPANY_ALIASES = {
    "VIV": [
        "vivid", "vivid electromech", "vivid electromech limited", "vivid em",
        "vivid electronics", "electromech",
    ],
    "SUR": [
        "surya", "surya solars", "surya solar", "solars", "solar",
    ],
    "ARZ": [
        "arzo", "arzo tech", "arzo tech industries", "arzo industries",
    ],
    "BLU": [
        "blue", "blue ocean", "blue ocean logistics", "blue logistics",
    ],
}

INTENT_PATTERNS = {
    # Order matters — VIEW_ADMIN_RESEARCH must be tested before RESEARCH_COMPANY
    "VIEW_ADMIN_RESEARCH": [
        r"\badmin\b.*\bresearch\b",
        r"\blatest admin\b",
        r"\badmin (briefing|pack)\b",
        r"\badmin[- ]verified\b",
    ],
    "RESEARCH_COMPANY": [
        r"\bresearch\b", r"\banalyz", r"\banalyse", r"\bbriefing\b",
        r"\bdeep dive\b", r"\bdue dilig", r"\bstrategic\b",
    ],
    "INITIATE_LOAN": [
        r"\binitiate\b", r"\bstart\b.*\bloan\b", r"\bbegin\b.*\bloan\b",
        r"\bunderwrite\b", r"\bproceed\b.*\bloan\b", r"\btrigger\b.*\bloan\b",
    ],
    "OPEN_VAULT": [
        r"\bvault\b", r"\bcredentials?\b", r"\bpasswords?\b",
    ],
    "OPEN_PORTFOLIO": [
        r"\bportfolio\b", r"\bgod[- ]?view\b", r"\bdashboard\b", r"\bcockpit\b",
    ],
}

INTENT_TO_ACTION = {
    "RESEARCH_COMPANY": {
        "navigate_template": "/research/{company_id}",
        "label": "Open Strategic Briefing",
    },
    "VIEW_ADMIN_RESEARCH": {
        "navigate_template": "/research/{company_id}?source=admin",
        "label": "Open Admin-Verified Briefing",
    },
    "INITIATE_LOAN": {
        "navigate_template": "/rm-dashboard?initiate={company_id}",
        "label": "Initiate Loan Process",
    },
    "OPEN_VAULT": {
        "navigate_template": "/admin/vault",
        "label": "Open Admin Vault",
    },
    "OPEN_PORTFOLIO": {
        "navigate_template": "/rm-dashboard",
        "label": "Open RM Cockpit",
    },
    "UNKNOWN": {
        "navigate_template": None,
        "label": "Couldn't determine intent — please rephrase.",
    },
}


# ---------------------------------------------------------------------------
# 1. Speech-to-Text
# ---------------------------------------------------------------------------

def transcribe(audio_bytes: bytes, mime_type: str = "audio/webm") -> Dict[str, Any]:
    """
    Transcribe audio bytes via Google Cloud Speech-to-Text.

    Returns: {transcript, confidence, source}
        source ∈ {GCP_STT, FALLBACK_NO_SDK, FALLBACK_API_ERROR, FALLBACK_NO_AUDIO}
    """
    if not audio_bytes:
        return {"transcript": "", "confidence": 0.0, "source": "FALLBACK_NO_AUDIO"}

    try:
        # Lazy import — package may not be installed locally
        from google.cloud import speech_v1 as speech    # type: ignore
    except Exception as e:
        LOG.warning("google-cloud-speech not available: %s", e)
        return {
            "transcript": "",
            "confidence": 0.0,
            "source": "FALLBACK_NO_SDK",
            "error": f"google-cloud-speech import failed: {e}",
        }

    encoding = _encoding_for_mime(mime_type)
    try:
        client = speech.SpeechClient()
        audio = speech.RecognitionAudio(content=audio_bytes)
        config = speech.RecognitionConfig(
            encoding=encoding,
            language_code=STT_LANGUAGE,
            alternative_language_codes=["en-US"],
            enable_automatic_punctuation=True,
            model="latest_short",
            audio_channel_count=1,
        )
        response = client.recognize(config=config, audio=audio)
        if not response.results:
            return {"transcript": "", "confidence": 0.0, "source": "GCP_STT"}
        best = response.results[0].alternatives[0]
        return {
            "transcript": best.transcript.strip(),
            "confidence": float(best.confidence or 0.0),
            "source": "GCP_STT",
        }
    except Exception as e:
        LOG.exception("Cloud STT call failed")
        return {
            "transcript": "",
            "confidence": 0.0,
            "source": "FALLBACK_API_ERROR",
            "error": f"{type(e).__name__}: {e}",
        }


def _encoding_for_mime(mime_type: str):
    """Best-effort mapping from a browser MediaRecorder mime to a Speech encoding."""
    from google.cloud import speech_v1 as speech    # imported only when needed
    mime = (mime_type or "").lower()
    if "webm" in mime or "opus" in mime:
        return speech.RecognitionConfig.AudioEncoding.WEBM_OPUS
    if "ogg" in mime:
        return speech.RecognitionConfig.AudioEncoding.OGG_OPUS
    if "mp4" in mime or "m4a" in mime or "aac" in mime:
        return speech.RecognitionConfig.AudioEncoding.MP3   # closest practical fallback
    if "wav" in mime or "pcm" in mime:
        return speech.RecognitionConfig.AudioEncoding.LINEAR16
    return speech.RecognitionConfig.AudioEncoding.ENCODING_UNSPECIFIED


# ---------------------------------------------------------------------------
# 2. Intent extraction
# ---------------------------------------------------------------------------

def parse_intent(transcript: str) -> Dict[str, Any]:
    """
    Returns: {intent, target_company_id, target_company_name, confidence, source}
        source ∈ {GEMINI_LIVE, GEMINI_FALLBACK, KEYWORD_FALLBACK, EMPTY}
    """
    transcript = (transcript or "").strip()
    if not transcript:
        return {
            "intent": "UNKNOWN",
            "target_company_id": None,
            "target_company_name": None,
            "confidence": 0.0,
            "source": "EMPTY",
        }

    if GEMINI_API_KEY:
        try:
            return _parse_with_gemini(transcript)
        except Exception as e:
            LOG.exception("Gemini intent parse failed; falling back")
            keyword = _parse_with_keywords(transcript)
            keyword["source"] = "GEMINI_FALLBACK"
            keyword["error"] = f"{type(e).__name__}: {e}"
            return keyword
    return _parse_with_keywords(transcript)


def _parse_with_gemini(transcript: str) -> Dict[str, Any]:
    import google.generativeai as genai    # type: ignore

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)
    prompt = f"""You are Copilot, a voice-intent parser for Future Bank of India's RM cockpit.
The Relationship Manager said the following utterance — extract structured intent.

Utterance: \"\"\"{transcript}\"\"\"

Allowed intents:
- RESEARCH_COMPANY    (RM wants a Strategic Briefing on a specific borrower)
- INITIATE_LOAN       (RM wants to start the underwriting workflow)
- OPEN_VAULT          (RM wants to see the credentials vault)
- OPEN_PORTFOLIO      (RM wants the cockpit / God-View)
- UNKNOWN             (utterance does not match any of the above)

Allowed company_ids (case-sensitive):
- VIV  Vivid Electromech Limited
- SUR  Surya Solars Pvt Ltd
- ARZ  Arzo Tech Industries Pvt Ltd
- BLU  Blue Ocean Logistics Pvt Ltd

Return ONLY JSON with this schema (no prose):
{{
  "intent": "RESEARCH_COMPANY" | "INITIATE_LOAN" | "OPEN_VAULT" | "OPEN_PORTFOLIO" | "UNKNOWN",
  "target_company_id": "VIV" | "SUR" | "ARZ" | "BLU" | null,
  "target_company_name": "<full legal name or null>",
  "confidence": 0.0 - 1.0
}}
"""
    resp = model.generate_content(
        prompt,
        generation_config={
            "temperature": 0.1,
            "max_output_tokens": 256,
            "response_mime_type": "application/json",
        },
    )
    text = (resp.text or "").strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.rsplit("```", 1)[0]
    parsed = json.loads(text)
    parsed.setdefault("intent", "UNKNOWN")
    parsed.setdefault("target_company_id", None)
    parsed.setdefault("target_company_name", None)
    parsed.setdefault("confidence", 0.85)
    parsed["source"] = "GEMINI_LIVE"
    return parsed


def _parse_with_keywords(transcript: str) -> Dict[str, Any]:
    """Deterministic regex fallback."""
    text = transcript.lower()

    # Find intent
    intent = "UNKNOWN"
    for candidate, patterns in INTENT_PATTERNS.items():
        if any(re.search(p, text) for p in patterns):
            intent = candidate
            break

    # Find target company
    target_id: Optional[str] = None
    target_name: Optional[str] = None
    for cid, aliases in COMPANY_ALIASES.items():
        if any(alias in text for alias in aliases):
            target_id = cid
            break
    if target_id:
        target_name = {
            "VIV": "Vivid Electromech Limited",
            "SUR": "Surya Solars Pvt Ltd",
            "ARZ": "Arzo Tech Industries Pvt Ltd",
            "BLU": "Blue Ocean Logistics Pvt Ltd",
        }[target_id]

    # If we found a company but no verb, default to RESEARCH (least-destructive)
    if intent == "UNKNOWN" and target_id:
        intent = "RESEARCH_COMPANY"

    return {
        "intent": intent,
        "target_company_id": target_id,
        "target_company_name": target_name,
        "confidence": 0.65 if target_id else 0.35,
        "source": "KEYWORD_FALLBACK",
    }


# ---------------------------------------------------------------------------
# 3. End-to-end pipeline
# ---------------------------------------------------------------------------

def process_voice_command(
    audio_bytes: bytes,
    mime_type: str,
    researched_set: Optional[set[str]] = None,
) -> Dict[str, Any]:
    """
    Run the full STT → intent → action pipeline. Returns a payload the
    frontend uses to render a confirmation card and (optionally) navigate.
    """
    researched_set = researched_set or set()
    stt = transcribe(audio_bytes, mime_type=mime_type)
    transcript = stt["transcript"]

    intent_payload = parse_intent(transcript)
    intent = intent_payload["intent"]
    target_id = intent_payload.get("target_company_id")

    action_meta = INTENT_TO_ACTION.get(intent, INTENT_TO_ACTION["UNKNOWN"])
    nav_template = action_meta["navigate_template"]

    # Construct the actual nav target
    nav: Optional[str] = None
    blocked_reason: Optional[str] = None
    if nav_template:
        if "{company_id}" in nav_template:
            if not target_id:
                blocked_reason = "I heard a command but couldn't tell which company you meant."
            else:
                nav = nav_template.format(company_id=target_id)
        else:
            nav = nav_template

    # Research-gate enforcement for INITIATE_LOAN
    if intent == "INITIATE_LOAN" and target_id and target_id not in researched_set:
        blocked_reason = (
            f"You haven't run a Strategic Briefing on {intent_payload['target_company_name']} yet. "
            f"Say \"Research {intent_payload['target_company_name'].split()[0]}\" first."
        )

    return {
        "ok": True,
        "received_at": datetime.utcnow().isoformat() + "Z",
        "audio": {
            "mime_type": mime_type,
            "bytes": len(audio_bytes),
        },
        "transcript": transcript,
        "stt": {
            "source": stt["source"],
            "confidence": stt.get("confidence", 0.0),
            "error": stt.get("error"),
        },
        "intent": intent,
        "target_company_id": target_id,
        "target_company_name": intent_payload.get("target_company_name"),
        "intent_confidence": intent_payload.get("confidence"),
        "intent_source": intent_payload.get("source"),
        "action": {
            "navigate_to": nav,
            "label": action_meta["label"],
            "blocked": blocked_reason is not None,
            "blocked_reason": blocked_reason,
        },
    }
