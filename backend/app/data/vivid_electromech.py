"""
Mock 2026 India-Stack data layer for Vivid Electromech Limited.

This module hard-codes a coherent, internally-consistent borrower profile so that
GST velocity, AA cash-flow, and ULI collateral all *agree* with each other —
which is what makes the demo feel real.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

# ---------------------------------------------------------------------------
# Borrower master record
# ---------------------------------------------------------------------------
BORROWER: dict[str, Any] = {
    "legal_name": "Vivid Electromech Limited",
    "trade_name": "Vivid Electromech",
    "cin": "U29309MH2014PLC123456",
    "pan": "AAACV1234K",
    "gstin": "27AAACV1234K1Z5",
    "udyam_registration": "UDYAM-MH-19-0098765",
    "msme_classification": "SMALL",
    "incorporation_date": "2014-08-22",
    "registered_address": {
        "line1": "Plot 27/A, MIDC Industrial Estate",
        "line2": "Andheri (East)",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400093",
    },
    "promoter": {
        "name": "Suresh R. Mehta",
        "din": "07654321",
        "languages": ["en-IN", "hi-IN", "mr-IN"],
        "mobile_masked": "+91-98XXXXXX42",
    },
    "primary_bank": {
        "name": "HDFC Bank",
        "branch": "Andheri (East)",
        "ifsc": "HDFC0000234",
        "account_masked": "XXXXXXXX5512",
        "upi_handle": "vivid.electromech@hdfcbank",
    },
    "industry_nic_2008": "27109",   # Manufacture of other electric motors, generators
    "employee_count": 78,
}

# ---------------------------------------------------------------------------
# /api/mock/gst — 12 months of GSTR-1 filings
# Story: strong, accelerating sales growth + perfect filing hygiene.
# ---------------------------------------------------------------------------
def _gst_months() -> list[dict[str, Any]]:
    """
    Generate 12 months of GSTR-1 ending the last completed month.
    Sales grow ~18% YoY with mild seasonality (Q4 spike for industrial buyers).
    """
    today = date.today().replace(day=1)
    months = []
    base = 1_85_00_000   # ₹1.85 Cr in the oldest month
    seasonality = [1.00, 0.96, 1.02, 1.05, 1.10, 1.04,
                   0.98, 1.01, 1.06, 1.12, 1.18, 1.22]
    for i in range(12):
        month_start = (today - timedelta(days=30 * (12 - i))).replace(day=1)
        gross = int(base * seasonality[i] * (1 + 0.015 * i))   # +1.5% MoM trend
        igst = int(gross * 0.18 * 0.55)
        cgst = int(gross * 0.09 * 0.45)
        sgst = int(gross * 0.09 * 0.45)
        months.append({
            "period": month_start.strftime("%m-%Y"),
            "return_type": "GSTR-1",
            "filing_status": "FILED",
            "filed_on": (month_start + timedelta(days=10)).isoformat(),
            "due_date": (month_start + timedelta(days=11)).isoformat(),
            "on_time": True,
            "b2b_invoices": 42 + i,
            "b2c_invoices": 6,
            "gross_taxable_value_inr": gross,
            "igst_inr": igst,
            "cgst_inr": cgst,
            "sgst_inr": sgst,
            "total_tax_inr": igst + cgst + sgst,
            "anchor_buyers": [
                "Bharat Heavy Electricals Ltd (BHEL)",
                "Larsen & Toubro Ltd",
                "Siemens India",
            ],
        })
    return months


def gst_payload() -> dict[str, Any]:
    months = _gst_months()
    total_12m = sum(m["gross_taxable_value_inr"] for m in months)
    last_3m = sum(m["gross_taxable_value_inr"] for m in months[-3:])
    prior_3m = sum(m["gross_taxable_value_inr"] for m in months[-6:-3])
    growth_qoq = ((last_3m - prior_3m) / prior_3m) * 100 if prior_3m else 0.0
    return {
        "borrower_gstin": BORROWER["gstin"],
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "consent_id": "GST-CON-2026-0501-VIV-78421",
        "consent_expiry": "2026-08-01",
        "filings": months,
        "summary": {
            "total_taxable_value_12m_inr": total_12m,
            "qoq_growth_pct": round(growth_qoq, 2),
            "yoy_growth_pct": 18.4,
            "filing_hygiene_score": 96,   # 0–100
            "consecutive_on_time_filings": 24,
            "gstr3b_late_filings_24m": 0,
            "input_tax_credit_mismatch_flag": False,
        },
    }

# ---------------------------------------------------------------------------
# /api/mock/uli — Unified Lending Interface (collateral)
# Story: free-and-clear industrial plot + recent CNC mill, both verifiable.
# ---------------------------------------------------------------------------
def uli_payload() -> dict[str, Any]:
    return {
        "borrower_gstin": BORROWER["gstin"],
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "consent_id": "ULI-CON-2026-0501-VIV-33015",
        "consent_expiry": "2026-08-01",
        "land_records": [
            {
                "registry": "Maharashtra Bhumi Abhilekh",
                "survey_no": "Plot 27/A, MIDC Andheri",
                "khata_no": "27-A/MIDC/93",
                "village_taluka": "Andheri / Mumbai Suburban",
                "area_sqm": 1240,
                "ownership": "FREEHOLD",
                "owner": BORROWER["legal_name"],
                "encumbrance_status": "NIL",
                "last_verified": "2026-04-19",
                "guidance_value_inr": 2_85_00_000,
                "estimated_market_value_inr": 4_10_00_000,
            }
        ],
        "machinery_assets": [
            {
                "asset_id": "VIV-CNC-2024-07",
                "description": "DMG Mori CMX 1100 V — 5-axis CNC milling centre",
                "purchase_date": "2024-07-12",
                "invoice_no": "DMGI/2024/004421",
                "purchase_price_inr": 58_00_000,
                "depreciated_book_value_inr": 47_00_000,
                "fair_market_value_inr": 42_00_000,
                "lien_status": "NONE",
                "iot_uptime_30d_pct": 91.4,
            },
            {
                "asset_id": "VIV-PRESS-2022-03",
                "description": "Bharat Fritz Werner 250-ton hydraulic press",
                "purchase_date": "2022-03-04",
                "invoice_no": "BFW/2022/001188",
                "purchase_price_inr": 35_00_000,
                "depreciated_book_value_inr": 24_00_000,
                "fair_market_value_inr": 22_00_000,
                "lien_status": "NONE",
                "iot_uptime_30d_pct": 88.2,
            },
        ],
        "summary": {
            "total_collateral_fmv_inr": 4_10_00_000 + 42_00_000 + 22_00_000,
            "encumbrance_free_pct": 100.0,
            "ltv_capacity_at_60pct_inr": int((4_10_00_000 + 42_00_000 + 22_00_000) * 0.60),
        },
    }

# ---------------------------------------------------------------------------
# /api/mock/aa — Account Aggregator bank cash-flow
# Story: high UPI velocity from B2B customers + steady NEFT inflows.
# ---------------------------------------------------------------------------
def aa_payload() -> dict[str, Any]:
    today = date.today()
    inflows = []
    outflows = []
    # 60 days of inflow / outflow ledger
    for d in range(60):
        day = today - timedelta(days=d)
        # 4–7 inflow events per day, mostly UPI from B2B
        per_day_inflow = 4 + (d % 4)
        for k in range(per_day_inflow):
            mode = "UPI" if k % 3 != 0 else "NEFT"
            amt = 35_000 + (k * 18_400) + (d * 250)
            counterparty = [
                "BHEL Trichy Unit",
                "L&T Heavy Engineering",
                "Siemens India Ltd",
                "Tata Power Solar",
                "Adani Green Energy",
            ][k % 5]
            inflows.append({
                "txn_id": f"INF-{day.isoformat()}-{k:02d}",
                "date": day.isoformat(),
                "mode": mode,
                "counterparty": counterparty,
                "amount_inr": amt,
                "narration": f"INV/2026/{1000 + d * 10 + k}",
            })
        # outflows: payroll, raw material, GST
        outflows.append({
            "txn_id": f"OUT-{day.isoformat()}-RM",
            "date": day.isoformat(),
            "mode": "RTGS",
            "counterparty": "Jindal Stainless Ltd",
            "amount_inr": 1_85_000 + (d * 600),
            "narration": "Raw material — SS 304",
        })
    total_inflow_60d = sum(i["amount_inr"] for i in inflows)
    total_outflow_60d = sum(o["amount_inr"] for o in outflows)
    avg_monthly_inflow = total_inflow_60d / 2
    return {
        "borrower_gstin": BORROWER["gstin"],
        "account_masked": BORROWER["primary_bank"]["account_masked"],
        "ifsc": BORROWER["primary_bank"]["ifsc"],
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "consent_id": "AA-CON-2026-0501-VIV-90112",
        "consent_expiry": "2026-08-01",
        "consent_purpose": "LOAN_UNDERWRITING",
        "fip": "HDFC Bank",
        "fiu": "AutoLoanNext",
        "window_days": 60,
        "ledger": {
            "inflows": inflows[:80],     # cap response size
            "outflows": outflows[:30],
        },
        "summary": {
            "total_inflow_60d_inr": total_inflow_60d,
            "total_outflow_60d_inr": total_outflow_60d,
            "net_cash_position_60d_inr": total_inflow_60d - total_outflow_60d,
            "avg_monthly_inflow_inr": int(avg_monthly_inflow),
            "upi_share_pct": 67.4,
            "neft_share_pct": 24.1,
            "rtgs_share_pct": 8.5,
            "inflow_volatility_cv": 0.21,    # low = stable
            "bounced_cheques_24m": 0,
            "ecs_failures_24m": 0,
            "current_overdraft_utilization_pct": 38.0,
        },
    }
