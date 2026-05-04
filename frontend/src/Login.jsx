import React, { useState } from "react";
import { ArrowRight, Lock, ShieldCheck, AlertCircle, Building2, Users } from "lucide-react";
import Logo from "./Logo.jsx";
import { api, navigate } from "./api.js";

// Shared shell for both login pages
function LoginShell({ accent = "electric", title, subtitle, children }) {
  const accentBg =
    accent === "electric"
      ? "from-electric-700 via-electric-600 to-teal-600"
      : "from-teal-600 via-teal-500 to-electric-500";
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-warm-50">
      {/* Left brand panel */}
      <aside className={`hidden lg:flex flex-col justify-between p-10 text-white bg-gradient-to-br ${accentBg} relative overflow-hidden`}>
        <svg
          className="absolute inset-0 w-full h-full opacity-20"
          viewBox="0 0 600 800"
          preserveAspectRatio="none"
        >
          <g stroke="white" strokeWidth="1" fill="none">
            <path d="M0 80 L240 80 L260 100 L420 100 L440 80 L600 80" />
            <path d="M0 200 L160 200 L180 220 L340 220 L360 200 L600 200" />
            <path d="M0 320 L280 320 L300 340 L500 340 L520 320 L600 320" />
            <path d="M0 460 L120 460 L140 480 L380 480 L400 460 L600 460" />
            <circle cx="260" cy="100" r="3" fill="white" />
            <circle cx="440" cy="80" r="3" fill="white" />
            <circle cx="500" cy="340" r="3" fill="white" />
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
            AgentLoanNext · v3 · Intelligence & Security
          </div>
          <h2 className="text-3xl font-extrabold leading-tight">{title}</h2>
          <p className="text-white/85 mt-2 max-w-md">{subtitle}</p>
        </div>
        <div className="relative text-[11px] text-white/60">
          © 2026 Future Bank of India · CoR N-13.02458 · asia-south1
        </div>
      </aside>

      {/* Right form panel */}
      <main className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, autoComplete, mono }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-widest text-warm-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 w-full bg-white border border-warm-200 rounded-lg px-3 py-2.5 text-sm ${
          mono ? "font-mono" : ""
        } focus:outline-none focus:ring-2 focus:ring-electric-500/30 focus:border-electric-500`}
      />
    </label>
  );
}

function ErrorBanner({ msg }) {
  if (!msg) return null;
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{msg}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RM Login
// ---------------------------------------------------------------------------
export function RMLogin() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api.loginRM(id.trim(), pw);
      window.location.href = "/rm-dashboard";
    } catch (e) {
      setErr("Invalid RM credentials. Demo login: FBI2025 / abc1234.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LoginShell
      accent="electric"
      title="RM Cockpit Sign-In"
      subtitle="Bank-staff portal with the Researcher agent, the AI Spotlight, and the gated Initiate workflow."
    >
      <div className="lg:hidden mb-6 flex items-center gap-3">
        <Logo size={36} />
        <div>
          <div className="font-extrabold text-warm-900">Future Bank of India</div>
          <div className="text-xs text-warm-500">Innovating the Indian Dream</div>
        </div>
      </div>

      <div className="inline-flex items-center gap-2 bg-electric-50 text-electric-700 ring-1 ring-electric-500/20 px-3 py-1 rounded-full text-[11px] uppercase tracking-widest font-semibold mb-3">
        <Users className="w-3.5 h-3.5" /> Relationship Manager
      </div>
      <h1 className="text-2xl font-extrabold text-warm-900">Sign in</h1>
      <p className="text-sm text-warm-600 mt-1">
        Use your bank-issued staff ID. SSO will be enforced via Cloud IAP in production.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field
          label="RM ID"
          value={id}
          onChange={setId}
          placeholder="e.g. FBI2025"
          autoComplete="username"
          mono
        />
        <Field
          label="Password"
          type="password"
          value={pw}
          onChange={setPw}
          placeholder="••••••••"
          autoComplete="current-password"
        />
        <ErrorBanner msg={err} />
        <button
          type="submit"
          disabled={busy || !id || !pw}
          className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition ${
            id && pw && !busy
              ? "bg-electric-500 hover:bg-electric-600 text-white shadow-lg shadow-electric-500/30"
              : "bg-warm-200 text-warm-500 cursor-not-allowed"
          }`}
        >
          {busy ? "Signing in..." : (
            <>
              Enter the Cockpit <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-5 rounded-lg bg-warm-100 border border-warm-200 px-3 py-2 text-[11px] text-warm-600">
        <div className="font-semibold uppercase tracking-widest text-warm-500 mb-1">Demo credential</div>
        <div className="font-mono">FBI2025 / abc1234</div>
      </div>

      <div className="mt-6 text-xs text-warm-500 text-center">
        Are you the borrower?{" "}
        <button
          onClick={() => navigate("/login/customer")}
          className="text-electric-600 font-semibold hover:underline"
        >
          MSME portal sign-in →
        </button>
      </div>
    </LoginShell>
  );
}

// ---------------------------------------------------------------------------
// Customer Login
// ---------------------------------------------------------------------------
export function CustomerLogin() {
  const [u, setU] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api.loginCustomer(u.trim(), pw);
      window.location.href = "/msme-portal";
    } catch (e) {
      setErr("Invalid borrower credentials. Try vivid_user / vivid2026.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LoginShell
      accent="teal"
      title="MSME Portal Sign-In"
      subtitle="Borrower portal for reviewing your Key Fact Statement and completing the Aadhaar e-sign."
    >
      <div className="lg:hidden mb-6 flex items-center gap-3">
        <Logo size={36} />
        <div>
          <div className="font-extrabold text-warm-900">Future Bank of India</div>
          <div className="text-xs text-warm-500">Innovating the Indian Dream</div>
        </div>
      </div>

      <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 ring-1 ring-teal-500/20 px-3 py-1 rounded-full text-[11px] uppercase tracking-widest font-semibold mb-3">
        <Building2 className="w-3.5 h-3.5" /> MSME Promoter
      </div>
      <h1 className="text-2xl font-extrabold text-warm-900">Welcome back</h1>
      <p className="text-sm text-warm-600 mt-1">
        Sign in with the borrower username your Relationship Manager shared with you.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field
          label="Borrower username"
          value={u}
          onChange={setU}
          placeholder="e.g. vivid_user"
          autoComplete="username"
          mono
        />
        <Field
          label="Password"
          type="password"
          value={pw}
          onChange={setPw}
          placeholder="••••••••"
          autoComplete="current-password"
        />
        <ErrorBanner msg={err} />
        <button
          type="submit"
          disabled={busy || !u || !pw}
          className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition ${
            u && pw && !busy
              ? "bg-teal-500 hover:bg-teal-600 text-white shadow-lg shadow-teal-500/30"
              : "bg-warm-200 text-warm-500 cursor-not-allowed"
          }`}
        >
          {busy ? "Signing in..." : (
            <>
              Open my borrower portal <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-5 rounded-lg bg-warm-100 border border-warm-200 px-3 py-2 text-[11px] text-warm-600">
        <div className="font-semibold uppercase tracking-widest text-warm-500 mb-1">Demo credentials</div>
        <ul className="space-y-0.5 font-mono">
          <li>vivid_user / vivid2026</li>
          <li>surya_user / surya2026</li>
          <li>arzo_user / arzo2026</li>
          <li>blue_user / blue2026</li>
        </ul>
      </div>

      <div className="mt-6 text-xs text-warm-500 text-center">
        Are you bank staff?{" "}
        <button
          onClick={() => navigate("/login/rm")}
          className="text-teal-600 font-semibold hover:underline"
        >
          RM cockpit sign-in →
        </button>
      </div>
    </LoginShell>
  );
}
