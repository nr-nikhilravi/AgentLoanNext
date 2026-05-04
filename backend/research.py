"""
AgentLoanNext — Researcher Agent
================================
Calls Google Gemini to produce a Strategic Briefing for the RM.
Falls back to a curated, deterministic briefing if GEMINI_API_KEY is
unset or the API call fails — so the RM workflow is never blocked.

The Researcher's contract (matches `.agents/agents.md`):
  - executive_summary
  - risk_vs_opportunity (balanced ledger)
  - recent_news (with citations)
  - sector_outlook
  - financial_snapshot
  - red_flags
  - rm_recommendation
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

# Cache TTL: 4 hours. Keep cache scoped to process — fine for Cloud Run revisions.
_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}
_CACHE_TTL_SECONDS = 4 * 3600

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")


# ---------------------------------------------------------------------------
# Curated fallback briefings (used when GEMINI_API_KEY is missing)
# ---------------------------------------------------------------------------

FALLBACK_BRIEFINGS: Dict[str, Dict[str, Any]] = {
    "VIV": {
        "company": "Vivid Electromech Limited",
        "executive_summary": (
            "Vivid Electromech is a high-conviction lead. Post-IPO momentum, anchor-buyer "
            "diversification (BHEL, L&T, Siemens, Tata Power), and disciplined leverage "
            "(D/E 0.15) all point to a clean STRATEGIC_PRIME underwrite. Recommend Initiate."
        ),
        "risk_vs_opportunity": [
            ("Opportunity", "₹130 Cr IPO oversubscribed 27.4x signals strong investor confidence."),
            ("Opportunity", "74% YoY growth backed by ₹89 Cr order book — visibility into FY27."),
            ("Opportunity", "ROE 63.9% with low leverage means new debt is highly accretive."),
            ("Risk",        "Receivables days at 64 — heavy concentration in PSU buyers (BHEL, L&T)."),
            ("Risk",        "MIDC leasehold parcel renewal due 2031 — covenant the lease assignment."),
            ("Risk",        "IPO use-of-proceeds includes Khopoli expansion — execution risk on capex."),
        ],
        "recent_news": [
            "Vivid Electromech listing oversubscribed 27.4x on NSE Emerge (Apr 2026, source: NSE bulletin)",
            "BHEL awards ₹38 Cr 5-year supply contract for industrial drives (Mar 2026, source: BHEL press release)",
            "Industry: Indian electromech market projected 12% CAGR through 2030 (CRISIL, Feb 2026)",
            "Vivid Electromech files board resolution authorising ₹50 Cr WC facility (Apr 22, 2026)",
        ],
        "sector_outlook": (
            "Electric motors & generators (NIC 27109) is in a structural growth phase: PLI scheme "
            "for capital goods (extended 2025), rural electrification push, and renewables capex "
            "are tailwinds. Headwinds: copper price volatility and Chinese import competition in "
            "the sub-1HP segment. Vivid plays in the 5-50HP industrial band — relatively insulated."
        ),
        "financial_snapshot": {
            "market_cap_inr_cr": 294.0,
            "current_price_inr": 196,
            "issue_price_inr": 142,
            "30d_move_pct": 38.0,
            "peer_pe_avg": 24.6,
            "vivid_pe": 13.8,   # cheap on absolute basis vs peer
        },
        "red_flags": [
            "None material. No litigation, no regulatory orders, no auditor qualifications.",
        ],
        "rm_recommendation": {
            "verdict": "PROCEED_TO_INITIATE",
            "rationale": "Strong financial profile, clean compliance, board resolution in place. "
                         "Initiate ₹36 Cr WC line at STRATEGIC_PRIME tier.",
        },
    },
    "SUR": {
        "company": "Surya Solars Pvt Ltd",
        "executive_summary": (
            "Surya Solars is a credible PRIME lead. Strong execution on a recently won state "
            "DISCOM tender, but customer concentration and DISCOM payment discipline remain "
            "watch items. Recommend Initiate at PRIME with covenants on receivables aging."
        ),
        "risk_vs_opportunity": [
            ("Opportunity", "Won 80MW Karnataka DISCOM EPC contract — ₹140 Cr order pipeline."),
            ("Opportunity", "Module prices declining 8-12% YoY — margin tailwind."),
            ("Risk",        "DISCOM receivables historically slow — model 90+ day collection."),
            ("Risk",        "D/E 0.42 already includes equipment financing — limit fresh debt headroom."),
        ],
        "recent_news": [
            "Karnataka DISCOM signs 80MW PPA with Surya Solars (Apr 2026)",
            "MNRE notification: ALMM list expanded — eases module sourcing",
            "Sector: India solar EPC TAM ~₹1.2 lakh Cr by 2030 (Mercom)",
        ],
        "sector_outlook": (
            "Solar EPC is expanding aggressively post the 500GW-by-2030 mandate. Risks lie in "
            "DISCOM payment cycles and inverted-duty structure on cell imports."
        ),
        "financial_snapshot": {
            "market_cap_inr_cr": None,
            "current_price_inr": None,
            "issue_price_inr": None,
            "30d_move_pct": None,
            "peer_pe_avg": 22.3,
            "vivid_pe": None,
        },
        "red_flags": [
            "Receivables aging > 90 days at 32% of book — covenant required.",
        ],
        "rm_recommendation": {
            "verdict": "PROCEED_TO_INITIATE",
            "rationale": "Underwrite PRIME tier; insist on receivables-backed structure.",
        },
    },
    "ARZ": {
        "company": "Arzo Tech Industries Pvt Ltd",
        "executive_summary": (
            "Arzo Tech is a NEAR_PRIME lead. Stable filings but exposed to Tier-2 OEMs whose "
            "EV transition is compressing ICE auto-component demand. Defer to next quarter."
        ),
        "risk_vs_opportunity": [
            ("Opportunity", "Loyal Tier-2 OEM relationships (15+ years) provide steady run-rate."),
            ("Opportunity", "Filings hygiene clean — no compliance issues."),
            ("Risk",        "EV transition shrinks ICE-component TAM — 11% YoY growth flattering."),
            ("Risk",        "D/E 0.78 already elevated; further debt would breach covenant."),
        ],
        "recent_news": [
            "Pune auto-cluster reports 6% Q1 volume decline (SIAM, Apr 2026)",
            "Bosch India to phase out ICE injector lines by 2028 — Arzo a Tier-3 supplier",
        ],
        "sector_outlook": (
            "ICE auto-components in structural decline. EV-component pivot needed within 18 months."
        ),
        "financial_snapshot": {
            "market_cap_inr_cr": None,
            "current_price_inr": None,
            "issue_price_inr": None,
            "30d_move_pct": None,
            "peer_pe_avg": 16.8,
            "vivid_pe": None,
        },
        "red_flags": [
            "OEM customer concentration — top 3 buyers = 71% of revenue.",
        ],
        "rm_recommendation": {
            "verdict": "DEFER",
            "rationale": "Schedule a strategic review on EV transition before extending limit.",
        },
    },
    "BLU": {
        "company": "Blue Ocean Logistics Pvt Ltd",
        "executive_summary": (
            "Blue Ocean is a REVIEW lead. Diesel cost squeeze and one GSTR-3B late filing "
            "suggest underlying cash strain. Recommend a follow-up call before any new limit."
        ),
        "risk_vs_opportunity": [
            ("Opportunity", "Cold-chain TAM growing 14% CAGR — long-term thesis intact."),
            ("Risk",        "Diesel-linked cost base + thin margins — vulnerable to fuel shocks."),
            ("Risk",        "D/E 1.10 — already over conservative bank covenant of 0.85."),
            ("Risk",        "GSTR-3B filed late once in last 12 months — early warning signal."),
        ],
        "recent_news": [
            "Diesel prices up 9% in Q1 — pharma cold-chain operators report margin pressure",
            "GST Council clarifies cold-chain ITC eligibility (Mar 2026) — net positive",
        ],
        "sector_outlook": (
            "Cold-chain logistics is structurally attractive but margin-constrained near term."
        ),
        "financial_snapshot": {
            "market_cap_inr_cr": None,
            "current_price_inr": None,
            "issue_price_inr": None,
            "30d_move_pct": None,
            "peer_pe_avg": 14.2,
            "vivid_pe": None,
        },
        "red_flags": [
            "GSTR-3B late filing (Jan 2026) — request explanation before any decision.",
            "Leverage above covenant — likely covenant waiver request before fresh sanction.",
        ],
        "rm_recommendation": {
            "verdict": "DEFER",
            "rationale": "Trigger relationship-call workflow; do not Initiate at this time.",
        },
    },
}


# ---------------------------------------------------------------------------
# Prompt template for Gemini
# ---------------------------------------------------------------------------

def _build_prompt(company: Dict[str, Any]) -> str:
    return f"""You are Researcher, an AI agent for Future Bank of India's relationship managers.
You produce concise Strategic Briefings on prospective MSME borrowers. Your audience is the
RM; the borrower must NEVER see this briefing.

Company under review:
- Legal name: {company.get('legal_name')}
- Industry: {company.get('industry')}
- City: {company.get('city')}
- FY26 Sales: ₹{company.get('fy26_sales_cr')} Cr
- YoY Growth: {company.get('yoy_growth_pct')}%
- ROE: {company.get('roe_pct')}%
- Debt/Equity: {company.get('debt_to_equity')}
- Estimated WC gap: ₹{company.get('wc_gap_cr')} Cr
- AI Lead Score: {company.get('ai_lead_score')}/100

Produce a JSON object with this exact schema:
{{
  "company": "...",
  "executive_summary": "≤80 words — is this lead worth initiating?",
  "risk_vs_opportunity": [["Opportunity"|"Risk", "1-line"], ...],
  "recent_news": ["item with rough source attribution", ...],   // 3-5 items
  "sector_outlook": "2-3 sentences on macro tailwinds/headwinds",
  "financial_snapshot": {{
    "market_cap_inr_cr": number-or-null,
    "current_price_inr": number-or-null,
    "issue_price_inr": number-or-null,
    "30d_move_pct": number-or-null,
    "peer_pe_avg": number-or-null,
    "vivid_pe": number-or-null
  }},
  "red_flags": ["litigation/governance/supply-chain/ESG findings", ...],
  "rm_recommendation": {{
    "verdict": "PROCEED_TO_INITIATE"|"DEFER"|"DECLINE",
    "rationale": "1 line"
  }}
}}

Use grounded, citable facts where possible. If you are uncertain on a specific
claim, omit it rather than fabricating. Respond with ONLY the JSON, no prose.
"""


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_research(company: Dict[str, Any], force_refresh: bool = False) -> Dict[str, Any]:
    """
    Returns a Strategic Briefing dict. Tries Gemini first; falls back to a
    curated briefing if the call fails. Always tags `source` so the RM knows
    whether they're reading live intel or a cached/curated briefing.
    """
    company_id = company.get("id", "UNKNOWN")
    cache_key = f"briefing:{company_id}"
    if not force_refresh and cache_key in _CACHE:
        ts, cached = _CACHE[cache_key]
        if time.time() - ts < _CACHE_TTL_SECONDS:
            return cached

    briefing: Optional[Dict[str, Any]] = None
    source = "GEMINI_LIVE"
    error: Optional[str] = None

    if GEMINI_API_KEY:
        try:
            briefing = _call_gemini(company)
        except Exception as e:
            error = f"{type(e).__name__}: {e}"
            briefing = None

    if briefing is None:
        # Fallback to curated briefing
        fallback = FALLBACK_BRIEFINGS.get(company_id)
        if fallback is None:
            fallback = FALLBACK_BRIEFINGS["VIV"]   # ultimate safety net
        briefing = dict(fallback)
        source = "CURATED_FALLBACK" if not GEMINI_API_KEY else "GEMINI_FALLBACK"

    briefing["meta"] = {
        "researcher_agent": "Researcher",
        "model": GEMINI_MODEL if source == "GEMINI_LIVE" else None,
        "source": source,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "company_id": company_id,
        "audience": "rm_only",
        "error": error,
    }

    _CACHE[cache_key] = (time.time(), briefing)
    return briefing


def _call_gemini(company: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Call Gemini and parse the JSON response. Raises on any failure."""
    import google.generativeai as genai   # imported lazily so the module loads
                                          # even if google-generativeai isn't installed

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)
    prompt = _build_prompt(company)
    resp = model.generate_content(
        prompt,
        generation_config={
            "temperature": 0.4,
            "max_output_tokens": 2048,
            "response_mime_type": "application/json",
        },
    )
    text = (resp.text or "").strip()
    # Strip markdown code fences if Gemini wraps the JSON
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.rsplit("```", 1)[0]
    return json.loads(text)
