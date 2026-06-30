/**
 * Centralized environment access. Values are read lazily so that a missing
 * variable only errors when a feature that needs it is actually used — this
 * keeps `next build` (and the Cloud Run image) working before secrets are wired.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  // Google Cloud project (Firestore, etc.). On Cloud Run this is auto-provided.
  get gcpProjectId(): string {
    return (
      process.env.GCP_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      ""
    );
  },

  // Gemini
  get geminiApiKey(): string {
    return required("GEMINI_API_KEY");
  },
  get geminiModelPro(): string {
    return optional("GEMINI_MODEL_PRO", "gemini-2.5-pro");
  },
  get geminiModelFlash(): string {
    return optional("GEMINI_MODEL_FLASH", "gemini-2.5-flash");
  },

  // Google OAuth (Auth.js)
  get googleClientId(): string {
    return required("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret(): string {
    return required("GOOGLE_CLIENT_SECRET");
  },
  get authSecret(): string {
    return required("AUTH_SECRET");
  },

  // Secret used to authorize the Cloud Scheduler cron endpoint.
  get cronSecret(): string {
    return optional("CRON_SECRET");
  },

  // Optional explicit service-account JSON for local Firebase Admin auth.
  get firebaseServiceAccount(): string {
    return optional("FIREBASE_SERVICE_ACCOUNT");
  },

  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
};
