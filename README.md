# AgentLoanNext

> **Future Bank of India** · *Innovating the Indian Dream*
>
> AgentLoanNext is the bank's RM-led, agentic lending cockpit for Indian MSMEs.
> The Relationship Manager works in a "God-View" portfolio cockpit with proactive
> AI insights; the borrower interacts through a separate, simplified e-sign portal.
> All actions are gated by a four-agent orchestrator and the RBI 2026 Fair
> Practice Code (KFS v4 with all-inclusive APR + 3-day evaluation period).

Built on **Antigravity** (agent orchestration), **FastAPI** (mock India-Stack
rails + orchestration APIs), **React + Tailwind** (RM cockpit + MSME portal),
and **Google Cloud Run** in `asia-south1`.

The reference borrower is **Vivid Electromech Limited** — NSE Emerge listed
(₹130 Cr IPO, April 2026), FY26 sales ₹155.29 Cr, ROE 63.9%, D/E 0.15.

---

## Architecture

```
                         ┌──────────────────────┐  always-on
                         │   LeadGen agent      │  ─────────► RM Spotlight card
                         │ (NSE + GST signals)  │
                         └──────────┬───────────┘
                                    │
                          alerts    │   click [Initiate]
                                    ▼
┌────────────────────┐   ┌─────────────────────────┐
│  RM Command Centre │ → │ AutoUnderwriter (active)│ ─► NSE · GST · ULI · AA
│ (/rm-dashboard)    │   └────────────┬────────────┘
└────────────────────┘                │ draft offer
                                      ▼
                         ┌────────────────────────┐
                         │ ComplianceNext (active)│ ─► RBI 2026 + SEBI ICDR
                         └────────────┬───────────┘
                                      │ KFS v4 (all-inclusive APR + 3-day eval)
                                      ▼
                         ┌────────────────────────┐
                         │ MSME Portal            │ ─► Aadhaar OTP + DigiLocker
                         │ (/msme-portal)         │
                         └────────────┬───────────┘
                                      │ e-sign
                                      ▼
                         ┌────────────────────────┐
                         │ Disbursal Bus (RTGS)   │ ─► audit hash → WORM
                         └────────────────────────┘
```

The four agents are configured in `.agents/agents.md`. `LeadGen` is always-on;
`AutoUnderwriter` and `ComplianceNext` stay in **STANDBY** until the RM clicks
**Initiate**, at which point a deep-rail validation runs and streams to the
cockpit's Active Agentic Reasoning pane.

---

## Repository layout

```
AutoloanNext/
├── .agents/
│   └── agents.md           # Antigravity manifest (4 agents · RM-led workflow)
├── backend/
│   ├── main.py             # FastAPI: mock NSE/GST/ULI/AA + orchestration + KFS v4
│   ├── app/                # earlier helper modules (kept for reference)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # RM Cockpit + MSME Portal SPA
│   │   ├── Logo.jsx        # FBI logo (F + circuit pulse)
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.js
├── Dockerfile              # multi-stage: Node build → Python runtime
├── .dockerignore
├── cloudbuild.yaml         # CI build trigger
├── deploy.sh               # one-shot Cloud Run deploy (asia-south1)
├── preview.html            # standalone HTML preview of the cockpit
└── README.md
```

---

## Local development

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

Open <http://localhost:8080/docs>.

| Endpoint                        | Returns                                                                  |
| ------------------------------- | ------------------------------------------------------------------------ |
| `GET  /api/bank`                | Brand bootstrap (name, tagline, palette)                                 |
| `GET  /api/portfolio`           | Multi-customer portfolio for the RM cockpit                              |
| `GET  /api/leadgen/spotlight`   | LeadGen alert payload for the AI Spotlight card                          |
| `GET  /api/mock/nse_emerge`     | Vivid's NSE Emerge listing + board resolution + corp actions             |
| `GET  /api/mock/gst`            | 12 months GSTR-1 (FY26 ₹155.29 Cr · 74% YoY · hygiene 96/100)            |
| `GET  /api/mock/uli`            | 3 land parcels + 3 unencumbered machinery assets                         |
| `GET  /api/mock/aa`             | 12 months AA aggregates + sample inflows + WC gap                        |
| `POST /api/underwrite/score`    | Tiered offer (STRATEGIC_PRIME · 9.85% · APR all-inclusive 10.34%)         |
| `POST /api/compliance/kfs`      | KFS v4 — all-inclusive APR + 3-day evaluation window                     |
| `POST /api/agents/trace`        | SSE stream of the inter-agent dialogue                                   |
| `POST /api/disburse`            | RTGS disbursal stub (>₹2 Cr auto-routes off UPI per NPCI cap)            |
| `POST /api/esign`               | DigiLocker / Aadhaar OTP e-sign for the MSME portal                      |
| `GET  /api/health`              | Liveness/readiness probe                                                 |

### 2. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 — proxies /api → :8080
```

Visit `/rm-dashboard` for the RM Cockpit and `/msme-portal` for the borrower
e-sign flow. Both views are served from the same SPA bundle.

---

## Production deploy (Cloud Run, asia-south1)

```bash
chmod +x deploy.sh
PROJECT_ID=fbi-prod ./deploy.sh
```

The script:

1. Enables `run`, `artifactregistry`, `cloudbuild`, `iam`, `secretmanager` APIs.
2. Creates Artifact Registry repo `fbi-agentloannext-images`.
3. Builds the multi-stage image via Cloud Build.
4. Deploys to Cloud Run (`asia-south1`) with min=0, max=20, 2 vCPU, 1 GiB.
5. Prints the service URL and probes `/api/health`.

### Securing `/rm-dashboard`

For a production rollout, front the service with **Identity-Aware Proxy** and
gate `/rm-dashboard*` to a Workspace group of bank staff. The MSME portal can
remain public but is hardened by Aadhaar OTP + DigiLocker e-sign at action
time. The `deploy.sh` final summary prints a sample IAP binding command.

---

## Compliance posture

- **RBI Master Direction on Digital Lending (2025, revised 2026)** — KFS v4
  with **all-inclusive APR** (processing fee + GST + stamp + insurance
  amortised in), **mandatory 3-day evaluation period**, grievance officer,
  recovery partner disclosure.
- **SEBI ICDR** — listed-entity disclosure block on KFS for NSE/BSE-listed
  borrowers, including board-resolution dates.
- **DEPA 2.0** — every India-Stack pull carries a signed, expiring consent ID
  (NSE / GST / ULI / AA) surfaced on the KFS.
- **Audit immutability** — every successful disbursal returns a `sha256:` audit
  hash written to `gs://fbi-agentloannext-audit-2026/` (WORM-configured).
