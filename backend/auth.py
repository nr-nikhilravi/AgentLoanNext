"""
AgentLoanNext — Authentication module
======================================
Signed-cookie session auth (HMAC-SHA256 via itsdangerous), plus a
FastAPI dependency that gates routes by role.

Design choices:
- We use HttpOnly+Secure cookies (Secure dropped automatically on http://localhost)
- The cookie is also returned as `access_token` in the JSON body so the React
  app can stash it in memory if it prefers header-based auth (Authorization
  Bearer ...). Either form is accepted by `current_session`.
- Credentials come from environment variables so they can be rotated via
  Cloud Run Secret Manager without changing code. Sensible demo defaults
  are baked in for local development.
"""
from __future__ import annotations

import os
import time
from typing import Any, Dict, List, Optional

from fastapi import Cookie, Depends, Header, HTTPException, Request, Response
from itsdangerous import BadSignature, SignatureExpired, TimestampSigner
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Secret + cookie config
# ---------------------------------------------------------------------------

SESSION_SECRET = os.environ.get("SESSION_SECRET", "fbi-dev-secret-change-me-in-prod")
COOKIE_NAME = "agentloannext_session"
SESSION_TTL_SECONDS = int(os.environ.get("SESSION_TTL_SECONDS", "28800"))  # 8 hours

_signer = TimestampSigner(SESSION_SECRET)


# ---------------------------------------------------------------------------
# Static credential vault (env-driven for production, defaults for demo)
# ---------------------------------------------------------------------------

RM_CREDENTIALS = {
    "id": os.environ.get("FBI_RM_ID", "FBI2025"),
    "password": os.environ.get("FBI_RM_PASSWORD", "abc1234"),
    "display_name": "Anjali Krishnan",
    "title": "Relationship Manager · West Region",
}

# v5 — Admin Command Center credentials
ADMIN_CREDENTIALS = {
    "id": os.environ.get("FBI_ADMIN_ID", "FBI_ADMIN"),
    "password": os.environ.get("FBI_ADMIN_PASSWORD", "admin_pass_2026"),
    "display_name": "Vikram Rao",
    "title": "Chief Intelligence Officer · Bank-Wide Operations",
}

# The customer vault is intentionally hard-coded for the demo. In production,
# customer auth would be DigiLocker / Aadhaar OTP, not username/password.
CUSTOMER_VAULT: List[Dict[str, str]] = [
    {"username": "vivid_user", "password": "vivid2026", "sub": "VIV",
     "display_name": "Suresh R. Mehta", "company": "Vivid Electromech Limited"},
    {"username": "surya_user", "password": "surya2026", "sub": "SUR",
     "display_name": "Aarav Subramanian", "company": "Surya Solars Pvt Ltd"},
    {"username": "arzo_user",  "password": "arzo2026",  "sub": "ARZ",
     "display_name": "Meera Joshi", "company": "Arzo Tech Industries Pvt Ltd"},
    {"username": "blue_user",  "password": "blue2026",  "sub": "BLU",
     "display_name": "Thomas Varghese", "company": "Blue Ocean Logistics Pvt Ltd"},
]

ALLOW_ADMIN_VAULT = os.environ.get("ALLOW_ADMIN_VAULT", "true").lower() == "true"


# ---------------------------------------------------------------------------
# Pydantic
# ---------------------------------------------------------------------------

class RMLoginRequest(BaseModel):
    id: str
    password: str


class AdminLoginRequest(BaseModel):
    id: str
    password: str


class CustomerLoginRequest(BaseModel):
    username: str
    password: str


class Session(BaseModel):
    role: str          # "rm" | "customer"
    sub: str           # RM id, or company id (VIV/SUR/ARZ/BLU)
    display_name: str
    issued_at: int
    expires_at: int


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def issue_session(role: str, sub: str, display_name: str) -> tuple[str, Session]:
    """Returns (signed_token, session)."""
    now = int(time.time())
    payload = f"{role}|{sub}|{display_name}|{now}"
    token = _signer.sign(payload.encode("utf-8")).decode("utf-8")
    return token, Session(
        role=role,
        sub=sub,
        display_name=display_name,
        issued_at=now,
        expires_at=now + SESSION_TTL_SECONDS,
    )


def decode_session(token: str) -> Session:
    try:
        raw = _signer.unsign(token.encode("utf-8"), max_age=SESSION_TTL_SECONDS)
    except SignatureExpired:
        raise HTTPException(401, "Session expired. Please log in again.")
    except BadSignature:
        raise HTTPException(401, "Invalid session signature.")
    parts = raw.decode("utf-8").split("|")
    if len(parts) != 4:
        raise HTTPException(401, "Malformed session payload.")
    role, sub, display_name, issued_at = parts
    return Session(
        role=role,
        sub=sub,
        display_name=display_name,
        issued_at=int(issued_at),
        expires_at=int(issued_at) + SESSION_TTL_SECONDS,
    )


def set_session_cookie(resp: Response, token: str, request: Request) -> None:
    # Drop Secure on http://localhost so devs can log in without HTTPS
    secure = request.url.scheme == "https"
    resp.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(resp: Response) -> None:
    resp.delete_cookie(key=COOKIE_NAME, path="/")


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

def _extract_token(
    cookie_token: Optional[str] = Cookie(None, alias=COOKIE_NAME),
    auth_header: Optional[str] = Header(None, alias="Authorization"),
) -> Optional[str]:
    if cookie_token:
        return cookie_token
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(None, 1)[1].strip()
    return None


def current_session(token: Optional[str] = Depends(_extract_token)) -> Session:
    if not token:
        raise HTTPException(401, "Authentication required.")
    return decode_session(token)


def require_role(*allowed_roles: str):
    """Dependency factory: ensures the session role is in `allowed_roles`."""
    def _dep(session: Session = Depends(current_session)) -> Session:
        if session.role not in allowed_roles:
            raise HTTPException(403, f"Role '{session.role}' not permitted here.")
        return session
    return _dep


require_rm = require_role("rm")
require_customer = require_role("customer")
require_admin = require_role("admin")
require_admin_or_rm = require_role("admin", "rm")


# ---------------------------------------------------------------------------
# Login verification
# ---------------------------------------------------------------------------

def verify_rm(req: RMLoginRequest) -> tuple[str, str]:
    """Returns (sub, display_name) on success, raises 401 otherwise."""
    if req.id != RM_CREDENTIALS["id"] or req.password != RM_CREDENTIALS["password"]:
        raise HTTPException(401, "Invalid RM credentials.")
    return RM_CREDENTIALS["id"], RM_CREDENTIALS["display_name"]


def verify_admin(req: AdminLoginRequest) -> tuple[str, str]:
    """Returns (sub, display_name) on success, raises 401 otherwise."""
    if req.id != ADMIN_CREDENTIALS["id"] or req.password != ADMIN_CREDENTIALS["password"]:
        raise HTTPException(401, "Invalid Admin credentials.")
    return ADMIN_CREDENTIALS["id"], ADMIN_CREDENTIALS["display_name"]


def verify_customer(req: CustomerLoginRequest) -> Dict[str, str]:
    """Returns the matched customer record; raises 401 on miss."""
    for entry in CUSTOMER_VAULT:
        if entry["username"] == req.username and entry["password"] == req.password:
            return entry
    raise HTTPException(401, "Invalid borrower credentials.")
