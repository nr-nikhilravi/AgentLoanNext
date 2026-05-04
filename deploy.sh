#!/usr/bin/env bash
# =============================================================================
# AgentLoanNext — Google Cloud Run Deployment
# Bank: Future Bank of India · Region: asia-south1 (Mumbai)
#
# v3 update: provisions Secret Manager secrets for GEMINI_API_KEY and
# SESSION_SECRET, grants the Cloud Run service account the
# secretAccessor role, and wires the secrets into the running container.
# =============================================================================
#
# Prerequisites:
#   - gcloud CLI installed & authenticated:   gcloud auth login
#   - Application default creds set:          gcloud auth application-default login
#   - GCP project with billing enabled.
#   - GEMINI_API_KEY exported in your shell (or set with --gemini-key).
#
# Usage:
#   GEMINI_API_KEY=AIza... ./deploy.sh
#   PROJECT_ID=fbi-prod GEMINI_API_KEY=AIza... ./deploy.sh
#   ./deploy.sh --tag v2026.05.2 --gemini-key AIza...
#
# After deploy, three portals are served from the same Cloud Run service:
#   /login/rm        →  RM staff login
#   /login/customer  →  MSME borrower login
#   /admin/vault     →  presentation-time credential reference
# =============================================================================

set -euo pipefail

# ----------------------------- Configuration ---------------------------------
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-asia-south1}"
SERVICE_NAME="${SERVICE_NAME:-agentloannext}"
REPO_NAME="${REPO_NAME:-fbi-agentloannext-images}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d-%H%M%S)}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
MAX_INSTANCES="${MAX_INSTANCES:-1}"
MEMORY="${MEMORY:-1Gi}"
CPU="${CPU:-2}"
TIMEOUT="${TIMEOUT:-300s}"
CONCURRENCY="${CONCURRENCY:-80}"

# v3 — Secret Manager-backed secrets
GEMINI_SECRET_NAME="${GEMINI_SECRET_NAME:-fbi-gemini-api-key}"
SESSION_SECRET_NAME="${SESSION_SECRET_NAME:-fbi-session-secret}"
RM_PWD_SECRET_NAME="${RM_PWD_SECRET_NAME:-fbi-rm-password}"
# v5 — Admin Command Center secret
ADMIN_PWD_SECRET_NAME="${ADMIN_PWD_SECRET_NAME:-fbi-admin-password}"

# v3 — RM credentials (env-overridable; defaults match the demo)
FBI_RM_ID="${FBI_RM_ID:-FBI2025}"
FBI_RM_PASSWORD="${FBI_RM_PASSWORD:-abc1234}"
# v5 — Admin credentials (env-overridable; defaults match the demo)
FBI_ADMIN_ID="${FBI_ADMIN_ID:-FBI_ADMIN}"
FBI_ADMIN_PASSWORD="${FBI_ADMIN_PASSWORD:-admin_pass_2026}"

# Allow overriding from CLI:
#   ./deploy.sh --tag v1.2 --gemini-key AIza... --rm-id FBI2025 --rm-password abc1234
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)           IMAGE_TAG="$2"; shift 2 ;;
    --project)       PROJECT_ID="$2"; shift 2 ;;
    --region)        REGION="$2"; shift 2 ;;
    --gemini-key)    GEMINI_API_KEY="$2"; shift 2 ;;
    --rm-id)         FBI_RM_ID="$2"; shift 2 ;;
    --rm-password)   FBI_RM_PASSWORD="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: PROJECT_ID is unset and no default gcloud project configured." >&2
  echo "       Run:  gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "WARNING: GEMINI_API_KEY is not set." >&2
  echo "         The Researcher agent will fall back to curated briefings." >&2
  echo "         Pass with:  GEMINI_API_KEY=AIza... ./deploy.sh" >&2
  echo "         (continuing in 3s — Ctrl+C to abort)" >&2
  sleep 3
fi

IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:${IMAGE_TAG}"

cyan()   { printf "\033[1;36m%s\033[0m\n" "$*"; }
green()  { printf "\033[1;32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[1;33m%s\033[0m\n" "$*"; }

cyan "================================================================="
cyan "  AgentLoanNext · Future Bank of India · Cloud Run deploy v3"
cyan "================================================================="
echo "  Project   : ${PROJECT_ID}"
echo "  Region    : ${REGION}"
echo "  Service   : ${SERVICE_NAME}"
echo "  Image     : ${IMAGE_URI}"
echo "  Resources : ${CPU} vCPU · ${MEMORY} · ${MIN_INSTANCES}-${MAX_INSTANCES} instances"
echo "  Secrets   : ${GEMINI_SECRET_NAME}, ${SESSION_SECRET_NAME}, ${RM_PWD_SECRET_NAME}"
echo

# ----------------------------- Step 1: APIs ----------------------------------
yellow "[1/7] Ensuring required GCP APIs are enabled..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    iam.googleapis.com \
    secretmanager.googleapis.com \
    speech.googleapis.com \
    --project="${PROJECT_ID}"

# ----------------------------- Step 2: Artifact Registry ---------------------
yellow "[2/7] Ensuring Artifact Registry repo '${REPO_NAME}' exists in ${REGION}..."
if ! gcloud artifacts repositories describe "${REPO_NAME}" \
        --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO_NAME}" \
      --repository-format=docker \
      --location="${REGION}" \
      --description="AgentLoanNext (Future Bank of India) container images" \
      --project="${PROJECT_ID}"
else
  echo "    repo already exists — reusing."
fi

# ----------------------------- Step 3: Secret Manager ------------------------
ensure_secret() {
  local name="$1" value="$2" desc="$3"
  if ! gcloud secrets describe "${name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "    creating secret ${name}..."
    gcloud secrets create "${name}" \
        --replication-policy=automatic \
        --labels=app=agentloannext,operator=future-bank-of-india \
        --project="${PROJECT_ID}"
  fi
  printf "%s" "${value}" | gcloud secrets versions add "${name}" \
      --data-file=- --project="${PROJECT_ID}" >/dev/null
  echo "    ${name}: latest version posted (${desc})."
}

yellow "[3/7] Provisioning Secret Manager secrets..."
ensure_secret "${GEMINI_SECRET_NAME}"     "${GEMINI_API_KEY:-PLACEHOLDER_NO_KEY}" "Gemini API key"
ensure_secret "${SESSION_SECRET_NAME}"    "$(openssl rand -hex 32)"               "session signing key"
ensure_secret "${RM_PWD_SECRET_NAME}"     "${FBI_RM_PASSWORD}"                    "RM password"
ensure_secret "${ADMIN_PWD_SECRET_NAME}"  "${FBI_ADMIN_PASSWORD}"                 "Admin password"

# ----------------------------- Step 4: Service account & IAM -----------------
yellow "[4/7] Granting Cloud Run service account secretAccessor on the new secrets..."
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for s in "${GEMINI_SECRET_NAME}" "${SESSION_SECRET_NAME}" "${RM_PWD_SECRET_NAME}" "${ADMIN_PWD_SECRET_NAME}"; do
  gcloud secrets add-iam-policy-binding "${s}" \
      --member="serviceAccount:${COMPUTE_SA}" \
      --role="roles/secretmanager.secretAccessor" \
      --project="${PROJECT_ID}" >/dev/null
done

# v4 — Cloud Speech-to-Text client role for the Copilot agent
echo "    granting roles/speech.client on the project to ${COMPUTE_SA}..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${COMPUTE_SA}" \
    --role="roles/speech.client" \
    --condition=None >/dev/null

# v5 — Vertex AI / Gemini access for the Batch-Researcher agent
echo "    granting roles/aiplatform.user on the project to ${COMPUTE_SA}..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${COMPUTE_SA}" \
    --role="roles/aiplatform.user" \
    --condition=None >/dev/null

# ----------------------------- Step 5: Cloud Build ---------------------------
yellow "[5/7] Building & pushing image with Cloud Build..."
gcloud builds submit \
    --tag "${IMAGE_URI}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    .

# ----------------------------- Step 6: Deploy --------------------------------
# Two ways we wire env in Cloud Run:
#   --set-env-vars ...            non-secret values
#   --set-secrets   KEY=secret:v  secret-backed values (mounted at runtime)
yellow "[6/7] Deploying to Cloud Run (${REGION})..."
gcloud run deploy "${SERVICE_NAME}" \
    --image "${IMAGE_URI}" \
    --region "${REGION}" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory "${MEMORY}" \
    --cpu "${CPU}" \
    --concurrency "${CONCURRENCY}" \
    --timeout "${TIMEOUT}" \
    --min-instances "${MIN_INSTANCES}" \
    --max-instances "${MAX_INSTANCES}" \
    --service-account "${COMPUTE_SA}" \
    --set-env-vars "STATIC_DIR=/app/static,APP_OPERATOR=Future Bank of India,DEPLOY_REGION=${REGION},APP_ENV=production,FBI_RM_ID=${FBI_RM_ID},FBI_ADMIN_ID=${FBI_ADMIN_ID},ALLOW_ADMIN_VAULT=true,GEMINI_MODEL=gemini-flash-latest" \
    --set-secrets "GEMINI_API_KEY=${GEMINI_SECRET_NAME}:latest,SESSION_SECRET=${SESSION_SECRET_NAME}:latest,FBI_RM_PASSWORD=${RM_PWD_SECRET_NAME}:latest,FBI_ADMIN_PASSWORD=${ADMIN_PWD_SECRET_NAME}:latest" \
    --labels "app=agentloannext,operator=future-bank-of-india,domain=msme-lending,env=production" \
    --project "${PROJECT_ID}"

# ----------------------------- Step 7: Verify --------------------------------
yellow "[7/7] Fetching service URL & probing /api/health..."
URL="$(gcloud run services describe "${SERVICE_NAME}" \
        --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')"

green "Service URL: ${URL}"
if curl -fsS "${URL}/api/health" | grep -q '"status":"ok"'; then
  green "Health check: OK ✅"
else
  yellow "Health check did not return 200 yet (Cloud Run may still be warming)."
fi

cyan "================================================================="
green "  Deployment complete."
cyan "================================================================="
echo "  RM Login        :  ${URL}/login/rm        (FBI2025 / abc1234)"
echo "  Customer Login  :  ${URL}/login/customer  (vivid_user / vivid2026 etc.)"
echo "  RM Cockpit      :  ${URL}/rm-dashboard"
echo "  MSME Portal     :  ${URL}/msme-portal"
echo "  Admin Vault     :  ${URL}/admin/vault     (RM session required)"
echo "  API docs        :  ${URL}/docs"
echo
echo "  Recommended hardening for production:"
echo "    1. Front /rm-dashboard and /admin/vault with Identity-Aware Proxy"
echo "       tied to your Workspace SSO group 'fbi-rm-staff'."
echo "    2. Set ALLOW_ADMIN_VAULT=false once the demo is over."
echo "    3. Rotate the secrets quarterly:"
echo "         gcloud secrets versions add ${GEMINI_SECRET_NAME} --data-file=key.txt"
echo "         gcloud secrets versions add ${SESSION_SECRET_NAME} --data-file=<(openssl rand -hex 32)"
