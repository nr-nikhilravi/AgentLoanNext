import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Brain,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Building2,
  IndianRupee,
  CheckCircle2,
  Loader2,
  Languages,
  Database,
  Zap,
  Lock,
  Search,
  ChevronRight,
  Target,
  Calendar,
  FileText,
  Users,
} from "lucide-react";
import Logo from "./Logo.jsx";
import { api, navigate } from "./api.js";

const inr = (n) =>
  typeof n === "number"
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
    : n;
const cr = (n) => `₹${(n / 1e7).toFixed(2)} Cr`;

const TIER_PILLS = {
  STRATEGIC_PRIME: "bg-electric-50 text-electric-700 ring-electric-500/30",
  PRIME: "bg-teal-50 text-teal-700 ring-teal-500/30",
  NEAR_PRIME: "bg-amber-50 text-amber-700 ring-amber-500/30",
  REVIEW: "bg-warm-200 text-warm-700 ring-warm-400/40",
};

const SCORE_TONE = (s) =>
  s >= 90 ? "text-electric-600" : s >= 75 ? "text-teal-600" : s >= 60 ? "text-amber-600" : "text-warm-500";

const REC_BADGES = {
  INITIATE: { label: "Initiate", cls: "bg-electric-500 text-white" },
  MONITOR: { label: "Monitor", cls: "bg-warm-200 text-warm-700" },
  FOLLOW_UP: { label: "Follow-up", cls: "bg-amber-100 text-amber-700" },
};

const AGENT_BADGES = {
  LeadGen: { color: "bg-amber-50 text-amber-700 ring-amber-500/30", icon: Target },
  Researcher: { color: "bg-electric-50 text-electric-700 ring-electric-500/30", icon: Brain },
  RM: { color: "bg-warm-200 text-warm-800 ring-warm-400/40", icon: Users },
  AutoNavigator: { color: "bg-teal-50 text-teal-700 ring-teal-500/30", icon: Languages },
  AutoUnderwriter: { color: "bg-electric-50 text-electric-700 ring-electric-500/30", icon: Database },
  ComplianceNext: { color: "bg-emerald-50 text-emerald-700 ring-emerald-500/30", icon: ShieldCheck },
};

// ---------------------------------------------------------------------------
// Top-level RM Cockpit
// ---------------------------------------------------------------------------
export default function RMCockpit({ researchedSet, onResearched }) {
  const [stage, setStage] = useState("portfolio");
  const [trace, setTrace] = useState([]);
  const [running, setRunning] = useState(false);
  const [offer, setOffer] = useState(null);
  const [kfs, setKfs] = useState(null);
  const [disbursal, setDisbursal] = useState(null);

  useEffect(() => {
    if (window.location.search.includes("initiate=")) {
      // Auto-trigger initiate and clean URL to prevent re-triggering on reload
      initiate();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const initiate = async () => {
    setStage("reasoning");
    setTrace([]);
    setRunning(true);
    await runDeepScan(
      {
        borrower_id: "VIV",
        requested_amount_inr: 36_00_00_000,
        tenor_months: 24,
        purpose: "working_capital_post_ipo",
        anchor_buyer: "Bharat Heavy Electricals Ltd",
        research_completed: true,
      },
      setTrace,
      setOffer,
      setKfs,
    );
    setRunning(false);
  };

  const onDisburse = async () => {
    try {
      const data = await api.disburse({
        borrower_id: "VIV",
        sanctioned_amount_inr: offer?.sanctioned_amount_inr ?? 36_00_00_000,
        destination_handle: "vivid.electromech@futurebank",
        kfs_acknowledged: true,
        evaluation_window_completed: true,
      });
      setDisbursal(data);
    } catch (e) {
      setDisbursal(mockDisbursal(offer));
    }
  };

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs stage={stage} setStage={setStage} hasOffer={!!offer} />

      {stage === "portfolio" && (
        <PortfolioView
          researchedSet={researchedSet}
          onResearched={onResearched}
          onInitiate={initiate}
        />
      )}
      {stage === "reasoning" && (
        <ReasoningView
          trace={trace}
          running={running}
          offer={offer}
          onProceed={() => setStage("kfs")}
        />
      )}
      {stage === "kfs" && (
        <KFSView kfs={kfs} offer={offer} disbursal={disbursal} onDisburse={onDisburse} />
      )}
    </main>
  );
}

function Breadcrumbs({ stage, setStage, hasOffer }) {
  const crumbs = [
    { id: "portfolio", label: "Portfolio · God-View" },
    { id: "reasoning", label: "Active Agentic Reasoning" },
    { id: "kfs", label: "KFS · Compliance · Disbursal", disabled: !hasOffer },
  ];
  return (
    <nav className="flex items-center gap-2 text-xs text-warm-500 mb-4">
      {crumbs.map((c, i) => (
        <React.Fragment key={c.id}>
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-warm-400" />}
          <button
            disabled={c.disabled}
            onClick={() => !c.disabled && setStage(c.id)}
            className={`px-2 py-1 rounded transition ${
              stage === c.id
                ? "text-electric-600 font-semibold"
                : c.disabled
                ? "text-warm-300 cursor-not-allowed"
                : "hover:text-warm-800"
            }`}
          >
            {c.label}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Stage 1 — Portfolio
// ---------------------------------------------------------------------------
function PortfolioView({ researchedSet, onResearched, onInitiate }) {
  const [portfolio, setPortfolio] = useState([]);
  const [spotlight, setSpotlight] = useState(null);
  const [adminMeta, setAdminMeta] = useState({ has_admin_updates: false, latest_admin_batch: null });
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState("");

  const reload = () => {
    api.portfolio()
      .then((d) => {
        setPortfolio(d.clients);
        setAdminMeta({
          has_admin_updates: !!d.has_admin_updates,
          latest_admin_batch: d.latest_admin_batch,
        });
      })
      .catch((e) => setErr(e.message));
    api.spotlight().then(setSpotlight).catch(() => {});
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(
    () =>
      portfolio.filter(
        (c) =>
          !filter ||
          c.legal_name.toLowerCase().includes(filter.toLowerCase()) ||
          c.industry.toLowerCase().includes(filter.toLowerCase()),
      ),
    [portfolio, filter],
  );

  return (
    <div className="space-y-6">
      {adminMeta.has_admin_updates && (
        <AdminSyncBanner batchId={adminMeta.latest_admin_batch} onReload={reload} />
      )}
      <PortfolioStrip clients={portfolio} researchedSet={researchedSet} />
      {spotlight && (
        <AISpotlight
          spotlight={spotlight}
          researched={researchedSet.has(spotlight.client_id)}
          onResearch={() => navigate(`/research/${spotlight.client_id}`)}
          onInitiate={onInitiate}
        />
      )}
      <PortfolioTable
        clients={filtered}
        filter={filter}
        setFilter={setFilter}
        researchedSet={researchedSet}
        onResearch={(id) => navigate(`/research/${id}`)}
        onAdminResearch={(id) => navigate(`/research/${id}?source=admin`)}
        onInitiate={onInitiate}
      />
      {err && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">
          {err}
        </div>
      )}
    </div>
  );
}

function PortfolioStrip({ clients, researchedSet }) {
  if (!clients.length) return null;
  const totalGap = clients.reduce((s, c) => s + (c.wc_gap_cr || 0), 0);
  const initiateCount = clients.filter((c) => c.recommendation === "INITIATE").length;
  const stats = [
    { label: "MSME clients", value: clients.length, icon: Building2, tone: "electric" },
    {
      label: "Avg AI Lead Score",
      value: Math.round(clients.reduce((s, c) => s + c.ai_lead_score, 0) / clients.length),
      icon: Brain, tone: "teal",
    },
    {
      label: "Total WC opportunity",
      value: `₹${totalGap.toFixed(1)} Cr`,
      icon: TrendingUp, tone: "electric",
    },
    {
      label: "Researched / Initiate-ready",
      value: `${researchedSet.size} / ${initiateCount}`,
      icon: Target, tone: "amber",
    },
  ];
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-white border border-warm-200 rounded-xl p-4 flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              s.tone === "electric" ? "bg-electric-50 text-electric-600"
                : s.tone === "teal" ? "bg-teal-50 text-teal-600"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            <s.icon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-warm-900 leading-none">{s.value}</div>
            <div className="text-[11px] uppercase tracking-widest text-warm-500 mt-1">{s.label}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

function AISpotlight({ spotlight, researched, onResearch, onInitiate }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-electric-700 via-electric-600 to-teal-600 text-white shadow-xl shadow-electric-500/20">
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 800 300" preserveAspectRatio="none">
        <g stroke="white" strokeWidth="1" fill="none">
          <path d="M0 60 L200 60 L210 50 L260 50 L270 60 L800 60" />
          <path d="M0 130 L120 130 L130 140 L300 140 L310 130 L800 130" />
          <path d="M0 200 L380 200 L390 190 L500 190 L510 200 L800 200" />
          <circle cx="210" cy="50" r="3" fill="white" />
          <circle cx="510" cy="200" r="3" fill="white" />
        </g>
      </svg>

      <div className="relative p-6 lg:p-8 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1 text-[11px] uppercase tracking-widest font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            AI Spotlight · LeadGen agent
          </div>
          <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight mb-1">
            Vivid Electromech Limited
          </h2>
          <div className="text-white/75 text-sm mb-4">
            NSE Emerge listed · Mumbai · MIDC Andheri · NIC 27109
          </div>

          <p className="text-base lg:text-lg leading-relaxed text-white/95 mb-5 max-w-2xl">
            <span className="font-semibold">AutoNavigator</span> detected a{" "}
            <span className="font-bold text-teal-200">₹130 Cr IPO listing</span> and{" "}
            <span className="font-bold text-teal-200">74% Sales Growth</span>.{" "}
            <span className="font-semibold">AutoUnderwriter</span> identifies a{" "}
            <span className="font-bold text-teal-200">₹36 Cr working-capital gap</span>.
            Recommendation: <span className="font-bold">Initiate Loan Process.</span>
          </p>

          <div className="flex flex-wrap gap-2 mb-6">
            {spotlight.signals?.slice(0, 4).map((s) => (
              <span
                key={s.signal}
                className="text-[11px] bg-white/15 backdrop-blur ring-1 ring-white/20 rounded-full px-3 py-1.5"
              >
                <span className="font-semibold uppercase tracking-wider mr-1.5">
                  {s.signal.replace(/_/g, " ")}
                </span>
                · {s.detail}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onResearch}
              className="group inline-flex items-center gap-2.5 bg-white/15 hover:bg-white/25 backdrop-blur ring-1 ring-white/30 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition"
            >
              <Brain className="w-4 h-4 text-teal-200" />
              {researched ? "Re-open Strategic Briefing" : "Research & Analyze"}
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
            </button>
            <button
              onClick={onInitiate}
              disabled={!researched}
              className={`group inline-flex items-center gap-2.5 font-bold text-base px-6 py-3 rounded-xl shadow-lg shadow-black/20 transition ${
                researched
                  ? "bg-white text-electric-700 hover:bg-warm-50"
                  : "bg-white/30 text-white/70 cursor-not-allowed"
              }`}
            >
              <Zap className="w-5 h-5" />
              {researched ? "Initiate Loan Process" : "Initiate (research first)"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {!researched && (
            <div className="mt-3 text-[11px] text-white/70 inline-flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Initiate is gated — complete a Researcher briefing to unlock.
            </div>
          )}
        </div>

        <div className="bg-white/10 backdrop-blur ring-1 ring-white/15 rounded-2xl p-5 self-start">
          <div className="text-[11px] uppercase tracking-widest text-white/70 mb-3">AI Lead Score</div>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-black leading-none">{spotlight.ai_lead_score}</span>
            <span className="text-white/60 text-xl font-semibold">/100</span>
          </div>
          <div className="text-teal-200 font-bold text-sm mt-1 mb-4">STRATEGIC_PRIME</div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <Mini k="FY26 Sales" v="₹155.29 Cr" />
            <Mini k="YoY Growth" v="74%" tone="teal" />
            <Mini k="ROE" v="63.9%" tone="teal" />
            <Mini k="D/E" v="0.15" />
          </dl>
        </div>
      </div>
    </section>
  );
}

function Mini({ k, v, tone }) {
  return (
    <div className="bg-white/10 rounded-lg px-3 py-2">
      <div className={`font-bold text-base leading-tight ${tone === "teal" ? "text-teal-200" : "text-white"}`}>{v}</div>
      <div className="text-[10px] uppercase tracking-widest text-white/60 mt-0.5">{k}</div>
    </div>
  );
}

// "X ago" helper used by both the admin pill in the table and the sync banner
function humanAgo(when) {
  if (!when) return "—";
  const t = typeof when === "string" ? new Date(when).getTime() : when.getTime();
  const sec = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function AdminSyncBanner({ batchId, onReload }) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-electric-500 to-teal-500 text-white p-4 shadow-lg shadow-electric-500/20 flex items-start sm:items-center justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="leading-tight">
          <div className="font-extrabold text-base flex items-center gap-2">
            New Admin Updates Available
            <span className="text-[10px] uppercase tracking-widest bg-white/20 rounded-full px-2 py-0.5">
              Admin-Verified
            </span>
          </div>
          <div className="text-white/90 text-xs mt-0.5">
            The Admin Command Center has refreshed Strategic Briefings for one or
            more portfolio companies.
            {batchId && (
              <span className="ml-1 font-mono text-white/75">batch {batchId}</span>
            )}
          </div>
          <div className="text-white/85 text-[11px] mt-1">
            Click any “Admin · Xm ago” pill below to read the Admin pack — or run
            your own RM Deep-Dive for fresher data before Initiating.
          </div>
        </div>
      </div>
      <button
        onClick={onReload}
        className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur rounded-lg px-3 py-1.5 text-xs font-semibold"
      >
        Refresh portfolio
      </button>
    </div>
  );
}

function PortfolioTable({ clients, filter, setFilter, researchedSet, onResearch, onAdminResearch, onInitiate }) {
  return (
    <section className="bg-white border border-warm-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-warm-200 flex items-center justify-between gap-4">
        <div>
          <div className="font-bold text-warm-900">Portfolio · MSME clients</div>
          <div className="text-xs text-warm-500">
            Scores updated every 6h by LeadGen. Click Research before Initiate.
          </div>
        </div>
        <div className="relative w-72 max-w-full hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-warm-400" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search clients or industry..."
            className="w-full bg-warm-50 border border-warm-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric-500/30"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-50 text-[11px] uppercase tracking-widest text-warm-500">
              <th className="text-left px-5 py-3 font-semibold">Client</th>
              <th className="text-left px-3 py-3 font-semibold">Industry</th>
              <th className="text-right px-3 py-3 font-semibold">FY26 Sales</th>
              <th className="text-right px-3 py-3 font-semibold">YoY</th>
              <th className="text-right px-3 py-3 font-semibold">ROE</th>
              <th className="text-right px-3 py-3 font-semibold">D/E</th>
              <th className="text-right px-3 py-3 font-semibold">WC Gap</th>
              <th className="text-center px-3 py-3 font-semibold">Score</th>
              <th className="text-center px-3 py-3 font-semibold">Tier</th>
              <th className="text-center px-3 py-3 font-semibold">Research</th>
              <th className="text-center px-3 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const researched = researchedSet.has(c.id);
              const canInitiate = c.spotlight && researched;
              return (
                <tr
                  key={c.id}
                  className={`border-t border-warm-100 hover:bg-warm-50/60 ${
                    c.spotlight ? "bg-electric-50/30" : ""
                  }`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-electric-500 to-teal-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                        {c.short_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </div>
                      <div className="leading-tight">
                        <div className="font-semibold text-warm-900">
                          {c.short_name}
                          {c.spotlight && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-electric-600">
                              <Sparkles className="w-3 h-3" /> spotlight
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-warm-500 font-mono">{c.id} · {c.city}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-warm-700 text-xs">{c.industry}</td>
                  <td className="px-3 py-3 text-right font-semibold text-warm-900">₹{c.fy26_sales_cr.toFixed(2)} Cr</td>
                  <td className="px-3 py-3 text-right">
                    <span className={c.yoy_growth_pct >= 30 ? "text-teal-600 font-bold" : c.yoy_growth_pct >= 10 ? "text-warm-700" : "text-warm-500"}>
                      {c.yoy_growth_pct}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-warm-700">{c.roe_pct}%</td>
                  <td className="px-3 py-3 text-right text-warm-700">{c.debt_to_equity}</td>
                  <td className="px-3 py-3 text-right font-mono text-warm-700">₹{c.wc_gap_cr.toFixed(1)} Cr</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-lg font-extrabold ${SCORE_TONE(c.ai_lead_score)}`}>{c.ai_lead_score}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md ring-1 ${TIER_PILLS[c.tier] || TIER_PILLS.REVIEW}`}>
                      {c.tier.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {c.admin_verified && (
                        <button
                          onClick={() => onAdminResearch(c.id)}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ring-1 ${
                            c.admin_research_status === "FRESH"
                              ? "bg-teal-50 text-teal-700 ring-teal-500/30 hover:bg-teal-100"
                              : "bg-amber-50 text-amber-700 ring-amber-500/30 hover:bg-amber-100"
                          }`}
                          title={`Admin briefing · ${c.last_admin_update}`}
                        >
                          <Sparkles className="w-3 h-3" />
                          Admin · {humanAgo(c.last_admin_update)}
                        </button>
                      )}
                      <button
                        onClick={() => onResearch(c.id)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition ${
                          researched
                            ? "bg-teal-50 text-teal-700 ring-1 ring-teal-500/30 hover:bg-teal-100"
                            : "bg-electric-500 text-white hover:bg-electric-600"
                        }`}
                      >
                        {researched ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Researched
                          </>
                        ) : (
                          <>
                            <Brain className="w-3.5 h-3.5" /> RM Deep-Dive
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {c.spotlight ? (
                      <button
                        onClick={canInitiate ? onInitiate : undefined}
                        disabled={!canInitiate}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md ${
                          canInitiate
                            ? "bg-electric-500 text-white hover:bg-electric-600"
                            : "bg-warm-200 text-warm-500 cursor-not-allowed"
                        }`}
                        title={canInitiate ? "" : "Run Research first"}
                      >
                        <Zap className="w-3.5 h-3.5" /> Initiate
                      </button>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md ${REC_BADGES[c.recommendation]?.cls || "bg-warm-200 text-warm-600"}`}>
                        {REC_BADGES[c.recommendation]?.label || "View"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stage 2 — Active Agentic Reasoning
// ---------------------------------------------------------------------------
function ReasoningView({ trace, running, offer, onProceed }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [trace.length]);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2 bg-white border border-warm-200 rounded-2xl">
        <div className="px-5 py-4 border-b border-warm-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-electric-50 text-electric-600 flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-warm-900 text-sm">Active Agentic Reasoning · Deep Scan</div>
              <div className="text-[11px] text-warm-500">
                Vivid Electromech · ₹36 Cr · 24m · post-IPO working capital
              </div>
            </div>
          </div>
          {running ? (
            <span className="flex items-center gap-1.5 text-xs text-electric-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> agents working...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-teal-600 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> scan complete
            </span>
          )}
        </div>

        <div ref={scrollRef} className="px-5 py-4 space-y-2 font-mono text-[12.5px] max-h-[68vh] overflow-y-auto">
          {trace.length === 0 && (
            <div className="text-warm-500 italic text-sm py-8 text-center">
              Awaiting first frame from the standby agents...
            </div>
          )}
          {trace.map((line, i) => {
            const cfg = AGENT_BADGES[line.agent] || AGENT_BADGES.AutoNavigator;
            const Icon = cfg.icon;
            return (
              <div key={i} className="flex items-start gap-3 py-1.5 border-b border-warm-100 last:border-0">
                <span className="text-warm-400 text-[11px] mt-0.5 w-16 flex-shrink-0">{line.ts}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider ring-1 flex-shrink-0 ${cfg.color}`}>
                  <Icon className="w-3 h-3" />
                  {line.agent}
                </span>
                <span className="text-warm-800 leading-relaxed">{line.message}</span>
              </div>
            );
          })}
          {!running && trace.length > 0 && (
            <div className="pt-3">
              <button
                onClick={onProceed}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold"
              >
                Review KFS &amp; Compliance <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <AgentStatus name="LeadGen" desc="Continuously mines NSE Emerge + GST velocity for spotlight opportunities" status="Spotlight live" />
        <AgentStatus name="Researcher" desc="Gemini-backed Strategic Briefing — RM-only, gates Initiate" status="Briefing accepted" />
        <AgentStatus name="AutoNavigator" desc="Multimodal · Bhashini-style language layer for the borrower" status={trace.length ? "Intent captured" : "Idle"} />
        <AgentStatus name="AutoUnderwriter" desc="Standby until Initiate. Pulls NSE/GST/ULI/AA in parallel" status={offer ? `Tier ${offer.tier.replace(/_/g, " ")}` : "Working..."} />
        <AgentStatus name="ComplianceNext" desc="RBI 2026 FPC + SEBI ICDR gate · KFS v4 (all-inclusive APR)" status={offer ? "Verdict: PASS" : "Standby"} />
        {offer && (
          <div className="bg-white border border-warm-200 rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-warm-500 mb-3">Offer summary</div>
            <dl className="space-y-1.5 text-xs">
              <Row k="Tier" v={offer.tier.replace(/_/g, " ")} />
              <Row k="Sanctioned" v={cr(offer.sanctioned_amount_inr)} />
              <Row k="Tenor" v={`${offer.tenor_months} months`} />
              <Row k="Nominal rate" v={`${offer.interest_rate_pct}%`} />
              <Row k="APR (all-inclusive)" v={`${offer.apr_all_inclusive_pct}%`} highlight />
              <Row k="Monthly EMI" v={`₹${inr(offer.emi_inr)}`} />
              <Row k="DSCR" v={offer.dscr_projected} />
              <Row k="Risk band" v={offer.risk_band} />
            </dl>
          </div>
        )}
      </aside>
    </div>
  );
}

function AgentStatus({ name, desc, status }) {
  const cfg = AGENT_BADGES[name];
  const Icon = cfg.icon;
  return (
    <div className="bg-white border border-warm-200 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ring-1 ${cfg.color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-warm-900 text-sm font-semibold leading-tight">{name}</div>
            <div className="text-[10px] uppercase tracking-widest text-warm-500 mt-0.5">agent</div>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-md ring-1 ${cfg.color}`}>{status}</span>
      </div>
      <p className="text-xs text-warm-600 mt-2 leading-relaxed">{desc}</p>
    </div>
  );
}

function Row({ k, v, highlight }) {
  return (
    <div className="flex justify-between items-baseline">
      <dt className="text-warm-500">{k}</dt>
      <dd className={`font-semibold ${highlight ? "text-electric-600 text-sm" : "text-warm-900"}`}>{v}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage 3 — KFS + Disbursal
// ---------------------------------------------------------------------------
function KFSView({ kfs, offer, disbursal, onDisburse }) {
  const [acked, setAcked] = useState(false);
  const [evalDone, setEvalDone] = useState(false);
  const [pulsing, setPulsing] = useState(false);

  if (!kfs || !offer) {
    return (
      <div className="text-center py-20 text-warm-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" /> Awaiting KFS render...
      </div>
    );
  }

  const handleTap = async () => {
    if (!acked || !evalDone || disbursal) return;
    setPulsing(true);
    await onDisburse();
    setPulsing(false);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <KFSDocument kfs={kfs} />

      <aside className="space-y-4 sticky top-20 self-start">
        <div className="bg-white border border-warm-200 rounded-2xl p-5">
          <div className="text-[11px] uppercase tracking-widest text-warm-500 mb-1">Disbursal authorisation</div>
          <div className="text-3xl font-extrabold text-warm-900 flex items-baseline gap-1">
            <IndianRupee className="w-6 h-6 text-electric-600" />{inr(offer.sanctioned_amount_inr)}
          </div>
          <div className="text-xs text-warm-500 mt-1">
            Routed via <span className="font-semibold text-electric-600">RTGS</span> to{" "}
            <span className="font-mono text-teal-600">vivid.electromech@futurebank</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <Stat label="Tier" value={offer.tier.replace(/_/g, " ")} />
            <Stat label="DSCR" value={offer.dscr_projected.toFixed(2)} />
            <Stat label="EMI" value={`₹${inr(offer.emi_inr)}`} />
            <Stat label="APR" value={`${offer.apr_all_inclusive_pct}%`} highlight />
          </div>

          <label className="mt-5 flex items-start gap-2 cursor-pointer text-xs text-warm-700">
            <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} className="mt-0.5 w-4 h-4 accent-electric-500" />
            <span>I confirm the borrower has acknowledged the KFS via the MSME portal e-sign flow.</span>
          </label>
          <label className="mt-2 flex items-start gap-2 cursor-pointer text-xs text-warm-700">
            <input type="checkbox" checked={evalDone} onChange={(e) => setEvalDone(e.target.checked)} className="mt-0.5 w-4 h-4 accent-electric-500" />
            <span>The mandatory <span className="font-bold">3-day evaluation period</span> required by RBI 2026 FPC has been completed (
              <Calendar className="inline w-3 h-3 -mt-0.5" /> ends{" "}
              <span className="font-mono">{new Date(kfs.evaluation_window_ends_at).toLocaleString("en-IN")}</span>).
            </span>
          </label>

          {!disbursal ? (
            <button
              disabled={!acked || !evalDone || pulsing}
              onClick={handleTap}
              className={`mt-4 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-base transition ${
                acked && evalDone
                  ? "bg-electric-500 hover:bg-electric-600 text-white shadow-lg shadow-electric-500/30"
                  : "bg-warm-200 text-warm-500 cursor-not-allowed"
              }`}
            >
              {pulsing ? (<><Loader2 className="w-5 h-5 animate-spin" /> Disbursing via RTGS...</>) : (<><Zap className="w-5 h-5" /> Authorise disbursal</>)}
            </button>
          ) : (
            <div className="mt-4 rounded-xl bg-teal-50 border border-teal-500/30 p-4">
              <div className="flex items-center gap-2 text-teal-700 font-bold">
                <CheckCircle2 className="w-5 h-5" /> Disbursed successfully
              </div>
              <div className="mt-2 text-xs text-warm-700 space-y-1">
                <div>Amount: <span className="font-semibold">₹{inr(disbursal.amount_inr)}</span></div>
                <div>Rail: <span className="font-semibold text-electric-600">{disbursal.rail}</span></div>
                <div>Reference: <span className="font-mono text-teal-600">{disbursal.rail_reference}</span></div>
                <div>Settled at: {disbursal.settled_at}</div>
                <div className="text-[10px] text-warm-400 break-all pt-1">Audit hash → {disbursal.audit_hash}</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-warm-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-warm-600 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
            <span className="font-semibold">RBI 2026 + SEBI ICDR gate</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-warm-600">
            {kfs.compliance_checks.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                {c.id.replace(/_/g, " ").toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="bg-warm-50 rounded-lg py-2">
      <div className={`text-sm font-bold truncate ${highlight ? "text-electric-600" : "text-warm-900"}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-warm-500 mt-0.5">{label}</div>
    </div>
  );
}

function KFSDocument({ kfs }) {
  return (
    <section className="lg:col-span-2 bg-white border border-warm-200 rounded-2xl shadow-xl shadow-electric-500/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-warm-200 flex items-center justify-between bg-gradient-to-r from-electric-50 via-white to-teal-50">
        <div className="flex items-center gap-3">
          <Logo size={28} />
          <div className="leading-tight">
            <div className="text-sm font-extrabold text-warm-900">KEY FACT STATEMENT</div>
            <div className="text-[10px] uppercase tracking-widest text-warm-500">{kfs.bank.name} · {kfs.version}</div>
          </div>
        </div>
        <span className="text-[10px] font-mono text-warm-500">{kfs.kfs_id}</span>
      </div>

      <div className="p-6 space-y-5 text-sm">
        <KFSSection title="Borrower">
          <KV k="Legal name" v={kfs.borrower.legal_name} />
          <KV k="CIN" v={kfs.borrower.cin} mono />
          <KV k="Udyam ID" v={kfs.borrower.udyam_id} mono />
          <KV k="Promoter" v={kfs.borrower.promoter} />
          <KV k="Address" v={kfs.borrower.address} />
        </KFSSection>

        <KFSSection title="Lender">
          <KV k="Name" v={kfs.bank.name} />
          <KV k="Tagline" v={kfs.bank.tagline} />
          <KV k="RBI registration" v={kfs.bank.rbi_registration} mono />
          <KV k="Registered office" v={kfs.bank.registered_office} />
        </KFSSection>

        <KFSSection title="Loan terms">
          <KV k="Sanctioned amount" v={cr(kfs.loan_terms.sanctioned_amount_inr)} big />
          <KV k="Tenor" v={`${kfs.loan_terms.tenor_months} months`} />
          <KV k="Tier" v={kfs.loan_terms.tier.replace(/_/g, " ")} />
          <KV k="Risk band" v={kfs.loan_terms.risk_band} />
          <KV k="Interest rate" v={`${kfs.loan_terms.interest_rate_pct}% p.a. (FIXED)`} />
          <KV k="Monthly EMI" v={`₹${inr(kfs.loan_terms.emi_inr)}`} big />
          <KV k="Disbursement" v={kfs.loan_terms.disbursement_rail} />
          <KV k="Purpose" v={kfs.loan_terms.purpose} />
        </KFSSection>

        <div className="rounded-xl bg-electric-500 text-white px-5 py-4 flex items-center justify-between shadow-md shadow-electric-500/20">
          <div>
            <div className="text-[11px] uppercase tracking-widest opacity-90 font-semibold">All-Inclusive APR</div>
            <div className="text-[10px] opacity-75 mt-0.5">includes processing fee, GST, stamp, insurance</div>
          </div>
          <span className="text-4xl font-black tracking-tight">{kfs.apr_all_inclusive_pct}%</span>
        </div>

        <KFSSection title="Fees & Charges (annualised into APR above)">
          <KV k="Processing fee (0.85%)" v={`₹${inr(kfs.fees_and_charges.processing_fee_inr)}`} />
          <KV k="GST on processing fee" v={`₹${inr(kfs.fees_and_charges.gst_on_fees_inr)}`} />
          <KV k="Stamp duty" v={`₹${inr(kfs.fees_and_charges.stamp_duty_inr)}`} />
          <KV k="Loan-protect insurance (0.35%)" v={`₹${inr(kfs.fees_and_charges.insurance_premium_inr)}`} />
          <KV k="Prepayment charge" v={`₹${inr(kfs.fees_and_charges.prepayment_charge_inr)}`} />
          <KV k="Late payment penalty" v={`₹${inr(kfs.fees_and_charges.late_payment_penalty_inr)} per occurrence`} />
        </KFSSection>

        <div className="rounded-xl bg-teal-50 border border-teal-500/30 px-4 py-3 text-sm text-warm-800">
          <div className="flex items-center gap-2 font-semibold text-teal-700 mb-1">
            <Calendar className="w-4 h-4" /> Mandatory 3-day evaluation period
          </div>
          You may withdraw from this loan, without any charge, until{" "}
          <span className="font-mono font-semibold">{new Date(kfs.evaluation_window_ends_at).toLocaleString("en-IN")}</span>.
          Disbursal will not occur before this window closes.
        </div>

        <KFSSection title="Listed-entity disclosure (SEBI ICDR)">
          <KV k="Listed on" v={`${kfs.listed_entity_disclosure.exchange} · ${kfs.listed_entity_disclosure.symbol}`} />
          <KV k="Board resolution" v={`Dated ${kfs.listed_entity_disclosure.board_resolution_dated}`} />
          <KV k="ICDR status" v={kfs.listed_entity_disclosure.sebi_icdr_status} />
        </KFSSection>

        <KFSSection title="Grievance redressal">
          <KV k="Officer" v={kfs.grievance_officer.name} />
          <KV k="Designation" v={kfs.grievance_officer.designation} />
          <KV k="Email" v={kfs.grievance_officer.email} mono />
          <KV k="Phone" v={kfs.grievance_officer.phone} mono />
        </KFSSection>

        <KFSSection title="Consent artefacts (DEPA 2.0)">
          {kfs.consent_artefacts.map((c) => (
            <div key={c.id} className="font-mono text-[11px] text-warm-700 flex items-center gap-2">
              <Lock className="w-3 h-3 text-teal-500" />
              <span className="font-semibold uppercase tracking-wider text-[10px] text-warm-500 mr-1.5">{c.rail}</span>
              {c.id}
            </div>
          ))}
        </KFSSection>

        <div className="pt-3 border-t border-warm-200 flex justify-between text-xs text-warm-500">
          <span>Issued at <span className="font-mono">{kfs.issued_at}</span></span>
          <span className="inline-flex items-center gap-1 text-teal-700 font-semibold">
            <ShieldCheck className="w-4 h-4" /> ComplianceNext: {kfs.compliance_verdict}
          </span>
        </div>
      </div>
    </section>
  );
}

function KFSSection({ title, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-warm-500 font-bold mb-2">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function KV({ k, v, mono, big }) {
  return (
    <div className="flex justify-between gap-3 items-baseline">
      <span className="text-warm-500 text-xs">{k}</span>
      <span className={`text-right ${big ? "text-base font-bold text-warm-900" : "text-sm text-warm-900"} ${mono ? "font-mono text-xs" : ""}`}>{v}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deep-scan runner
// ---------------------------------------------------------------------------
async function runDeepScan(req, setTrace, setOffer, setKfs) {
  try {
    const res = await fetch(api.traceUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop();
        for (const p of parts) {
          const line = p.trim().replace(/^data:\s*/, "");
          if (!line || line === "[DONE]") continue;
          try {
            const obj = JSON.parse(line.replace(/'/g, '"'));
            setTrace((t) => [...t, obj]);
          } catch {}
        }
      }
      const offer = await api.score(req);
      setOffer(offer);
      const kfs = await api.kfs(req);
      setKfs(kfs);
      return;
    }
  } catch {
    /* fall through */
  }
  for (const [agent, msg] of LOCAL_FRAMES) {
    await new Promise((r) => setTimeout(r, 460));
    setTrace((t) => [...t, { ts: new Date().toISOString().substring(11, 19), agent, message: msg }]);
  }
  setOffer(MOCK_OFFER);
  setKfs(MOCK_KFS);
}

const LOCAL_FRAMES = [
  ["LeadGen", "Spotlight pre-armed: Vivid Electromech · score 96/100."],
  ["Researcher", "Strategic Briefing reviewed by RM: PROCEED_TO_INITIATE."],
  ["RM", "Anjali Krishnan clicked [Initiate Loan Process] for VIVIDEM."],
  ["AutoNavigator", "RM-led intent captured: working_capital_post_ipo · ₹36 Cr · tenor 24m."],
  ["AutoUnderwriter", "Standby → ACTIVE. Beginning deep-rail validation."],
  ["AutoUnderwriter", "Composite scorecard → tier=STRATEGIC_PRIME, nominal rate 9.85%."],
  ["ComplianceNext", "Verdict: PASS. APR (all-inclusive) 10.34%."],
];
const MOCK_OFFER = {
  tier: "STRATEGIC_PRIME", sanctioned_amount_inr: 36_00_00_000,
  interest_rate_pct: 9.85, apr_all_inclusive_pct: 10.34,
  tenor_months: 24, processing_fee_inr: 30_60_000, insurance_premium_inr: 12_60_000,
  stamp_duty_inr: 5000, emi_inr: 16_55_200, dscr_projected: 1.62, risk_band: "AAA",
};
const MOCK_KFS = {
  kfs_id: "KFS-LOCAL-VIV", version: "RBI-FPC-2026-v4-all-inclusive",
  issued_at: new Date().toISOString(),
  bank: { name: "Future Bank of India", tagline: "Innovating the Indian Dream.",
          rbi_registration: "N-13.02458", registered_office: "FBI House, BKC, Mumbai 400051" },
  borrower: { legal_name: "Vivid Electromech Limited", cin: "U29309MH2014PLC123456",
              udyam_id: "UDYAM-MH-19-0098765", promoter: "Suresh R. Mehta",
              address: "Plot 27/A, MIDC Andheri, Mumbai 400093" },
  loan_terms: { sanctioned_amount_inr: 36_00_00_000, tenor_months: 24,
                interest_rate_pct: 9.85, rate_type: "FIXED", emi_inr: 16_55_200,
                repayment_frequency: "MONTHLY", disbursement_rail: "RTGS (>₹2 Cr per NPCI cap)",
                purpose: "working_capital_post_ipo", tier: "STRATEGIC_PRIME", risk_band: "AAA" },
  fees_and_charges: { processing_fee_inr: 30_60_000, gst_on_fees_inr: 5_50_800,
                      stamp_duty_inr: 5000, insurance_premium_inr: 12_60_000,
                      prepayment_charge_inr: 0, late_payment_penalty_inr: 25_000 },
  apr_all_inclusive_pct: 10.34, evaluation_period_days: 3,
  evaluation_window_ends_at: new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
  grievance_officer: { name: "Ms. Priya Iyer",
                       designation: "Nodal Grievance Officer, Future Bank of India",
                       email: "grievance@futurebankindia.in", phone: "+91-22-6111-9000" },
  recovery_partners: ["Resolute Recovery Services Pvt Ltd"],
  consent_artefacts: [
    { id: "NSE-CONSENT-2026-1f4a02", rail: "NSE Emerge" },
    { id: "GST-CONSENT-2026-9c4a1b", rail: "GSTN" },
    { id: "ULI-CONSENT-2026-7d2e8f", rail: "ULI" },
    { id: "AA-CONSENT-2026-3b9f10", rail: "Sahamati AA" },
  ],
  listed_entity_disclosure: { is_listed: true, exchange: "NSE Emerge", symbol: "VIVIDEM",
                              board_resolution_dated: "2026-04-22", sebi_icdr_status: "COMPLIANT" },
  compliance_checks: [
    { id: "RESEARCH_BRIEFING_REVIEWED", status: "PASS" },
    { id: "KFS_GENERATED", status: "PASS" }, { id: "APR_ALL_INCLUSIVE", status: "PASS" },
    { id: "APR_PROMINENT", status: "PASS" }, { id: "EVALUATION_PERIOD_3D", status: "PASS" },
    { id: "NO_DARK_PATTERNS", status: "PASS" }, { id: "GRIEVANCE_OFFICER_LISTED", status: "PASS" },
    { id: "CONSENT_ARTEFACT_VALID", status: "PASS" }, { id: "LISTED_ENTITY_DISCLOSURE_OK", status: "PASS" },
  ],
  compliance_verdict: "PASS",
};
function mockDisbursal(offer) {
  return {
    status: "SUCCESS", rail: "RTGS",
    amount_inr: offer?.sanctioned_amount_inr ?? 36_00_00_000,
    credited_to: "vivid.electromech@futurebank",
    rail_reference: "RTGS" + Math.floor(Math.random() * 1e12),
    settled_at: new Date().toISOString(),
    audit_hash: "sha256:" + Math.random().toString(16).slice(2, 34),
  };
}
