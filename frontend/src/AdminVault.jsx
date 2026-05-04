import React, { useEffect, useState } from "react";
import { Lock, AlertTriangle, Eye, EyeOff, ShieldCheck } from "lucide-react";
import Logo from "./Logo.jsx";
import { api, navigate } from "./api.js";

/**
 * /admin/vault — hidden credential reference.
 * Server-side gate: only `role === "rm"` AND ALLOW_ADMIN_VAULT=true.
 * Client just renders what the API returns.
 */
export default function AdminVault() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    api.adminVault().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) {
    return (
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800">
          <div className="font-bold mb-1">Vault unavailable</div>
          <div className="text-sm">{err}</div>
          <button
            onClick={() => navigate("/login/rm")}
            className="mt-3 text-sm font-semibold text-rose-700 hover:underline"
          >
            Sign in as RM →
          </button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 text-warm-500 text-sm">
        Loading vault...
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl bg-warm-900 text-warm-50 p-6 mb-5 relative overflow-hidden">
        <svg
          className="absolute inset-0 w-full h-full opacity-10"
          viewBox="0 0 800 200"
          preserveAspectRatio="none"
        >
          <g stroke="white" strokeWidth="1" fill="none">
            <path d="M0 60 L240 60 L260 80 L420 80 L440 60 L800 60" />
            <path d="M0 130 L160 130 L180 150 L340 150 L360 130 L800 130" />
          </g>
        </svg>
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 text-[11px] uppercase tracking-widest font-semibold mb-3">
              <Lock className="w-3.5 h-3.5" /> Admin Vault · /admin/vault
            </div>
            <h1 className="text-2xl font-extrabold">Credential Reference</h1>
            <p className="text-warm-200 text-sm mt-1 max-w-2xl">
              Hidden route for presentation use. Every render is audited to{" "}
              <span className="font-mono text-xs">{data.audit_sink}</span>.
            </p>
            <p className="text-[11px] text-warm-300 mt-2">
              Viewed by <span className="font-semibold">{data.viewed_by}</span> at{" "}
              <span className="font-mono">{data.viewed_at}</span>
            </p>
          </div>
          <button
            onClick={() => setReveal((r) => !r)}
            className="inline-flex items-center gap-2 bg-white text-warm-900 font-semibold px-3 py-2 rounded-lg text-sm"
          >
            {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {reveal ? "Mask passwords" : "Reveal passwords"}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 mb-5 text-xs text-amber-800 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{data.warning}</span>
      </div>

      {/* Admin table */}
      {data.admin && (
        <section className="bg-white border border-warm-200 rounded-2xl overflow-hidden mb-5">
          <div className="px-5 py-3 border-b border-warm-200 flex items-center gap-2">
            <Lock className="w-4 h-4 text-warm-900" />
            <div className="font-bold text-warm-900 text-sm">
              Bank-Wide Operations (Admin · privileged-access)
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-50 text-[11px] uppercase tracking-widest text-warm-500">
                  <th className="text-left px-5 py-3 font-semibold">Display name</th>
                  <th className="text-left px-3 py-3 font-semibold">Title</th>
                  <th className="text-left px-3 py-3 font-semibold">Admin ID</th>
                  <th className="text-left px-3 py-3 font-semibold">Password</th>
                  <th className="text-left px-3 py-3 font-semibold">Login URL</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-warm-100">
                  <td className="px-5 py-3 font-semibold text-warm-900">{data.admin.display_name}</td>
                  <td className="px-3 py-3 text-warm-700 text-xs">{data.admin.title}</td>
                  <td className="px-3 py-3 font-mono text-warm-900">{data.admin.id}</td>
                  <td className="px-3 py-3 font-mono text-warm-900">
                    {reveal ? data.admin.password : "•".repeat(data.admin.password.length)}
                  </td>
                  <td className="px-3 py-3 font-mono text-warm-900">
                    <a href={data.admin.login_url}>{data.admin.login_url}</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* RM table */}
      <section className="bg-white border border-warm-200 rounded-2xl overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-warm-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-electric-600" />
          <div className="font-bold text-warm-900 text-sm">Bank-staff (RM)</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-warm-50 text-[11px] uppercase tracking-widest text-warm-500">
                <th className="text-left px-5 py-3 font-semibold">Display name</th>
                <th className="text-left px-3 py-3 font-semibold">Title</th>
                <th className="text-left px-3 py-3 font-semibold">RM ID</th>
                <th className="text-left px-3 py-3 font-semibold">Password</th>
                <th className="text-left px-3 py-3 font-semibold">Login URL</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-warm-100">
                <td className="px-5 py-3 font-semibold text-warm-900">{data.rm.display_name}</td>
                <td className="px-3 py-3 text-warm-700 text-xs">{data.rm.title}</td>
                <td className="px-3 py-3 font-mono text-warm-900">{data.rm.id}</td>
                <td className="px-3 py-3 font-mono text-warm-900">
                  {reveal ? data.rm.password : "•".repeat(data.rm.password.length)}
                </td>
                <td className="px-3 py-3 font-mono text-electric-600">
                  <a href={data.rm.login_url}>{data.rm.login_url}</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Customer table */}
      <section className="bg-white border border-warm-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-warm-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <div className="font-bold text-warm-900 text-sm">MSME borrowers</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-warm-50 text-[11px] uppercase tracking-widest text-warm-500">
                <th className="text-left px-5 py-3 font-semibold">Company</th>
                <th className="text-left px-3 py-3 font-semibold">Promoter</th>
                <th className="text-left px-3 py-3 font-semibold">ID</th>
                <th className="text-left px-3 py-3 font-semibold">Username</th>
                <th className="text-left px-3 py-3 font-semibold">Password</th>
                <th className="text-left px-3 py-3 font-semibold">Login URL</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.map((c) => (
                <tr key={c.username} className="border-t border-warm-100 hover:bg-warm-50/50">
                  <td className="px-5 py-3 font-semibold text-warm-900">{c.company}</td>
                  <td className="px-3 py-3 text-warm-700 text-xs">{c.display_name}</td>
                  <td className="px-3 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 ring-1 ring-teal-500/30">
                      {c.company_id}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-warm-900">{c.username}</td>
                  <td className="px-3 py-3 font-mono text-warm-900">
                    {reveal ? c.password : "•".repeat(c.password.length)}
                  </td>
                  <td className="px-3 py-3 font-mono text-teal-600">
                    <a href={c.login_url}>{c.login_url}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 flex items-center gap-2 text-xs text-warm-500">
        <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
        Audit hash recorded for this view.
      </div>
    </main>
  );
}
