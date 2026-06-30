# Paula — Setup (Free, No Credit Card)

Everything below is on **free tiers with no billing account**. The only step
that needs billing is the final Cloud Run deploy (M8), which is covered by
Google's $300/90-day free trial — see the bottom.

You'll create ONE project that serves as both a Firebase project and a Google
Cloud project (they're the same thing), then collect 6 values into `.env.local`.

---

## 1. Firebase project + Firestore (free Spark plan, no card)

1. Go to https://console.firebase.google.com → **Add project** → name it
   `paula` (skip Google Analytics). No credit card is requested on the Spark plan.
2. In the project: **Build → Firestore Database → Create database**.
   - Start in **production mode** (we use the Admin SDK, which bypasses rules).
   - Pick any location near you.
3. **Service account key** (lets the app talk to Firestore locally):
   - Gear icon → **Project settings → Service accounts** → **Generate new
     private key** → downloads a JSON file.
   - Open it, copy the **entire JSON onto one line**, and put it in
     `FIREBASE_SERVICE_ACCOUNT` in `.env.local`.
   - Also copy the `project_id` value → put it in `GCP_PROJECT_ID`.

## 2. Gemini API key (free tier, no card)

1. Go to https://aistudio.google.com/apikey → **Create API key** → choose your
   `paula` project.
2. Put it in `GEMINI_API_KEY`.

## 3. Google OAuth client + Calendar API (free)

Your Firebase project is also a Google Cloud project, at
https://console.cloud.google.com (select the `paula` project top-left).

1. **Enable the Calendar API**: APIs & Services → **Library** → search
   "Google Calendar API" → **Enable**. (Free, no billing prompt.)
2. **OAuth consent screen**: APIs & Services → **OAuth consent screen** →
   **External** → fill app name + your email.
   - Add scope `.../auth/calendar`.
   - Under **Test users**, add your own Google email. (Testing mode allows the
     calendar scope without Google verification — perfect for the demo.)
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - (Add the Cloud Run URL later, at deploy time.)
   - Copy **Client ID** → `GOOGLE_CLIENT_ID`, **Client secret** →
     `GOOGLE_CLIENT_SECRET`.

## 4. Auth secret

```bash
npx auth secret      # prints/writes AUTH_SECRET   (or: openssl rand -base64 32)
```

## 5. Fill `.env.local`

```bash
cp .env.example .env.local
# then edit .env.local with the 6 values above
```

## 6. Run it

```bash
npm run dev
# open http://localhost:3000 → Continue with Google → grant calendar access
```

You should land on `/dashboard`, see your real calendar, and be able to tell
Paula a goal in the chat and watch it schedule events onto your calendar.

---

## Deployment (M8 — the only part needing billing)

The hackathon requires a Google Cloud deployment. Cloud Run needs a billing
account enabled, but:

- New accounts get a **$300 free trial credit for 90 days** — you add a card for
  identity verification but are **not charged** while on the trial, and Cloud
  Run has an always-free request tier on top.
- Check whether the hackathon organizers provided GCP credits.

We'll handle this together at the end once the app is fully built and verified
locally. Nothing before then costs anything.

### Autonomous replan (Cloud Scheduler)

After deploying, create a scheduled job that pings the cron endpoint so Paula
re-plans in the background (covered by Cloud Scheduler's free tier — 3 jobs free):

```bash
gcloud scheduler jobs create http paula-replan \
  --location <region> \
  --schedule "*/30 * * * *" \
  --uri "https://<your-cloud-run-url>/api/cron/replan" \
  --http-method POST \
  --headers "Authorization=Bearer ${CRON_SECRET}"
```

You can also test the endpoint manually any time:

```bash
curl -X POST "https://<url>/api/cron/replan?key=${CRON_SECRET}"
```
