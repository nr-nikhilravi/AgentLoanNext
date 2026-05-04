"""
AgentLoanNext — Mock data + builders.

All India-Stack fixture data (NSE Emerge, GSTN, ULI, Account Aggregator)
plus the multi-customer portfolio + spotlight payloads. Kept out of main.py
to keep the route file small and the data shape easy to evolve.
"""
from __future__ import annotations

import random
from datetime import date, datetime, timedelta
from typing import Any, Dict, List

from pydantic import BaseModel, Field

random.seed(2026)

# ---------------------------------------------------------------------------
# Bank brand
# ---------------------------------------------------------------------------

BANK = {
    "legal_name": "Future Bank of India",
    "short_name": "FBI",
    "tagline": "Innovating the Indian Dream.",
    "rbi_registration": "N-13.02458",
    "registered_office": "FBI House, Bandra Kurla Complex, Mumbai 400051",
    "platform_name": "AgentLoanNext",
    "brand": {
        "primary_blue": "#0047FF",
        "primary_teal": "#00BFA5",
        "neutrals": "warm_grey",
    },
}

# ---------------------------------------------------------------------------
# Spotlight borrower — Vivid Electromech Limited (FY 2025-26)
# ---------------------------------------------------------------------------

VIVID = {
    "id": "VIV",
    "legal_name": "Vivid Electromech Limited",
    "short_name": "Vivid Electromech",
    "cin": "U29309MH2014PLC123456",
    "pan": "AAACV1234K",
    "gstin": "27AAACV1234K1Z5",
    "udyam_id": "UDYAM-MH-19-0098765",
    "msme_classification": "SMALL",
    "promoter": "Suresh R. Mehta",
    "registered_address": "Plot 27/A, MIDC Andheri, Mumbai 400093",
    "primary_bank": "Future Bank of India · Andheri (E)",
    "ifsc": "FBIN0000234",
    "account_last4": "8821",
    "upi_handle": "vivid.electromech@futurebank",
    "industry_nic_2008": "27109",
    "employees": 78,
    "listing": {
        "exchange": "NSE Emerge",
        "symbol": "VIVIDEM",
        "isin": "INE0X4Y01017",
        "ipo_listing_date": "2026-04-18",
        "ipo_principal_inr": 130_00_00_000,
        "ipo_subscription_x": 27.4,
        "issue_price_inr": 142,
        "current_price_inr": 196,
    },
    "fy26_financials": {
        "fiscal_year": "FY2025-26",
        "sales_inr": 1_55_29_00_000,
        "ebitda_inr": 28_45_00_000,
        "pat_inr": 21_30_00_000,
        "roe_pct": 63.9,
        "roce_pct": 41.2,
        "debt_to_equity": 0.15,
        "current_ratio": 2.31,
        "interest_coverage_x": 8.7,
        "yoy_sales_growth_pct": 74.0,
        "order_book_inr": 89_00_00_000,
    },
    "working_capital": {
        "operating_cycle_days": 92,
        "receivables_days": 64,
        "inventory_days": 41,
        "payables_days": 13,
        "estimated_gap_inr": 36_00_00_000,
        "anchor_buyers": [
            "Bharat Heavy Electricals Ltd (BHEL)",
            "Larsen & Toubro Heavy Engineering",
            "Siemens India",
            "Tata Power Solar",
        ],
    },
}

# ---------------------------------------------------------------------------
# Multi-customer portfolio
# ---------------------------------------------------------------------------

PORTFOLIO: List[Dict[str, Any]] = [
    {
        "id": "VIV", "legal_name": "Vivid Electromech Limited", "short_name": "Vivid Electromech",
        "industry": "Industrial Electromech", "city": "Mumbai", "rm_owner": "Anjali Krishnan",
        "ai_lead_score": 96, "tier": "STRATEGIC_PRIME",
        "fy26_sales_cr": 155.29, "yoy_growth_pct": 74.0, "roe_pct": 63.9,
        "debt_to_equity": 0.15, "wc_gap_cr": 36.0,
        "alert": "AutoNavigator detected a ₹130 Cr IPO listing and 74% Sales Growth. "
                 "Underwriter identifies a ₹36 Cr working capital gap. "
                 "Recommendation: Initiate Loan Process.",
        "recommendation": "INITIATE", "spotlight": True,
    },
    {
        "id": "SUR", "legal_name": "Surya Solars Pvt Ltd", "short_name": "Surya Solars",
        "industry": "Renewable Energy / Solar EPC", "city": "Bengaluru", "rm_owner": "Vikram Iyer",
        "ai_lead_score": 81, "tier": "PRIME",
        "fy26_sales_cr": 88.50, "yoy_growth_pct": 38.0, "roe_pct": 24.4,
        "debt_to_equity": 0.42, "wc_gap_cr": 12.0,
        "alert": "Strong sales growth + new state DISCOM contract. Pre-approved for ₹12 Cr WC line.",
        "recommendation": "INITIATE", "spotlight": False,
    },
    {
        "id": "ARZ", "legal_name": "Arzo Tech Industries Pvt Ltd", "short_name": "Arzo Tech",
        "industry": "Auto-Component Manufacturing", "city": "Pune", "rm_owner": "Anjali Krishnan",
        "ai_lead_score": 67, "tier": "NEAR_PRIME",
        "fy26_sales_cr": 42.10, "yoy_growth_pct": 11.4, "roe_pct": 16.2,
        "debt_to_equity": 0.78, "wc_gap_cr": 4.5,
        "alert": "Stable filings, moderate growth. Monitor Tier-2 OEM exposure before expanding limit.",
        "recommendation": "MONITOR", "spotlight": False,
    },
    {
        "id": "BLU", "legal_name": "Blue Ocean Logistics Pvt Ltd", "short_name": "Blue Ocean Logistics",
        "industry": "Cold-Chain Logistics", "city": "Kochi", "rm_owner": "Rajesh Pillai",
        "ai_lead_score": 52, "tier": "REVIEW",
        "fy26_sales_cr": 31.80, "yoy_growth_pct": 6.1, "roe_pct": 9.8,
        "debt_to_equity": 1.10, "wc_gap_cr": 7.2,
        "alert": "Diesel-cost squeeze + 1 GSTR-3B late filing. Recommend follow-up before reviewing limit.",
        "recommendation": "FOLLOW_UP", "spotlight": False,
    },
]


def get_portfolio_entry(company_id: str) -> Dict[str, Any] | None:
    for c in PORTFOLIO:
        if c["id"].upper() == company_id.upper():
            return c
    return None


# ---------------------------------------------------------------------------
# Pydantic schemas (shared between data.py and route handlers)
# ---------------------------------------------------------------------------

class GSTReturn(BaseModel):
    period: str
    taxable_turnover_inr: int
    igst_collected_inr: int
    cgst_collected_inr: int
    sgst_collected_inr: int
    invoice_count: int
    filed_on: str
    on_time: bool
    return_status: str = "FILED"


class GSTPayload(BaseModel):
    gstin: str
    legal_name: str
    fiscal_year: str
    fy_total_sales_inr: int
    yoy_growth_pct: float
    filing_hygiene_score: int = Field(..., ge=0, le=100)
    last_12_months: List[GSTReturn]
    consent_id: str
    consent_expiry: str


class LandRecord(BaseModel):
    survey_no: str
    village: str
    district: str
    state: str
    area_sq_m: int
    classification: str
    encumbrance_status: str
    fmv_inr: int
    last_mutation_date: str


class MachineryAsset(BaseModel):
    asset_id: str
    description: str
    make: str
    model: str
    year_of_purchase: int
    invoice_value_inr: int
    current_fmv_inr: int
    serial_no: str
    hypothecation_status: str


class ULIPayload(BaseModel):
    borrower_pan: str
    pulled_at: str
    land_records: List[LandRecord]
    machinery_assets: List[MachineryAsset]
    total_collateral_fmv_inr: int
    consent_id: str


class Transaction(BaseModel):
    txn_id: str
    timestamp: str
    rail: str
    counterparty: str
    amount_inr: int
    direction: str
    narration: str


class MonthlyAggregate(BaseModel):
    period: str
    total_credits_inr: int
    total_debits_inr: int
    upi_credit_count: int
    neft_rtgs_credit_count: int
    closing_balance_inr: int


class AAPayload(BaseModel):
    account_holder: str
    masked_account: str
    ifsc: str
    pulled_at: str
    period_months: int
    monthly_aggregates: List[MonthlyAggregate]
    sample_transactions: List[Transaction]
    cash_flow_health: Dict[str, Any]
    working_capital_gap_inr: int
    consent_id: str
    consent_expiry: str


# ---------------------------------------------------------------------------
# Builders
# ---------------------------------------------------------------------------

def _months_back(n: int = 12) -> List[str]:
    today = date.today().replace(day=1)
    out = []
    for i in range(n):
        m = today.month - 1 - i
        y = today.year
        while m < 0:
            m += 12
            y -= 1
        out.append(date(y, m + 1, 1).strftime("%b-%Y"))
    return list(reversed(out))


def build_nse_emerge() -> Dict[str, Any]:
    listing = VIVID["listing"]
    return {
        "borrower_id": "VIV",
        "borrower_legal_name": VIVID["legal_name"],
        "exchange": listing["exchange"],
        "symbol": listing["symbol"],
        "isin": listing["isin"],
        "ipo": {
            "listing_date": listing["ipo_listing_date"],
            "principal_raised_inr": listing["ipo_principal_inr"],
            "issue_price_inr": listing["issue_price_inr"],
            "subscription_x": listing["ipo_subscription_x"],
            "lead_managers": ["Pantomath Capital", "Holani Consultants"],
            "use_of_proceeds": [
                "Capacity expansion at MIDC Andheri",
                "Working capital",
                "General corporate purposes",
            ],
        },
        "current_market": {
            "as_of": date.today().isoformat(),
            "price_inr": listing["current_price_inr"],
            "market_cap_inr": listing["current_price_inr"] * 1_50_00_000,
        },
        "board_resolutions": [
            {"date": "2026-04-22",
             "subject": "Authorisation to avail working-capital facility up to ₹50 Cr",
             "status": "PASSED"}
        ],
        "consent_id": "NSE-CONSENT-2026-1f4a02",
        "consent_expiry": (date.today() + timedelta(days=180)).isoformat(),
    }


def build_gst() -> GSTPayload:
    months = _months_back(12)
    target_total = VIVID["fy26_financials"]["sales_inr"]
    weights = [0.78, 0.82, 0.88, 0.94, 1.00, 1.04, 1.05, 1.06, 1.10, 1.14, 1.17, 1.22]
    weight_sum = sum(weights)
    returns: List[GSTReturn] = []
    for i, m in enumerate(months):
        turnover = int(target_total * weights[i] / weight_sum)
        igst = int(turnover * 0.078)
        cgst = int(turnover * 0.046)
        sgst = int(turnover * 0.046)
        invoice_count = 320 + i * 12 + random.randint(0, 18)
        period_dt = datetime.strptime("01-" + m, "%d-%b-%Y")
        due = period_dt.replace(day=11) + timedelta(days=30)
        filed = due - timedelta(days=random.randint(2, 8))
        returns.append(GSTReturn(
            period=m, taxable_turnover_inr=turnover, igst_collected_inr=igst,
            cgst_collected_inr=cgst, sgst_collected_inr=sgst, invoice_count=invoice_count,
            filed_on=filed.date().isoformat(), on_time=True,
        ))
    return GSTPayload(
        gstin=VIVID["gstin"], legal_name=VIVID["legal_name"],
        fiscal_year=VIVID["fy26_financials"]["fiscal_year"],
        fy_total_sales_inr=target_total,
        yoy_growth_pct=VIVID["fy26_financials"]["yoy_sales_growth_pct"],
        filing_hygiene_score=96,
        last_12_months=returns,
        consent_id="GST-CONSENT-2026-9c4a1b",
        consent_expiry=(date.today() + timedelta(days=180)).isoformat(),
    )


def build_uli() -> ULIPayload:
    land = [
        LandRecord(survey_no="27/A", village="Andheri (E)", district="Mumbai Suburban",
                   state="Maharashtra", area_sq_m=1240, classification="Industrial — MIDC leasehold",
                   encumbrance_status="UNENCUMBERED", fmv_inr=68_500_000, last_mutation_date="2024-08-12"),
        LandRecord(survey_no="412/B", village="Vasai", district="Palghar",
                   state="Maharashtra", area_sq_m=2100, classification="Industrial — freehold",
                   encumbrance_status="UNENCUMBERED", fmv_inr=24_300_000, last_mutation_date="2023-02-19"),
        LandRecord(survey_no="88/C", village="Khopoli", district="Raigad",
                   state="Maharashtra", area_sq_m=4400, classification="Industrial — IPO-funded expansion site",
                   encumbrance_status="UNENCUMBERED", fmv_inr=42_700_000, last_mutation_date="2026-04-29"),
    ]
    machinery = [
        MachineryAsset(asset_id="VEM-CNC-001", description="5-axis CNC milling centre",
                       make="DMG MORI", model="DMU 50", year_of_purchase=2022,
                       invoice_value_inr=5_800_000, current_fmv_inr=4_200_000,
                       serial_no="DM50-22-44119", hypothecation_status="CLEAN"),
        MachineryAsset(asset_id="VEM-LATHE-004", description="CNC turning lathe",
                       make="Haas", model="ST-20Y", year_of_purchase=2023,
                       invoice_value_inr=3_400_000, current_fmv_inr=2_900_000,
                       serial_no="HAAS-23-09112", hypothecation_status="CLEAN"),
        MachineryAsset(asset_id="VEM-WIRE-002", description="Industrial wire-harness assembly line",
                       make="Komax", model="Alpha 530", year_of_purchase=2021,
                       invoice_value_inr=2_100_000, current_fmv_inr=1_500_000,
                       serial_no="KMX-21-71204", hypothecation_status="CLEAN"),
    ]
    total = sum(l.fmv_inr for l in land) + sum(m.current_fmv_inr for m in machinery)
    return ULIPayload(
        borrower_pan=VIVID["pan"],
        pulled_at=datetime.utcnow().isoformat() + "Z",
        land_records=land, machinery_assets=machinery,
        total_collateral_fmv_inr=total,
        consent_id="ULI-CONSENT-2026-7d2e8f",
    )


def build_aa() -> AAPayload:
    months = _months_back(12)
    target_total = VIVID["fy26_financials"]["sales_inr"]
    weights = [0.78, 0.82, 0.88, 0.94, 1.00, 1.04, 1.05, 1.06, 1.10, 1.14, 1.17, 1.22]
    weight_sum = sum(weights)
    aggs: List[MonthlyAggregate] = []
    closing = 18_50_000
    for i, m in enumerate(months):
        credits = int(target_total * weights[i] / weight_sum * 0.96)
        debits = int(credits * random.uniform(0.78, 0.86))
        closing = int(closing + (credits - debits) * 0.35)
        aggs.append(MonthlyAggregate(
            period=m, total_credits_inr=credits, total_debits_inr=debits,
            upi_credit_count=420 + i * 18 + random.randint(0, 22),
            neft_rtgs_credit_count=46 + i * 2,
            closing_balance_inr=max(closing, 12_00_000),
        ))
    counterparties = [
        ("Bharat Heavy Electricals Ltd", "RTGS"),
        ("Larsen & Toubro Ltd", "RTGS"),
        ("Kirloskar Brothers", "NEFT"),
        ("Tata Power Solar", "NEFT"),
        ("Mahindra Electric", "UPI"),
        ("Siemens India", "RTGS"),
    ]
    sample = []
    for i in range(20):
        cp, rail = random.choice(counterparties)
        amt = random.choice([85_000, 1_20_000, 2_40_000, 3_80_000, 6_15_000, 11_20_000, 24_50_000])
        ts = (datetime.utcnow() - timedelta(days=random.randint(1, 28),
                                            hours=random.randint(0, 23))).isoformat() + "Z"
        sample.append(Transaction(
            txn_id=f"TXN-{2026000 + i:07d}", timestamp=ts, rail=rail,
            counterparty=cp, amount_inr=amt, direction="CREDIT",
            narration=f"INV-{random.randint(2400, 2700)} {cp[:18]}",
        ))
    avg_inflow = sum(a.total_credits_inr for a in aggs) // 12
    var = sum((a.total_credits_inr - avg_inflow) ** 2 for a in aggs) / 12
    cov = round((var ** 0.5) / avg_inflow, 3)
    health = {
        "avg_monthly_inflow_inr": avg_inflow,
        "inflow_volatility_cv": cov,
        "min_monthly_balance_inr": min(a.closing_balance_inr for a in aggs),
        "bounce_count_12m": 0, "dpd_30plus_12m": 0, "verdict": "HEALTHY",
    }
    return AAPayload(
        account_holder=VIVID["legal_name"],
        masked_account=f"XXXXXX{VIVID['account_last4']}",
        ifsc=VIVID["ifsc"],
        pulled_at=datetime.utcnow().isoformat() + "Z",
        period_months=12, monthly_aggregates=aggs, sample_transactions=sample,
        cash_flow_health=health,
        working_capital_gap_inr=VIVID["working_capital"]["estimated_gap_inr"],
        consent_id="AA-CONSENT-2026-3b9f10",
        consent_expiry=(date.today() + timedelta(days=180)).isoformat(),
    )
