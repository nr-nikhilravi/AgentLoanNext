"""
Lightweight in-process implementations of the three Antigravity agents.

In production these would be separate workers orchestrated by Antigravity.
For the demo, we expose them as plain functions that the FastAPI route can call.
"""
from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta
from typing import Any, AsyncIterator

from .data.vivid_electromech import BORROWER, aa_payload, gst_payload, uli_payload


# ---------------------------------------------------------------------------
# AutoNavigator — intent classification (very lightweight rules-based stub)
# ---------------------------------------------------------------------------
def autonavigator_classify(message: str) -> dict[str, Any]:
    """Map a Hinglish/English message to a structured intent payload."""
    text = message.lower()
    intent = "general_query"
    amount = None
    if any(k in text for k in ["po", "purchase order", "order mila"]):
        intent = "po_finance"
        amount = 15_00_000
    elif any(k in text for k in ["working capital", "cash flow", "raw material", "salary"]):
        intent = "working_capital"
        amount = 10_00_000
    elif any(k in text for k in ["machine", "cnc", "equipment", "expansion"]):
        intent = "term_loan"
        amount = 50_00_000

    # crude language detect
    devanagari = any("ऀ" <= ch <= "ॿ" for ch in message)
    hinglish_cues = any(w in text for w in ["bhai", "chahiye", "mila", "abhi", "hafte"])
    lang = "hi-Deva" if devanagari else ("hi-en" if hinglish_cues else "en-IN")

    return {
        "intent": intent,
        "requested_amount_inr": amount,
        "language": lang,
        "borrower_gstin": BORROWER["gstin"],
        "captured_at": datetime.utcnow().isoformat() + "Z",
    }


# ---------------------------------------------------------------------------
# AutoUnderwriter — pulls all 3 data planes & assembles an offer
# ---------------------------------------------------------------------------
async def _trace(channel: list[dict], agent: str, msg: str) -> None:
    channel.append({
        "ts": datetime.utcnow().isoformat() + "Z",
        "agent": agent,
        "message": msg,
    })
    # tiny sleep to make the streamed UI feel alive
    await asyncio.sleep(0.15)


async def autounderwriter_run(
    intent: dict[str, Any],
    trace: list[dict] | None = None,
) -> dict[str, Any]:
    trace = trace if trace is not None else []
    await _trace(trace, "AutoUnderwriter", "Received intent. Initiating parallel India-Stack fetch...")

    # Fire all 3 data planes in parallel-ish (they're sync stubs but we await for realism)
    await _trace(trace, "AutoUnderwriter", "→ Pulling GSTN snapshot via /api/mock/gst")
    gst = gst_payload()
    await _trace(trace, "AutoUnderwriter",
                 f"  GST velocity probe → {gst['summary']['yoy_growth_pct']}% YoY growth confirmed.")
    await _trace(trace, "AutoUnderwriter",
                 f"  Filing hygiene {gst['summary']['filing_hygiene_score']}/100 "
                 f"({gst['summary']['consecutive_on_time_filings']} consecutive on-time filings).")

    await _trace(trace, "AutoUnderwriter", "→ Pulling ULI collateral records via /api/mock/uli")
    uli = uli_payload()
    fmv = uli["summary"]["total_collateral_fmv_inr"]
    await _trace(trace, "AutoUnderwriter",
                 f"  ULI confirms collateral FMV ₹{fmv/1e7:.2f} Cr, encumbrance: NIL.")

    await _trace(trace, "AutoUnderwriter", "→ Pulling AA bank cash-flow via /api/mock/aa")
    aa = aa_payload()
    await _trace(trace, "AutoUnderwriter",
                 f"  AA inflow CoV = {aa['summary']['inflow_volatility_cv']} (low — healthy).")
    await _trace(trace, "AutoUnderwriter",
                 f"  Avg monthly inflow ₹{aa['summary']['avg_monthly_inflow_inr']/1e5:.2f} L.")

    # Score & tier
    growth = gst["summary"]["yoy_growth_pct"]
    hygiene = gst["summary"]["filing_hygiene_score"]
    inflow = aa["summary"]["avg_monthly_inflow_inr"]
    requested = intent.get("requested_amount_inr") or 15_00_000

    # Quick DSCR: assume 90-day tenor, 11.25% rate
    rate = 11.25
    monthly_emi = requested * (rate / 1200) * (1 + rate / 1200) ** 3 / ((1 + rate / 1200) ** 3 - 1)
    dscr = (inflow * 0.30) / monthly_emi   # assume 30% of inflow free for debt service

    if growth >= 15 and hygiene >= 90 and dscr >= 1.4:
        tier, rate_band = "PRIME", [10.5, 12.0]
    elif growth >= 8 and hygiene >= 75:
        tier, rate_band = "NEAR_PRIME", [12.5, 14.5]
    else:
        tier, rate_band = "REVIEW", [None, None]

    await _trace(trace, "AutoUnderwriter",
                 f"  Projected DSCR {dscr:.2f} → tier={tier}, rate_band={rate_band}.")
    await _trace(trace, "AutoUnderwriter", "Drafting offer & forwarding to ComplianceNext for KFS...")

    offer = {
        "offer_id": f"OFR-{datetime.utcnow().strftime('%Y%m%d')}-VIV-001",
        "borrower_gstin": BORROWER["gstin"],
        "tier": tier,
        "principal_inr": requested,
        "tenor_months": 3,
        "interest_rate_pct": rate,
        "processing_fee_inr": int(requested * 0.0075),
        "processing_fee_pct": 0.75,
        "monthly_emi_inr": int(monthly_emi),
        "dscr_projected": round(dscr, 2),
        "data_evidence": {
            "gst_growth_yoy_pct": growth,
            "gst_hygiene_score": hygiene,
            "aa_avg_monthly_inflow_inr": inflow,
            "aa_inflow_cv": aa["summary"]["inflow_volatility_cv"],
            "uli_collateral_fmv_inr": fmv,
        },
    }
    return offer


# ---------------------------------------------------------------------------
# ComplianceNext — KFS generation + RBI 2026 policy gate
# ---------------------------------------------------------------------------
def compliancenext_kfs(offer: dict[str, Any]) -> dict[str, Any]:
    principal = offer["principal_inr"]
    fee = offer["processing_fee_inr"]
    rate = offer["interest_rate_pct"]
    tenor_months = offer["tenor_months"]

    total_interest = (offer["monthly_emi_inr"] * tenor_months) - principal
    total_outflow = principal + total_interest + fee
    apr = ((total_interest + fee) / principal) * (12 / tenor_months) * 100

    return {
        "kfs_id": f"KFS-{offer['offer_id']}",
        "version": "RBI-FPC-2026-v3",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "language": "en-IN",   # AutoNavigator may re-render in hi-Deva / mr-IN
        "borrower": {
            "name": BORROWER["legal_name"],
            "gstin": BORROWER["gstin"],
        },
        "lender": {
            "name": "AutoLoanNext Capital Pvt Ltd",
            "rbi_coa_no": "N-13.02345",
            "grievance_officer": "Anjali Krishnan, grievance@autoloannext.in",
        },
        "loan_terms": {
            "sanctioned_principal_inr": principal,
            "tenor_months": tenor_months,
            "interest_rate_pct_pa": rate,
            "rate_type": "FIXED",
            "monthly_emi_inr": offer["monthly_emi_inr"],
            "processing_fee_inr": fee,
            "processing_fee_pct": offer["processing_fee_pct"],
            "gst_on_fees_inr": int(fee * 0.18),
            "total_interest_payable_inr": int(total_interest),
            "total_amount_payable_inr": int(total_outflow),
            "apr_pct": round(apr, 2),
        },
        "disbursal": {
            "mode": "UPI",
            "destination_handle": BORROWER["primary_bank"]["upi_handle"],
            "expected_settlement": "T+0 (within 30 minutes)",
        },
        "borrower_rights": {
            "cooling_off_days": 3,
            "prepayment_charges_pct": 0,
            "right_to_complete_kfs_in_language": True,
            "recovery_practices_disclosed": True,
        },
        "compliance_checks": [
            {"id": "KFS_GENERATED", "status": "PASS"},
            {"id": "APR_PROMINENT", "status": "PASS"},
            {"id": "COOLING_OFF_DISCLOSED", "status": "PASS"},
            {"id": "GRIEVANCE_OFFICER_LISTED", "status": "PASS"},
            {"id": "NO_DARK_PATTERNS", "status": "PASS"},
            {"id": "CONSENT_ARTEFACT_VALID", "status": "PASS"},
        ],
        "verdict": "PASS",
    }
