#!/usr/bin/env bash
# Paula → Cloud Run deploy. Run AFTER `gcloud auth login` and billing is enabled.
# Reads secrets from .env.local at runtime; writes a gitignored deploy.env.yaml.
# Usage: bash scripts/deploy.sh
set -euo pipefail

PROJECT="paula-dccdf"
REGION="${REGION:-us-central1}"   # Tier-1 region, Cloud Run free-tier eligible
SERVICE="paula"

cd "$(dirname "$0")/.."

# --- read .env.local into shell ---
set -a; source .env.local; set +a

echo "==> Project + APIs"
gcloud config set project "$PROJECT" >/dev/null
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# --- grant the Cloud Run runtime service account Firestore access (for ADC) ---
PNUM="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
RUNTIME_SA="${PNUM}-compute@developer.gserviceaccount.com"
echo "==> Granting Firestore access to ${RUNTIME_SA}"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/datastore.user" --condition=None >/dev/null

# New projects don't auto-grant Cloud Build roles to the compute SA, which
# `run deploy --source` uses to build the image. Grant them or the build fails
# with PERMISSION_DENIED reading the source bucket.
echo "==> Granting Cloud Build roles to ${RUNTIME_SA}"
for role in roles/cloudbuild.builds.builder roles/storage.objectViewer roles/logging.logWriter roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="$role" --condition=None >/dev/null
done
echo "    waiting 30s for IAM propagation..."
sleep 30

# --- generate gitignored env file (ADC handles Firestore, so no SA JSON here) ---
echo "==> Writing deploy.env.yaml"
{
  echo "GCP_PROJECT_ID: \"${GCP_PROJECT_ID}\""
  echo "GEMINI_API_KEY: \"${GEMINI_API_KEY}\""
  echo "GEMINI_MODEL_PRO: \"${GEMINI_MODEL_PRO}\""
  echo "GEMINI_MODEL_FLASH: \"${GEMINI_MODEL_FLASH}\""
  echo "GOOGLE_CLIENT_ID: \"${GOOGLE_CLIENT_ID}\""
  echo "GOOGLE_CLIENT_SECRET: \"${GOOGLE_CLIENT_SECRET}\""
  echo "AUTH_SECRET: \"${AUTH_SECRET}\""
  echo "CRON_SECRET: \"${CRON_SECRET}\""
  echo "NEXT_TELEMETRY_DISABLED: \"1\""
  [ -n "${AUTH_URL:-}" ] && echo "AUTH_URL: \"${AUTH_URL}\""
} > deploy.env.yaml

echo "==> Deploying to Cloud Run (region: ${REGION})"
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances=0 \
  --env-vars-file deploy.env.yaml

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo ""
echo "============================================================"
echo " Deployed: $URL"
echo " NEXT (one-time):"
echo "  1. Add OAuth redirect URI in Google Auth console:"
echo "       $URL/api/auth/callback/google"
echo "  2. Set AUTH_URL and redeploy env:"
echo "       gcloud run services update $SERVICE --region $REGION \\"
echo "         --update-env-vars AUTH_URL=$URL"
echo "============================================================"
