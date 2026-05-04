"""
AgentLoanNext — FastAPI Backend (Future Bank of India)
======================================================
RM-led agentic lending platform with Gemini-powered Researcher and
session-based authentication for both staff and borrowers.

Local:
    uvicorn main:app --host 0.0.0.0 --port 8080 --reload
Cloud Run:
    container EXPOSES 8080 (see Dockerfile).

Routes:
    /                        →  service descriptor JSON
    /login/{rm,customer}     →  React SPA login pages
    /admin/vault             →  React SPA admin vault (requires rm session)
    /rm-dashboard            →  React SPA RM cockpit (requires rm session)
    /msme-portal             →  React SPA borrower portal (requires customer session)
    /api/auth/*              →  login / logout / whoami
    /api/portfolio           →  multi-customer table
    /api/leadgen/spotlight   →  AI Spotlight payload
    /api/research/{id}       →  Gemini-backed Strategic Briefing
    /api/admin/vault         →  presentation-time credential reference
    /api/mock/{nse_emerge,gst,uli,aa}
    /api/underwrite/score    →  tiered offer
    /api/compliance/kfs      →  RBI 2026 KFS v4 (all-inclusive APR)
    /api/agents/trace        →  SSE stream of inter-agent reasoning
    /api/disburse            →  RTGS/UPI disbursal stub
    /api/esign               →  DigiLocker e-sign stub
    /api/health              →  liveness probe
"""
from __future__ import annotations

import asyncio
import os
import random
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from auth import (
    ADMIN_CREDENTIALS,
    ALLOW_ADMIN_VAULT,
    CUSTOMER_VAULT,
    RM_CREDENTIALS,
    AdminLoginRequest,
    CustomerLoginRequest,
    RMLoginRequest,
    Session,
    clear_session_cookie,
    current_session,
    issue_session,
    require_admin,
    require_admin_or_rm,
    require_customer,
    require_rm,
    set_session_cookie,
    verify_admin,
    verify_customer,
    verify_rm,
)
from data import (
    BANK,
    PORTFOLIO,
    VIVID,
    AAPayload,
    GSTPayload,
    ULIPayload,
    build_aa,
    build_gst,
    build_nse_emerge,
    build_uli,
    get_portfolio_entry,
)
from research import GEMINI_API_KEY, GEMINI_MODEL, run_research
from state import (
    admin_research_summary,
    finalise_job,
    get_admin_briefing,
    get_batch_job,
    has_unread_admin_updates_since,
    latest_batch_job,
    mark_item_done,
    mark_item_started,
    new_batch_job,
    store_admin_briefing,
)
from voice import process_voice_command

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AgentLoanNext — Future Bank of India",
    description="RM-led agentic lending cockpit with Gemini Researcher + auth.",
    version="2026.05.2",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _vivid_or_404(borrower_id: str) -> None:
    if borrower_id.upper() != "VIV":
        raise HTTPException(404, f"Mock fixtures only seeded for borrower 'VIV', got {borrower_id!r}")


# ---------------------------------------------------------------------------
# Meta
# ---------------------------------------------------------------------------

@app.get("/api/bank", tags=["Meta"])
async def get_bank() -> Dict[str, Any]:
    return BANK


@app.get("/api/health", tags=["Meta"])
async def health() -> Dict[str, Any]:
    # Probe Cloud STT availability without raising
    try:
        import google.cloud.speech_v1  # noqa: F401
        stt_sdk = True
    except Exception:
        stt_sdk = False
    return {
        "status": "ok",
        "service": "agentloannext-api",
        "bank": BANK["legal_name"],
        "region": "asia-south1",
        "version": "2026.05.3",
        "gemini_configured": bool(GEMINI_API_KEY),
        "gemini_model": GEMINI_MODEL if GEMINI_API_KEY else None,
        "speech_sdk_available": stt_sdk,
        "voice_endpoint": "/api/voice/command",
    }


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

@app.post("/api/auth/login/rm", tags=["Auth"])
async def login_rm(req: RMLoginRequest, request: Request, response: Response) -> Dict[str, Any]:
    sub, name = verify_rm(req)
    token, session = issue_session("rm", sub, name)
    set_session_cookie(response, token, request)
    return {"role": "rm", "session": session.model_dump(), "access_token": token}


@app.post("/api/auth/login/customer", tags=["Auth"])
async def login_customer(req: CustomerLoginRequest, request: Request, response: Response) -> Dict[str, Any]:
    entry = verify_customer(req)
    token, session = issue_session("customer", entry["sub"], entry["display_name"])
    set_session_cookie(response, token, request)
    return {
        "role": "customer",
        "session": session.model_dump(),
        "access_token": token,
        "company": entry["company"],
    }


@app.post("/api/auth/login/admin", tags=["Auth"])
async def login_admin(req: AdminLoginRequest, request: Request, response: Response) -> Dict[str, Any]:
    sub, name = verify_admin(req)
    token, session = issue_session("admin", sub, name)
    set_session_cookie(response, token, request)
    return {"role": "admin", "session": session.model_dump(), "access_token": token}


@app.post("/api/auth/logout", tags=["Auth"])
async def logout(response: Response) -> Dict[str, str]:
    clear_session_cookie(response)
    return {"status": "logged_out"}


@app.get("/api/auth/me", tags=["Auth"])
async def whoami(session: Session = Depends(current_session)) -> Dict[str, Any]:
    return session.model_dump()


# ---------------------------------------------------------------------------
# Admin Vault — RM-only credential reference for the demo
# ---------------------------------------------------------------------------

@app.get("/api/admin/vault", tags=["Admin"])
async def admin_vault(session: Session = Depends(require_admin_or_rm)) -> Dict[str, Any]:
    if not ALLOW_ADMIN_VAULT:
        raise HTTPException(403, "Admin vault is disabled by environment.")
    return {
        "viewed_by": session.display_name,
        "viewed_by_role": session.role,
        "viewed_at": datetime.utcnow().isoformat() + "Z",
        "warning": "Demo credentials only. Rotate quarterly via Cloud Run Secrets.",
        "admin": {
            "id": ADMIN_CREDENTIALS["id"],
            "password": ADMIN_CREDENTIALS["password"],
            "display_name": ADMIN_CREDENTIALS["display_name"],
            "title": ADMIN_CREDENTIALS["title"],
            "login_url": "/login/admin",
        },
        "rm": {
            "id": RM_CREDENTIALS["id"],
            "password": RM_CREDENTIALS["password"],
            "display_name": RM_CREDENTIALS["display_name"],
            "title": RM_CREDENTIALS["title"],
            "login_url": "/login/rm",
        },
        "customers": [
            {
                "username": c["username"], "password": c["password"],
                "company_id": c["sub"], "company": c["company"],
                "display_name": c["display_name"], "login_url": "/login/customer",
            }
            for c in CUSTOMER_VAULT
        ],
        "audit_sink": "gs://fbi-agentloannext-audit-2026/admin-vault-views/",
    }


# ---------------------------------------------------------------------------
# RM Cockpit — portfolio + spotlight + research
# ---------------------------------------------------------------------------

@app.get("/api/portfolio", tags=["RM Cockpit"])
async def get_portfolio(session: Session = Depends(require_admin_or_rm)) -> Dict[str, Any]:
    enriched = []
    for c in PORTFOLIO:
        row = dict(c)
        row.update(admin_research_summary(c["id"]))
        enriched.append(row)
    return {
        "rm_view": session.role == "rm",
        "admin_view": session.role == "admin",
        "viewed_by": session.display_name,
        "as_of": datetime.utcnow().isoformat() + "Z",
        "count": len(enriched),
        "clients": enriched,
        "has_admin_updates": has_unread_admin_updates_since(None),
        "latest_admin_batch": (latest_batch_job() or {}).get("id"),
    }


@app.get("/api/leadgen/spotlight", tags=["RM Cockpit"])
async def get_spotlight(session: Session = Depends(require_rm)) -> Dict[str, Any]:
    spot = next(c for c in PORTFOLIO if c["spotlight"])
    return {
        "scanned_at": datetime.utcnow().isoformat() + "Z",
        "agent": "LeadGen",
        "client_id": spot["id"],
        "headline": spot["alert"],
        "ai_lead_score": spot["ai_lead_score"],
        "recommendation": spot["recommendation"],
        "signals": [
            {"signal": "ipo_listing_event",     "detail": "₹130 Cr listed on NSE Emerge (2026-04-18, 27.4× subscribed)"},
            {"signal": "gst_yoy_growth",        "detail": "74% YoY sales growth (FY26 ₹155.29 Cr)"},
            {"signal": "working_capital_gap",   "detail": "₹36 Cr gap derived from receivables vs payables cycle"},
            {"signal": "filing_hygiene",        "detail": "96/100 — 12/12 GSTR-1 on time"},
            {"signal": "leverage_health",       "detail": "Debt/Equity 0.15 — well below covenant"},
        ],
    }


@app.get("/api/research/{company_id}", tags=["RM Cockpit"])
async def research(
    company_id: str,
    force: bool = False,
    source: str = "live",            # "live" | "admin"
    session: Session = Depends(require_admin_or_rm),
) -> Dict[str, Any]:
    """
    Strategic Briefing.

    - `source=live` (default): runs the Researcher fresh (Gemini if available,
      curated fallback otherwise). Cached 4h unless `force=true`.
    - `source=admin`: returns the most recent admin-verified briefing if any,
      otherwise falls back to a fresh live run.
    """
    company = get_portfolio_entry(company_id)
    if company is None:
        raise HTTPException(404, f"Unknown company_id {company_id!r}")

    if source == "admin":
        admin_rec = get_admin_briefing(company_id)
        if admin_rec is not None:
            briefing = dict(admin_rec["briefing"])
            briefing.setdefault("meta", {})
            briefing["meta"] = {
                **briefing["meta"],
                "source_view": "ADMIN_VERIFIED",
                "admin_batch_id": admin_rec["batch_id"],
                "admin_generated_at": admin_rec["generated_at"],
                "admin_id": admin_rec["admin_id"],
            }
            return briefing

    briefing = run_research(company, force_refresh=force)
    briefing.setdefault("meta", {})
    briefing["meta"]["source_view"] = "RM_LIVE"
    return briefing


# ---------------------------------------------------------------------------
# Admin — Bulk Research Job (Batch-Researcher + State-Sync)
# ---------------------------------------------------------------------------

async def _run_one_company_research(job_id: str, company: Dict[str, Any], admin_id: str) -> None:
    """Run a single Researcher pass and stash the result. Wraps run_research()
    in `asyncio.to_thread` so multiple companies execute concurrently even
    though `run_research` itself is synchronous (it calls the Gemini SDK)."""
    cid = company["id"]
    mark_item_started(job_id, cid)
    try:
        briefing = await asyncio.to_thread(run_research, company, True)
        store_admin_briefing(cid, briefing, admin_id=admin_id, batch_id=job_id)
        mark_item_done(
            job_id, cid,
            success=True,
            source=(briefing.get("meta") or {}).get("source"),
        )
    except Exception as e:
        mark_item_done(
            job_id, cid,
            success=False,
            error=f"{type(e).__name__}: {e}",
        )


async def _run_batch(job_id: str, admin_id: str) -> None:
    company_ids = [c["id"] for c in PORTFOLIO]
    companies = [get_portfolio_entry(cid) for cid in company_ids]
    await asyncio.gather(
        *(_run_one_company_research(job_id, c, admin_id) for c in companies if c),
        return_exceptions=True,
    )
    finalise_job(job_id)


@app.post("/api/admin/initiate-batch", tags=["Admin"])
async def admin_initiate_batch(session: Session = Depends(require_admin)) -> Dict[str, Any]:
    """Kicks off a Nightly Intelligence Batch — parallel Gemini research for
    every company in the portfolio. Returns immediately with the job_id; the
    UI polls `/api/admin/batch/{job_id}` for live progress."""
    company_ids = [c["id"] for c in PORTFOLIO]
    job_id = new_batch_job(admin_id=session.sub, company_ids=company_ids)
    asyncio.create_task(_run_batch(job_id, session.sub))
    job = get_batch_job(job_id) or {}
    return {
        "ok": True,
        "job_id": job_id,
        "status": "RUNNING",
        "company_ids": company_ids,
        "started_at": job.get("started_at"),
        "started_by": session.display_name,
    }


@app.get("/api/admin/batch/latest", tags=["Admin"])
async def admin_batch_latest(
    session: Session = Depends(require_admin_or_rm),
) -> Dict[str, Any]:
    job = latest_batch_job()
    if job is None:
        return {"ok": True, "job": None}
    progress_pct = (
        round(100 * (job["completed"] + job["failed"]) / max(job["total"], 1), 1)
    )
    return {"ok": True, "job": {**job, "progress_pct": progress_pct}}


@app.get("/api/admin/batch/{job_id}", tags=["Admin"])
async def admin_batch_status(
    job_id: str,
    session: Session = Depends(require_admin_or_rm),
) -> Dict[str, Any]:
    job = get_batch_job(job_id)
    if job is None:
        raise HTTPException(404, "Unknown batch job.")
    progress_pct = (
        round(100 * (job["completed"] + job["failed"]) / max(job["total"], 1), 1)
    )
    return {**job, "progress_pct": progress_pct}


# ---------------------------------------------------------------------------
# Copilot — voice command pipeline (RM-only)
# ---------------------------------------------------------------------------

@app.post("/api/voice/command", tags=["RM Cockpit"])
async def voice_command(
    audio: UploadFile = File(...),
    researched_csv: str = Form("", description="Comma-separated company IDs already researched"),
    session: Session = Depends(require_rm),
) -> Dict[str, Any]:
    """
    Accepts an audio blob (browser MediaRecorder) and returns the parsed Copilot
    intent + a navigation hint for the React app.

    The frontend includes the RM's `researchedSet` so the backend can enforce
    the Research-gate on INITIATE_LOAN: an unresearched company is rejected
    with a friendly remediation message ("Say 'Research X' first").
    """
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(400, "Empty audio payload.")
    if len(audio_bytes) > 6 * 1024 * 1024:
        raise HTTPException(413, "Audio payload too large (max 6 MB / ~30s).")

    researched = {x.strip().upper() for x in researched_csv.split(",") if x.strip()}
    result = process_voice_command(
        audio_bytes=audio_bytes,
        mime_type=audio.content_type or "audio/webm",
        researched_set=researched,
    )
    result["issued_by"] = session.display_name
    return result


# ---------------------------------------------------------------------------
# India-Stack mock rails
# ---------------------------------------------------------------------------

@app.get("/api/mock/nse_emerge", tags=["India Stack — Mock"])
async def get_nse_emerge(borrower: str = "VIV", session: Session = Depends(require_rm)) -> Dict[str, Any]:
    _vivid_or_404(borrower)
    await asyncio.sleep(0.3)
    return build_nse_emerge()


@app.get("/api/mock/gst", response_model=GSTPayload, tags=["India Stack — Mock"])
async def get_gst(borrower: str = "VIV", session: Session = Depends(require_rm)) -> GSTPayload:
    _vivid_or_404(borrower)
    await asyncio.sleep(0.4)
    return build_gst()


@app.get("/api/mock/uli", response_model=ULIPayload, tags=["India Stack — Mock"])
async def get_uli(borrower: str = "VIV", session: Session = Depends(require_rm)) -> ULIPayload:
    _vivid_or_404(borrower)
    await asyncio.sleep(0.5)
    return build_uli()


@app.get("/api/mock/aa", response_model=AAPayload, tags=["India Stack — Mock"])
async def get_aa(borrower: str = "VIV", session: Session = Depends(require_rm)) -> AAPayload:
    _vivid_or_404(borrower)
    await asyncio.sleep(0.7)
    return build_aa()


# ---------------------------------------------------------------------------
# Underwriter / Compliance / Disbursal / e-sign
# ---------------------------------------------------------------------------

class UnderwriteRequest(BaseModel):
    borrower_id: str = "VIV"
    requested_amount_inr: int = 36_00_00_000
    tenor_months: int = 24
    purpose: str = "working_capital_post_ipo"
    anchor_buyer: Optional[str] = "Bharat Heavy Electricals Ltd"
    research_completed: bool = False    # NEW: gate flag from RM cockpit


class Offer(BaseModel):
    tier: str
    sanctioned_amount_inr: int
    interest_rate_pct: float
    apr_all_inclusive_pct: float
    tenor_months: int
    processing_fee_inr: int
    insurance_premium_inr: int
    stamp_duty_inr: int
    emi_inr: int
    dscr_projected: float
    risk_band: str


@app.post("/api/underwrite/score", response_model=Offer, tags=["Orchestration"])
async def score(req: UnderwriteRequest, session: Session = Depends(require_rm)) -> Offer:
    _vivid_or_404(req.borrower_id)
    if not req.research_completed:
        raise HTTPException(412, "RM must complete a Researcher briefing before underwriting.")
    gst = build_gst()
    aa = build_aa()
    fy = VIVID["fy26_financials"]

    growth = gst.yoy_growth_pct
    hygiene = gst.filing_hygiene_score
    de = fy["debt_to_equity"]
    avg_inflow = aa.cash_flow_health["avg_monthly_inflow_inr"]

    monthly_servicing_capacity = int(avg_inflow * 0.18)
    requested_emi_estimate = req.requested_amount_inr // req.tenor_months
    dscr = round(monthly_servicing_capacity / max(requested_emi_estimate, 1), 2)

    if growth >= 35 and hygiene >= 90 and de <= 0.50 and dscr >= 1.5:
        tier, rate, band = "STRATEGIC_PRIME", 9.85, "AAA"
    elif growth >= 15 and hygiene >= 85:
        tier, rate, band = "PRIME", 11.25, "AA-"
    elif growth >= 8 and hygiene >= 75:
        tier, rate, band = "NEAR_PRIME", 13.50, "BBB+"
    else:
        tier, rate, band = "REVIEW", 16.00, "BB"

    proc_fee = int(req.requested_amount_inr * 0.0085)
    gst_on_fee = int(proc_fee * 0.18)
    stamp = 5_000
    insurance = int(req.requested_amount_inr * 0.0035)
    total_one_off = proc_fee + gst_on_fee + stamp + insurance
    apr_all_in = round(
        rate + (total_one_off / req.requested_amount_inr) * (12 / req.tenor_months) * 100, 2
    )

    r = rate / 1200
    n = req.tenor_months
    emi = int(req.requested_amount_inr * r * (1 + r) ** n / ((1 + r) ** n - 1))

    return Offer(
        tier=tier, sanctioned_amount_inr=req.requested_amount_inr,
        interest_rate_pct=rate, apr_all_inclusive_pct=apr_all_in,
        tenor_months=req.tenor_months,
        processing_fee_inr=proc_fee, insurance_premium_inr=insurance,
        stamp_duty_inr=stamp, emi_inr=emi,
        dscr_projected=dscr, risk_band=band,
    )


class KFS(BaseModel):
    kfs_id: str
    version: str
    issued_at: str
    bank: Dict[str, Any]
    borrower: Dict[str, Any]
    loan_terms: Dict[str, Any]
    fees_and_charges: Dict[str, int]
    apr_all_inclusive_pct: float
    evaluation_period_days: int
    evaluation_window_ends_at: str
    grievance_officer: Dict[str, str]
    recovery_partners: List[str]
    consent_artefacts: List[Dict[str, str]]
    listed_entity_disclosure: Dict[str, Any]
    compliance_checks: List[Dict[str, str]]
    compliance_verdict: str


@app.post("/api/compliance/kfs", response_model=KFS, tags=["Orchestration"])
async def generate_kfs(req: UnderwriteRequest, session: Session = Depends(require_rm)) -> KFS:
    _vivid_or_404(req.borrower_id)
    offer = await score(req, session)
    now = datetime.utcnow()
    return KFS(
        kfs_id=f"KFS-{now.strftime('%Y%m%d%H%M%S')}-VIV",
        version="RBI-FPC-2026-v4-all-inclusive",
        issued_at=now.isoformat() + "Z",
        bank={"name": BANK["legal_name"], "tagline": BANK["tagline"],
              "rbi_registration": BANK["rbi_registration"],
              "registered_office": BANK["registered_office"]},
        borrower={"legal_name": VIVID["legal_name"], "cin": VIVID["cin"],
                  "udyam_id": VIVID["udyam_id"], "promoter": VIVID["promoter"],
                  "address": VIVID["registered_address"]},
        loan_terms={"sanctioned_amount_inr": offer.sanctioned_amount_inr,
                    "tenor_months": offer.tenor_months,
                    "interest_rate_pct": offer.interest_rate_pct, "rate_type": "FIXED",
                    "emi_inr": offer.emi_inr, "repayment_frequency": "MONTHLY",
                    "disbursement_rail": "NEFT/RTGS (>₹2 Cr per NPCI cap)",
                    "purpose": req.purpose, "tier": offer.tier, "risk_band": offer.risk_band},
        fees_and_charges={"processing_fee_inr": offer.processing_fee_inr,
                          "gst_on_fees_inr": int(offer.processing_fee_inr * 0.18),
                          "stamp_duty_inr": offer.stamp_duty_inr,
                          "insurance_premium_inr": offer.insurance_premium_inr,
                          "prepayment_charge_inr": 0, "late_payment_penalty_inr": 25_000},
        apr_all_inclusive_pct=offer.apr_all_inclusive_pct,
        evaluation_period_days=3,
        evaluation_window_ends_at=(now + timedelta(days=3)).isoformat() + "Z",
        grievance_officer={"name": "Ms. Priya Iyer",
                           "designation": "Nodal Grievance Officer, Future Bank of India",
                           "email": "grievance@futurebankindia.in",
                           "phone": "+91-22-6111-9000"},
        recovery_partners=["Resolute Recovery Services Pvt Ltd"],
        consent_artefacts=[
            {"id": "NSE-CONSENT-2026-1f4a02", "rail": "NSE Emerge"},
            {"id": "GST-CONSENT-2026-9c4a1b", "rail": "GSTN"},
            {"id": "ULI-CONSENT-2026-7d2e8f", "rail": "ULI"},
            {"id": "AA-CONSENT-2026-3b9f10",  "rail": "Sahamati AA"},
        ],
        listed_entity_disclosure={"is_listed": True,
                                  "exchange": VIVID["listing"]["exchange"],
                                  "symbol": VIVID["listing"]["symbol"],
                                  "board_resolution_dated": "2026-04-22",
                                  "sebi_icdr_status": "COMPLIANT"},
        compliance_checks=[
            {"id": "RESEARCH_BRIEFING_REVIEWED", "status": "PASS"},
            {"id": "KFS_GENERATED",              "status": "PASS"},
            {"id": "APR_ALL_INCLUSIVE",          "status": "PASS"},
            {"id": "APR_PROMINENT",              "status": "PASS"},
            {"id": "EVALUATION_PERIOD_3D",       "status": "PASS"},
            {"id": "NO_DARK_PATTERNS",           "status": "PASS"},
            {"id": "GRIEVANCE_OFFICER_LISTED",   "status": "PASS"},
            {"id": "CONSENT_ARTEFACT_VALID",     "status": "PASS"},
            {"id": "LISTED_ENTITY_DISCLOSURE_OK","status": "PASS"},
        ],
        compliance_verdict="PASS",
    )


class DisburseRequest(BaseModel):
    borrower_id: str = "VIV"
    sanctioned_amount_inr: int
    destination_handle: str = "vivid.electromech@futurebank"
    kfs_acknowledged: bool
    evaluation_window_completed: bool


@app.post("/api/disburse", tags=["Orchestration"])
async def disburse(req: DisburseRequest, session: Session = Depends(require_rm)) -> Dict[str, Any]:
    _vivid_or_404(req.borrower_id)
    if not req.kfs_acknowledged:
        raise HTTPException(412, "KFS must be acknowledged before disbursal.")
    if not req.evaluation_window_completed:
        raise HTTPException(412, "3-day evaluation window has not been completed.")
    await asyncio.sleep(0.6)
    rail = "RTGS" if req.sanctioned_amount_inr > 2_00_00_000 else "UPI"
    ref_prefix = "RTGS" if rail == "RTGS" else "NPCI"
    return {
        "status": "SUCCESS", "rail": rail,
        "amount_inr": req.sanctioned_amount_inr,
        "credited_to": req.destination_handle,
        "rail_reference": f"{ref_prefix}{random.randint(10**11, 10**12 - 1)}",
        "settled_at": datetime.utcnow().isoformat() + "Z",
        "audit_hash": f"sha256:{random.getrandbits(128):032x}",
        "audit_sink": "gs://fbi-agentloannext-audit-2026/",
        "authorised_by": session.display_name,
    }


class ESignRequest(BaseModel):
    borrower_id: str = "VIV"
    kfs_id: str
    aadhaar_otp_validated: bool
    digilocker_session_id: str = "DL-MOCK-7811"


@app.post("/api/esign", tags=["MSME Portal"])
async def esign(req: ESignRequest, session: Session = Depends(require_customer)) -> Dict[str, Any]:
    _vivid_or_404(req.borrower_id)
    if not req.aadhaar_otp_validated:
        raise HTTPException(412, "Aadhaar OTP must be validated.")
    return {
        "status": "ESIGNED", "kfs_id": req.kfs_id,
        "esign_provider": "DigiLocker (CCA-licensed)",
        "session_id": req.digilocker_session_id,
        "signed_at": datetime.utcnow().isoformat() + "Z",
        "signed_by": session.display_name,
        "next_step": "Awaiting bank disbursal trigger.",
    }


# ---------------------------------------------------------------------------
# SSE — agentic reasoning trace (RM-only)
# ---------------------------------------------------------------------------

async def _trace_stream(req: UnderwriteRequest) -> AsyncGenerator[str, None]:
    nse = build_nse_emerge()
    gst = build_gst()
    aa = build_aa()
    uli = build_uli()
    # Calling score requires research_completed=True (the UI sets this before opening the stream)
    req2 = UnderwriteRequest(**{**req.model_dump(), "research_completed": True})
    # Mint a minimal session so the score() dep is happy
    fake_session = Session(role="rm", sub="trace", display_name="trace",
                           issued_at=int(datetime.utcnow().timestamp()),
                           expires_at=int(datetime.utcnow().timestamp()) + 60)
    offer = await score(req2, fake_session)
    fy = VIVID["fy26_financials"]

    frames = [
        ("LeadGen",         f"Spotlight pre-armed: AI Lead Score 96/100 · IPO ₹{nse['ipo']['principal_raised_inr']/1e7:.0f} Cr · YoY {fy['yoy_sales_growth_pct']}% growth · WC gap ₹{VIVID['working_capital']['estimated_gap_inr']/1e7:.0f} Cr."),
        ("Researcher",      "Strategic Briefing reviewed by RM: PROCEED_TO_INITIATE."),
        ("RM",              "Anjali Krishnan clicked [Initiate Loan Process] for VIVIDEM."),
        ("AutoNavigator",   f"RM-led intent captured: {req.purpose} · ₹{req.requested_amount_inr/1e7:.2f} Cr · tenor {req.tenor_months}m."),
        ("AutoUnderwriter", "Standby → ACTIVE. Beginning deep-rail validation across NSE, GST, ULI, AA."),
        ("AutoUnderwriter", f"NSE Emerge: {nse['symbol']} listed {nse['ipo']['listing_date']}, raised ₹{nse['ipo']['principal_raised_inr']/1e7:.0f} Cr ({nse['ipo']['subscription_x']}× subscribed)."),
        ("AutoUnderwriter", f"NSE board resolution {nse['board_resolutions'][0]['date']}: WC facility up to ₹50 Cr authorised."),
        ("AutoUnderwriter", f"GSTN: FY26 sales ₹{gst.fy_total_sales_inr/1e7:.2f} Cr · YoY {gst.yoy_growth_pct}% · hygiene {gst.filing_hygiene_score}/100."),
        ("AutoUnderwriter", f"AA: avg monthly inflow ₹{aa.cash_flow_health['avg_monthly_inflow_inr']/1e7:.2f} Cr · CoV {aa.cash_flow_health['inflow_volatility_cv']}."),
        ("AutoUnderwriter", f"ULI: 3 industrial parcels (₹{sum(l.fmv_inr for l in uli.land_records)/1e7:.2f} Cr FMV) + 3 unencumbered machinery assets."),
        ("AutoUnderwriter", f"Financial covenants: ROE {fy['roe_pct']}% · D/E {fy['debt_to_equity']} · DSCR projected {offer.dscr_projected}."),
        ("AutoUnderwriter", f"Composite scorecard → tier={offer.tier}, nominal rate {offer.interest_rate_pct}%."),
        ("ComplianceNext",  "Standby → ACTIVE. Engaging RBI 2026 Fair Practice + SEBI ICDR gates..."),
        ("ComplianceNext",  "Check RESEARCH_BRIEFING_REVIEWED OK · KFS_GENERATED OK · APR_ALL_INCLUSIVE OK"),
        ("ComplianceNext",  "Check EVALUATION_PERIOD_3D OK · NO_DARK_PATTERNS OK · GRIEVANCE_OFFICER_LISTED OK"),
        ("ComplianceNext",  "Check CONSENT_ARTEFACT_VALID (4/4) OK · LISTED_ENTITY_DISCLOSURE_OK"),
        ("ComplianceNext",  f"Verdict: PASS. APR (all-inclusive) {offer.apr_all_inclusive_pct}% · 3-day evaluation window armed."),
        ("AutoNavigator",   "KFS dispatched to MSME portal. Awaiting borrower review + e-sign after the 3-day window."),
    ]
    for agent, msg in frames:
        await asyncio.sleep(0.5)
        ts = datetime.utcnow().strftime("%H:%M:%S")
        payload = f'{{"ts":"{ts}","agent":"{agent}","message":{repr(msg)}}}'
        yield f"data: {payload}\n\n"
    yield "data: [DONE]\n\n"


@app.post("/api/agents/trace", tags=["Orchestration"])
async def stream_trace(req: UnderwriteRequest, session: Session = Depends(require_rm)):
    return StreamingResponse(_trace_stream(req), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# SPA hosting — login pages, RM cockpit, MSME portal, admin vault
# ---------------------------------------------------------------------------

STATIC_DIR = Path(os.environ.get("STATIC_DIR", "/app/static"))

if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    async def _spa_index(_: Request):
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/", include_in_schema=False)
    async def root_redirect():
        return JSONResponse({
            "service": BANK["platform_name"],
            "bank": BANK["legal_name"],
            "tagline": BANK["tagline"],
            "portals": {
                "rm_login": "/login/rm",
                "rm_dashboard": "/rm-dashboard",
                "customer_login": "/login/customer",
                "msme_portal": "/msme-portal",
                "admin_login": "/login/admin",
                "admin_dashboard": "/admin-dashboard",
                "admin_vault": "/admin/vault",
            },
            "api_docs": "/docs",
        })

    # All these paths are served by the same SPA bundle; the React Router
    # inside takes over and renders the right view based on path + session.
    for path in [
        "/login/rm", "/login/customer", "/login/admin",
        "/rm-dashboard", "/msme-portal", "/admin/vault", "/admin-dashboard",
    ]:
        app.add_api_route(path, _spa_index, include_in_schema=False)

    @app.get("/rm-dashboard/{rest:path}", include_in_schema=False)
    async def _rm_sub(rest: str, req: Request):  # pragma: no cover
        return await _spa_index(req)

    @app.get("/msme-portal/{rest:path}", include_in_schema=False)
    async def _msme_sub(rest: str, req: Request):  # pragma: no cover
        return await _spa_index(req)

    @app.get("/research/{rest:path}", include_in_schema=False)
    async def _research_sub(rest: str, req: Request):  # pragma: no cover
        return await _spa_index(req)
else:
    @app.get("/", tags=["Meta"])
    async def root() -> Dict[str, Any]:
        return {
            "service": BANK["platform_name"],
            "bank": BANK["legal_name"],
            "tagline": BANK["tagline"],
            "docs": "/docs",
            "note": "Frontend bundle not present in this image — mock API is live.",
        }
