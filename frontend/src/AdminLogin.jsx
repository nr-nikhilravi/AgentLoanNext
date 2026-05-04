import React, { useState } from "react";
import { ArrowRight, AlertCircle, Shield } from "lucide-react";
import Logo from "./Logo.jsx";
import { api, navigate } from "./api.js";

/**
 * /login/admin — Future Bank of India · Bank-wide Operations sign-in.
 *
 * Mirrors the warm-grey + Electric/Teal styling of /login/rm and
 * /login/customer, but uses a darker brand panel and a Shield motif so
 * staff visually recognise this as an elevated-privilege portal.
 */
export default function AdminLogin() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api.loginAdmin(id.trim(), pw);
      window.location.href = "/admin-dashboard";
    } catch (e2) {
      setErr("Invalid Admin credentials. Demo: FBI_ADMIN / admin_pass_2026.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-warm-50">
      {/* Left brand panel — darker, admin-grade */}
      <aside className="hidden lg:flex flex-col justify-between p-10 text-white bg-gradient-to-br from-warm-900 via-electric-700 to-electric-600 relative overflow-hidden">
        <svg
          className="absolute inset-0 w-full h-full opacity-15"
          viewBox="0 0 600 800"
          preserveAspectRatio="none"
        >
          <g stroke="white" strokeWidth="1" fill="none">
            <path d="M0 60 L240 60 L260 80 L420 80 L440 60 L600 60" />
            <path d="M0 180 L160 180 L180 200 L340 200 L360 180 L600 180" />
            <path d="M0 300 L280 300 L300 320 L500 320 L520 300 L600 300" />
            <path d="M0 460 L120 460 L140 480 L380 480 L400 460 L600 460" />
            <circle cx="260" cy="80" r="3" fill="white" />
            <circle cx="500" cy="320" r="3" fill="white" />
          </g>
        </svg>
        <div className="relative">
          <Logo size={48} />
          <div className="mt-4">
            <div className="text-3xl font-extrabold tracking-tight">Future Bank of India</div>
            <div className="text-white/80 text-base mt-1">Innovating the Indian Dream.</div>
          </div>
        </div>
        <div className="relative">
          <div className="text-[11px] uppercase tracking-widest text-white/70 mb-2">
            AgentLoanNext · v5 · Admin Command Center
          </div>
          <h2 className="text-3xl font-extrabold leading-tight">Bank-Wide Operations</h2>
          <p className="text-white/85 mt-2 max-w-md">
            Trigger bulk research jobs, monitor the Nightly Intelligence Batch,
            and feed Admin-Verified briefings to every Relationship Manager.
          </p>
        </div>
        <div className="relative text-[11px] text-white/60">
          © 2026 Future Bank of India · CoR N-13.02458 · asia-south1 · privileged-access
        </div>
      </aside>

      {/* Right form */}
      <main className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-6 flex items-center gap-3">
            <Logo size={36} />
            <div>
              <div className="font-extrabold text-warm-900">Future Bank of India</div>
              <div className="text-xs text-warm-500">Admin Command Center</div>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 bg-warm-900 text-white ring-1 ring-warm-900 px-3 py-1 rounded-full text-[11px] uppercase tracking-widest font-semibold mb-3">
            <Shield className="w-3.5 h-3.5" /> Privileged-Access Sign-In
          </div>
          <h1 className="text-2xl font-extrabold text-warm-900">Admin sign in</h1>
          <p className="text-sm text-warm-600 mt-1">
            For bank-wide operations only. All actions audited to{" "}
            <span className="font-mono">gs://fbi-agentloannext-audit-2026/</span>.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-warm-500">
                Admin ID
              </span>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g. FBI_ADMIN"
                autoComplete="username"
                className="mt-1 w-full bg-white border border-warm-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-electric-500/30 focus:border-electric-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-warm-500">
                Password
              </span>
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="mt-1 w-full bg-white border border-warm-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-electric-500/30 focus:border-electric-500"
              />
            </label>

            {err && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !id || !pw}
              className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition ${
                id && pw && !busy
                  ? "bg-warm-900 hover:bg-warm-800 text-white shadow-lg shadow-warm-900/30"
                  : "bg-warm-200 text-warm-500 cursor-not-allowed"
              }`}
            >
              {busy ? "Signing in..." : (
                <>
                  Enter the Command Center <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 rounded-lg bg-warm-100 border border-warm-200 px-3 py-2 text-[11px] text-warm-600">
            <div className="font-semibold uppercase tracking-widest text-warm-500 mb-1">
              Demo credential
            </div>
            <div className="font-mono">FBI_ADMIN / admin_pass_2026</div>
          </div>

          <div className="mt-6 text-xs text-warm-500 text-center">
            Are you a Relationship Manager?{" "}
            <button
              onClick={() => navigate("/login/rm")}
              className="text-electric-600 font-semibold hover:underline"
            >
              RM cockpit sign-in →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
