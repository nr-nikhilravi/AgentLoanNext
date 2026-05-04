import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Brain,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Globe2,
  Newspaper,
  ShieldAlert,
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import Logo from "./Logo.jsx";
import { api, navigate } from "./api.js";

/**
 * Research Dashboard — RM-only Strategic Briefing.
 * URL: /research/:companyId
 * Shows the Gemini-backed (or curated-fallback) briefing and exposes a
 * "Select for Loan Initiation" button which marks research_completed=true
 * and routes back to the cockpit ready to Initiate.
 */
export default function Research({ companyId, onSelectForInitiation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async (force = false) => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.research(companyId, force);
      setData(res);
    } catch (e) {
      setErr(e.message || "Failed to fetch briefing.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return (
    <main className="flex-1 max-w-[1200px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
      <button
        onClick={() => navigate("/rm-dashboard")}
        className="inline-flex items-center gap-1.5 text-xs text-warm-500 hover:text-warm-800 mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to portfolio
      </button>

      {loading && <Skeleton />}

      {err && !loading && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-6 text-rose-800">
          <div className="font-bold mb-1">Couldn't load Strategic Briefing</div>
          <div className="text-sm">{err}</div>
        </div>
      )}

      {data && !loading && (
        <Briefing
          data={data}
          onRefresh={() => load(true)}
          onSelect={() => {
            onSelectForInitiation?.(companyId);
            navigate("/rm-dashboard");
          }}
        />
      )}
    </main>
  );
}

function Skeleton() {
  return (
    <div className="rounded-2xl bg-white border border-warm-200 p-12 text-center">
      <Loader2 className="w-8 h-8 mx-auto animate-spin text-electric-500" />
      <div className="mt-3 text-sm text-warm-500">
        Researcher is composing the Strategic Briefing...
      </div>
      <div className="mt-1 text-[11px] text-warm-400">
        Gemini grounded search + finance screen + sector synthesis
      </div>
    </div>
  );
}

function Briefing({ data, onRefresh, onSelect }) {
  const recVerdict = data.rm_recommendation?.verdict || "DEFER";
  const isProceed = recVerdict === "PROCEED_TO_INITIATE";
  const sourceTag = data.meta?.source || "UNKNOWN";

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="bg-gradient-to-br from-electric-700 to-teal-600 text-white rounded-2xl p-6 lg:p-7 shadow-lg shadow-electric-500/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1 text-[11px] uppercase tracking-widest font-semibold">
            <Brain className="w-3.5 h-3.5" /> Strategic Briefing · RM-only
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <SourcePill source={sourceTag} />
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-1 bg-white/15 hover:bg-white/25 rounded-full px-2.5 py-1 transition"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        </div>
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight mt-3">
          {data.company}
        </h1>
        <p className="text-white/95 mt-2 max-w-3xl leading-relaxed text-sm lg:text-base">
          {data.executive_summary}
        </p>
      </header>

      {/* Risk vs Opportunity ledger */}
      <section className="bg-white border border-warm-200 rounded-2xl overflow-hidden">
        <SectionHead icon={Brain} title="Risk vs Opportunity" subtitle="Balanced ledger — RM's eyes only" />
        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-warm-200">
          <Ledger
            tone="opportunity"
            title="Opportunities"
            icon={TrendingUp}
            items={(data.risk_vs_opportunity || []).filter(([k]) => k === "Opportunity").map((x) => x[1])}
          />
          <Ledger
            tone="risk"
            title="Risks"
            icon={TrendingDown}
            items={(data.risk_vs_opportunity || []).filter(([k]) => k === "Risk").map((x) => x[1])}
          />
        </div>
      </section>

      {/* News + Sector + Financial */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card icon={Newspaper} title="Recent News">
          <ul className="space-y-2 text-sm text-warm-700">
            {(data.recent_news || []).map((n, i) => (
              <li key={i} className="flex items-start gap-2 leading-relaxed">
                <ExternalLink className="w-3.5 h-3.5 mt-0.5 text-electric-500 flex-shrink-0" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card icon={Globe2} title="Sector Outlook">
          <p className="text-sm text-warm-700 leading-relaxed">{data.sector_outlook}</p>
        </Card>

        <Card icon={TrendingUp} title="Financial Snapshot">
          <Snapshot snap={data.financial_snapshot} />
        </Card>
      </div>

      {/* Red flags */}
      <section className="bg-white border border-warm-200 rounded-2xl">
        <SectionHead
          icon={ShieldAlert}
          title="Red Flags"
          subtitle="Litigation · governance · supply-chain · ESG"
        />
        <div className="px-5 py-4">
          {(data.red_flags || []).length === 0 ? (
            <div className="text-sm text-teal-700 font-semibold">No material red flags identified.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.red_flags.map((r, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-warm-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
                >
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 flex-shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Recommendation + Initiate CTA */}
      <section
        className={`rounded-2xl p-6 lg:p-7 border-2 ${
          isProceed
            ? "bg-electric-50 border-electric-500"
            : recVerdict === "DECLINE"
            ? "bg-rose-50 border-rose-300"
            : "bg-amber-50 border-amber-300"
        }`}
      >
        <div className="flex items-start gap-3">
          {isProceed ? (
            <CheckCircle2 className="w-6 h-6 text-electric-600 mt-1 flex-shrink-0" />
          ) : recVerdict === "DECLINE" ? (
            <XCircle className="w-6 h-6 text-rose-600 mt-1 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-amber-600 mt-1 flex-shrink-0" />
          )}
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-widest font-semibold text-warm-600 mb-1">
              Researcher recommendation
            </div>
            <div
              className={`text-2xl font-extrabold ${
                isProceed ? "text-electric-700" : recVerdict === "DECLINE" ? "text-rose-700" : "text-amber-700"
              }`}
            >
              {recVerdict.replace(/_/g, " ")}
            </div>
            <p className="text-warm-800 mt-1.5 text-sm">
              {data.rm_recommendation?.rationale}
            </p>
          </div>

          <button
            onClick={onSelect}
            disabled={recVerdict === "DECLINE"}
            className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-base shadow-lg whitespace-nowrap ${
              isProceed
                ? "bg-electric-500 hover:bg-electric-600 text-white shadow-electric-500/30"
                : recVerdict === "DEFER"
                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30"
                : "bg-warm-300 text-warm-500 cursor-not-allowed"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Select for Loan Initiation
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <div className="text-[11px] text-warm-400 text-center pb-2">
        Generated {data.meta?.generated_at} · model {data.meta?.model || "—"} · for{" "}
        {data.meta?.audience}
      </div>
    </div>
  );
}

function SectionHead({ icon: Icon, title, subtitle }) {
  return (
    <div className="px-5 py-3 border-b border-warm-200 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-electric-50 text-electric-600 flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="font-bold text-warm-900 text-sm">{title}</div>
        {subtitle && (
          <div className="text-[11px] uppercase tracking-widest text-warm-500">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

function Card({ icon, title, children }) {
  return (
    <div className="bg-white border border-warm-200 rounded-2xl flex flex-col">
      <SectionHead icon={icon} title={title} />
      <div className="px-5 py-4 flex-1">{children}</div>
    </div>
  );
}

function Ledger({ tone, title, icon: Icon, items }) {
  const cls =
    tone === "opportunity"
      ? "bg-teal-50 text-teal-800 border-teal-200"
      : "bg-rose-50 text-rose-800 border-rose-200";
  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon
          className={`w-4 h-4 ${tone === "opportunity" ? "text-teal-600" : "text-rose-600"}`}
        />
        <div className="font-bold text-warm-900 text-sm">{title}</div>
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className={`text-sm rounded-lg border px-3 py-2 leading-relaxed ${cls}`}>
            {it}
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-sm text-warm-500 italic">None identified.</li>
        )}
      </ul>
    </div>
  );
}

function Snapshot({ snap }) {
  if (!snap) return <div className="text-sm text-warm-500 italic">No snapshot available.</div>;
  const rows = [
    ["Market cap", snap.market_cap_inr_cr ? `₹${snap.market_cap_inr_cr} Cr` : "—"],
    ["Current price", snap.current_price_inr ? `₹${snap.current_price_inr}` : "—"],
    ["Issue price", snap.issue_price_inr ? `₹${snap.issue_price_inr}` : "—"],
    ["30-day move", snap["30d_move_pct"] != null ? `${snap["30d_move_pct"]}%` : "—"],
    ["Peer avg P/E", snap.peer_pe_avg != null ? `${snap.peer_pe_avg}x` : "—"],
    ["Borrower P/E", snap.vivid_pe != null ? `${snap.vivid_pe}x` : "—"],
  ];
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between">
          <dt className="text-warm-500">{k}</dt>
          <dd className="font-semibold text-warm-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function SourcePill({ source }) {
  const tone =
    source === "GEMINI_LIVE"
      ? "bg-teal-500/30 text-teal-100 ring-teal-300/40"
      : source === "GEMINI_FALLBACK"
      ? "bg-amber-500/30 text-amber-100 ring-amber-300/40"
      : "bg-white/15 text-white ring-white/20";
  const label =
    source === "GEMINI_LIVE"
      ? "Live · Gemini"
      : source === "GEMINI_FALLBACK"
      ? "Fallback (Gemini error)"
      : "Curated fallback";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ring-1 ${tone}`}>
      <Sparkles className="w-3 h-3" /> {label}
    </span>
  );
}
