# =============================================================================
# AgentLoanNext — Future Bank of India · Multi-stage Docker build
# Bundles the React/Tailwind cockpit + portals into the FastAPI runtime.
# Target: Google Cloud Run (asia-south1, Mumbai). Honours $PORT.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — Build the React frontend (Vite)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /web
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2 — Python runtime with FastAPI + bundled SPA
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    STATIC_DIR=/app/static \
    APP_NAME=agentloannext \
    APP_OPERATOR="Future Bank of India" \
    PORT=8080

# Defaults below are placeholder values; in production they are overridden by
# Cloud Run env vars (FBI_RM_ID, FBI_RM_PASSWORD, SESSION_SECRET) and by a
# Secret Manager-backed value for GEMINI_API_KEY.
ENV FBI_RM_ID=FBI2025 \
    FBI_RM_PASSWORD=abc1234 \
    ALLOW_ADMIN_VAULT=true \
    SESSION_SECRET=fbi-dev-secret-change-me-in-prod \
    SESSION_TTL_SECONDS=28800 \
    GEMINI_MODEL=gemini-flash-latest
# GEMINI_API_KEY is intentionally NOT baked into the image — Cloud Run injects
# it from Secret Manager (see deploy.sh).

LABEL org.opencontainers.image.title="AgentLoanNext" \
      org.opencontainers.image.vendor="Future Bank of India" \
      org.opencontainers.image.description="RM-led agentic MSME lending cockpit with Gemini Researcher + auth. Innovating the Indian Dream." \
      org.opencontainers.image.source="https://github.com/future-bank-india/agentloannext"

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY backend/ ./
COPY --from=frontend-builder /web/dist ./static
COPY .agents ./.agents

RUN useradd --uid 10001 --create-home --shell /bin/bash fbiapp \
    && chown -R fbiapp:fbiapp /app
USER fbiapp

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT:-8080}/api/health || exit 1

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --proxy-headers"]
