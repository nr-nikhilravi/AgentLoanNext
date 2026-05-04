"""
AgentLoanNext — In-process Shared State (v5)
============================================
Holds two pieces of mutable state shared across requests:

  1. ADMIN_BRIEFINGS    company_id → most recent admin-verified Strategic Briefing
  2. BATCH_JOBS         job_id → progress + per-company status of bulk research

This is intentionally an in-memory store for the demo. In production you
would persist these to Firestore / Cloud SQL so they survive Cloud Run cold
starts and are visible across instances. The State-Sync agent in
`.agents/agents.md` documents the production contract.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Admin-verified Strategic Briefings
# ---------------------------------------------------------------------------

# company_id (str) → {briefing dict, generated_at iso, admin_id, batch_id}
ADMIN_BRIEFINGS: Dict[str, Dict[str, Any]] = {}


def store_admin_briefing(
    company_id: str,
    briefing: Dict[str, Any],
    admin_id: str,
    batch_id: str,
) -> None:
    ADMIN_BRIEFINGS[company_id] = {
        "briefing": briefing,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "admin_id": admin_id,
        "batch_id": batch_id,
    }


def get_admin_briefing(company_id: str) -> Optional[Dict[str, Any]]:
    return ADMIN_BRIEFINGS.get(company_id)


def admin_research_summary(company_id: str) -> Dict[str, Any]:
    """Compact payload added to every /api/portfolio row."""
    rec = ADMIN_BRIEFINGS.get(company_id)
    if not rec:
        return {
            "admin_research_status": "NEVER_RUN",
            "last_admin_update": None,
            "admin_verified": False,
            "admin_batch_id": None,
        }
    age_seconds = max(
        0,
        int(time.time() - datetime.fromisoformat(rec["generated_at"]).timestamp()),
    )
    return {
        "admin_research_status": "FRESH" if age_seconds < 24 * 3600 else "STALE",
        "last_admin_update": rec["generated_at"],
        "admin_age_seconds": age_seconds,
        "admin_verified": True,
        "admin_batch_id": rec["batch_id"],
    }


# ---------------------------------------------------------------------------
# Batch jobs
# ---------------------------------------------------------------------------

# job_id (str) → BatchJob dict (see schema below)
BATCH_JOBS: Dict[str, Dict[str, Any]] = {}
_LATEST_JOB_ID: Optional[str] = None
_BATCH_LOCK = asyncio.Lock()


def new_batch_job(admin_id: str, company_ids: List[str]) -> str:
    """Create a new batch job record and return its id."""
    global _LATEST_JOB_ID
    job_id = f"batch-{uuid.uuid4().hex[:10]}"
    BATCH_JOBS[job_id] = {
        "id": job_id,
        "label": "Nightly Intelligence Batch",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "started_by": admin_id,
        "company_ids": list(company_ids),
        "total": len(company_ids),
        "completed": 0,
        "failed": 0,
        "status": "RUNNING",   # RUNNING | COMPLETED | FAILED
        "items": {
            cid: {"status": "PENDING", "started_at": None, "finished_at": None,
                  "source": None, "error": None}
            for cid in company_ids
        },
        "finished_at": None,
        "duration_ms": None,
    }
    _LATEST_JOB_ID = job_id
    return job_id


def mark_item_started(job_id: str, company_id: str) -> None:
    job = BATCH_JOBS.get(job_id)
    if not job:
        return
    item = job["items"].get(company_id)
    if item is None:
        return
    item["status"] = "RUNNING"
    item["started_at"] = datetime.now(timezone.utc).isoformat()


def mark_item_done(
    job_id: str,
    company_id: str,
    *,
    success: bool,
    source: Optional[str] = None,
    error: Optional[str] = None,
) -> None:
    job = BATCH_JOBS.get(job_id)
    if not job:
        return
    item = job["items"].get(company_id)
    if item is None:
        return
    item["status"] = "DONE" if success else "FAILED"
    item["finished_at"] = datetime.now(timezone.utc).isoformat()
    item["source"] = source
    item["error"] = error
    if success:
        job["completed"] += 1
    else:
        job["failed"] += 1


def finalise_job(job_id: str) -> None:
    job = BATCH_JOBS.get(job_id)
    if not job:
        return
    job["status"] = "COMPLETED" if job["failed"] == 0 else "PARTIAL"
    if job["completed"] == 0 and job["failed"] == job["total"]:
        job["status"] = "FAILED"
    job["finished_at"] = datetime.now(timezone.utc).isoformat()
    started = datetime.fromisoformat(job["started_at"]).timestamp()
    finished = datetime.fromisoformat(job["finished_at"]).timestamp()
    job["duration_ms"] = int((finished - started) * 1000)


def latest_batch_job() -> Optional[Dict[str, Any]]:
    if _LATEST_JOB_ID is None:
        return None
    return BATCH_JOBS.get(_LATEST_JOB_ID)


def get_batch_job(job_id: str) -> Optional[Dict[str, Any]]:
    return BATCH_JOBS.get(job_id)


def has_unread_admin_updates_since(reference_iso: Optional[str] = None) -> bool:
    """True if ANY admin briefing has been written more recently than `reference_iso`."""
    if not ADMIN_BRIEFINGS:
        return False
    if reference_iso is None:
        return True
    ref = datetime.fromisoformat(reference_iso).timestamp()
    return any(
        datetime.fromisoformat(rec["generated_at"]).timestamp() > ref
        for rec in ADMIN_BRIEFINGS.values()
    )
