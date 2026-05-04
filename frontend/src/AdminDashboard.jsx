import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Brain,
  Building2,
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Target,
  Database,
  ShieldCheck,
} from "lucide-react";
import { api, navigate } from "./api.js";

const POLL_MS = 750;

/**
 * /admin-dashboard — Bank-wide bulk research command center.
 * Privileged-access only (session.role === "admin").
 *
 * Flow:
 *   1. Fetch the portfolio + the latest batch job snapshot.
 *   2. Show a header card with the "Initiate Bulk Research Job" CTA.
 *   3. While a batch is RUNNING, poll /api/admin/batch/{id} every 750ms.
 *   4. As items complete, surface them as Admin-Verified briefings.
 */
export default function AdminDashboard() {
  const [portfolio, setPortfolio] = useState([]);
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pollRef = useRef(null);

  const isRunning = job?.status === "RUNNING";

  // Initial load
  useEffect(() => {
    api.portfolio().then((d) => setPortfolio(d.clients || [])).catch((e) => setErr(e.message));
    api.adminBatchLatest().then((d) => d.job && setJob(d.job)).catch(() => {});
  }, []);

  // Polling while running
  useEffect(() => {
    if (!isRunning || !job?.id) return;
    pollRef.current = setInterval(async () => {
      try {
        const fresh = await api.adminBatchStatus(job.id);
        setJob(fresh);
        if (fresh.status !== "RUNNING") {
          clearInterval(pollRef.current);
          // refresh portfolio to surface admin freshness pills
          api.portfolio().then((d) => setPortfolio(d.clients || []));
        }
      } catch (e) {
        clearInterval(pollRef.current);
        setErr(e.message);
      }
    }, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [isRunning, job?.id]);

  const initiate = async () => {
    setErr("");
    setBusy(true);
    try {
      const res = await api.adminInitiateBatch();
      const fresh = await api.adminBatchStatus(res.job_id);
      setJob(fresh);
    } catch (e) {
      setErr(e.message || "Failed to initiate batch");
    } finally {
      setBusy(false);
    }
  };

  const progressPct = job?.progress_pct ?? 0;
  const completedAt = job?.finished_at ? new Date(job.finished_at) : null;

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Hero / CTA */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-warm-900 via-electric-700 to-electric-600 text-white shadow-xl shadow-electric-700/20 p-6 lg:p-8">
        <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 800 300" preserveAspectRatio="none">
          <g stroke="white" strokeWidth="1" fill="none">
            <path d="M0 60 L200 60 L210 50 L260 50 L270 60 L800 60" />
            <path d="M0 130 L120 130 L130 140 L300 140 L310 130 L800 130" />
            <path d="M0 200 L380 200 L390 190 L500 190 L510 200 L800 200" />
            <circle cx="210" cy="50" r="3" fill="white" />
            <circle cx="510" cy="200" r="3" fill="white" />
          </g>
        </svg>
        <div className="relative grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1 text-[11px] uppercase tracking-widest font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Admin Command Center · v5
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
              Bulk Intelligence Operations
            </h1>
            <p className="text-white/90 mt-2 max-w-2xl">
              Trigger a parallel Gemini-powered research pass for every MSME in
              the portfolio. Each Admin-Verified briefing is timestamped,
              cached, and surfaced inside every RM's cockpit on their next
              dashboard load.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={initiate}
                disabled={busy || isRunning}
                className={`inline-flex items-center gap-2.5 font-bold text-base px-6 py-3 rounded-xl shadow-lg shadow-black/30 transition ${
                  busy || isRunning
                    ? "bg-white/15 text-white/60 cursor-not-allowed"
                    : "bg-white text-warm-900 hover:bg-warm-50"
                }`}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Batch in progress…
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 text-electric-600" />
                    Initiate Bulk Research Job
                  </>
                )}
              </button>
              <button
                onClick={() => navigate("/admin/vault")}
                className="inline-flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg px-3.5 py-2 text-white/90"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Open Admin Vault
              </button>
            </div>
            {err && (
              <div className="mt-4 inline-flex items-start gap-2 rounded-lg bg-rose-500/20 border border-rose-300/30 text-rose-100 px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{err}</span>
              </div>
            )}
          </div>

          {/* Stat rail */}
          <div className="bg-white/10 backdrop-blur ring-1 ring-white/15 rounded-2xl p-5 self-start grid grid-cols-2 gap-3">
            <Mini k="Portfolio" v={portfolio.length} icon={Building2} />
            <Mini
              k="Admin-verified"
              v={portfolio.filter((c) => c.admin_verified).length}
              icon={ShieldCheck}
            />
            <Mini
              k="Last batch"
              v={completedAt ? humanAgo(completedAt) : "—"}
              icon={Clock}
            />
            <Mini
              k="Status"
              v={job?.status || "IDLE"}
              icon={Target}
            />
          </div>
        </div>
      </section>

      {/* Progress tracker */}
      {job && (
        <section className="bg-white border border-warm-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-warm-200 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-electric-50 text-electric-600 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <div className="font-bold text-warm-900 text-sm">
                  {job.label} · <span className="font-mono text-[11px] text-warm-500">{job.id}</span>
                </div>
                <div className="text-[11px] text-warm-500">
                  Started by <span className="font-semibold">{job.started_by}</span> at{" "}
                  <span className="font-mono">{new Date(job.started_at).toLocaleTimeString("en-IN")}</span>
                  {job.finished_at && (
                    <>
                      {" "}· duration{" "}
                      <span className="font-mono">
                        {(job.duration_ms / 1000).toFixed(1)}s
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <StatusPill status={job.status} />
          </div>

          {/* Progress bar */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between text-xs text-warm-600 mb-2">
              <span>
                <strong className="text-warm-900">{job.completed}</strong> /
                <span className="ml-1">{job.total}</span> completed
                {job.failed > 0 && (
                  <span className="ml-2 text-rose-700">
                    · {job.failed} failed
                  </span>
                )}
              </span>
              <span className="font-mono">{progressPct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-warm-100 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  job.status === "FAILED"
                    ? "bg-rose-500"
                    : job.status === "PARTIAL"
                    ? "bg-amber-500"
                    : "bg-gradient-to-r from-electric-500 to-teal-500"
                }`}
                style={{ width: `${Math.min(progressPct, 100)}%` }}
              />
            </div>
          </div>

          {/* Per-item table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-50 text-[11px] uppercase tracking-widest text-warm-500">
                  <th className="text-left px-5 py-2.5 font-semibold">Company</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Status</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Source</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Started</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Finished</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(job.items).map(([cid, it]) => {
                  const meta = portfolio.find((c) => c.id === cid);
                  return (
                    <tr key={cid} className="border-t border-warm-100">
                      <td className="px-5 py-2.5">
                        <div className="font-semibold text-warm-900">
                          {meta?.short_name || cid}
                        </div>
                        <div className="text-[11px] text-warm-500 font-mono">{cid}</div>
                      </td>
                      <td className="px-3 py-2.5"><ItemPill status={it.status} /></td>
                      <td className="px-3 py-2.5">
                        {it.source ? (
                          <span className="font-mono text-[11px] text-warm-700">{it.source}</span>
                        ) : (
                          <span className="text-warm-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-warm-600">
                        {it.started_at ? new Date(it.started_at).toLocaleTimeString("en-IN") : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-warm-600">
                        {it.finished_at ? new Date(it.finished_at).toLocaleTimeString("en-IN") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Admin-verified tiles */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-warm-900">
            Admin Intelligence Packs
          </h2>
          <button
            onClick={() => api.portfolio().then((d) => setPortfolio(d.clients || []))}
            className="inline-flex items-center gap-1.5 text-xs text-warm-600 hover:text-warm-900"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {portfolio.map((c) => (
            <CompanyTile key={c.id} c={c} />
          ))}
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------

function Mini({ k, v, icon: Icon }) {
  return (
    <div className="bg-white/10 rounded-lg p-3 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-md bg-white/15 flex items-center justify-center">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="leading-tight">
        <div className="text-base font-extrabold">{v}</div>
        <div className="text-[10px] uppercase tracking-widest text-white/70">{k}</div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    RUNNING:   { cls: "bg-electric-50 text-electric-700 ring-electric-500/30", label: "RUNNING" },
    COMPLETED: { cls: "bg-teal-50 text-teal-700 ring-teal-500/30",             label: "COMPLETED" },
    PARTIAL:   { cls: "bg-amber-50 text-amber-700 ring-amber-500/30",          label: "PARTIAL" },
    FAILED:    { cls: "bg-rose-50 text-rose-700 ring-rose-500/30",             label: "FAILED" },
  };
  const m = map[status] || map.COMPLETED;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-md ring-1 ${m.cls}`}>
      {status === "RUNNING" && <Loader2 className="w-3 h-3 animate-spin" />}
      {m.label}
    </span>
  );
}

function ItemPill({ status }) {
  const map = {
    PENDING: { cls: "bg-warm-100 text-warm-700",        label: "Pending" },
    RUNNING: { cls: "bg-electric-50 text-electric-700", label: "Running" },
    DONE:    { cls: "bg-teal-50 text-teal-700",         label: "Done" },
    FAILED:  { cls: "bg-rose-50 text-rose-700",         label: "Failed" },
  };
  const m = map[status] || map.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md ${m.cls}`}>
      {status === "RUNNING" && <Loader2 className="w-3 h-3 animate-spin" />}
      {status === "DONE" && <CheckCircle2 className="w-3 h-3" />}
      {m.label}
    </span>
  );
}

function CompanyTile({ c }) {
  const verified = c.admin_verified;
  const fresh = c.admin_research_status === "FRESH";
  return (
    <div className={`rounded-2xl p-4 border ${
      verified ? "bg-teal-50/40 border-teal-500/30" : "bg-white border-warm-200"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-warm-900 truncate">{c.short_name}</div>
        {verified && (
          <span className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-md ${
            fresh ? "bg-teal-500 text-white" : "bg-amber-100 text-amber-700"
          }`}>
            <ShieldCheck className="w-3 h-3" />
            {fresh ? "Verified · Fresh" : "Verified · Stale"}
          </span>
        )}
      </div>
      <div className="text-[11px] text-warm-500 font-mono mb-2">{c.id} · {c.industry}</div>
      <div className="text-xs text-warm-600">
        {c.last_admin_update ? (
          <>
            Admin Research updated{" "}
            <span className="font-semibold text-warm-800">{humanAgo(c.last_admin_update)}</span>
          </>
        ) : (
          <span className="italic text-warm-400">No admin briefing yet.</span>
        )}
      </div>
    </div>
  );
}

function humanAgo(when) {
  const t = typeof when === "string" ? new Date(when).getTime() : when.getTime();
  const sec = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
