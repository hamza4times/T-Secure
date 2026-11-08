# T-Secure

**Protecting the people behind every conversation.**

T-Secure is a hackathon prototype for AI-powered scam protection, designed first for older adults. It doesn't just flag a number or a keyword. It follows how manipulation builds across a conversation (trust, then fear, then urgency, then secrecy), predicts the harmful request that may come next, and gives a calm, explained warning before the customer acts.

> This is a prototype. Calls are simulated with scripted transcripts. There is no carrier integration and no call monitoring, and T-Mobile has not approved or integrated it. T-Life and network-level integration are presented as future opportunities.

Stack: Vite, vanilla HTML/CSS/JavaScript, Firebase Authentication, Cloud Firestore, Vercel serverless functions, NVIDIA Nemotron (via OpenRouter) and Google Gemini.

---

## 1. Run it locally

Requires Node.js 22.12+.

```bash
npm ci
npm run dev        # http://localhost:5173
```

With no `.env`, the app runs in **demo mode**: the landing page offers "Explore the demo", and every check runs with the rule engine in your browser. Demo results are always labeled as such.

Checks:

```bash
npm test           # 69 unit tests: engines, validation, providers, service, benchmark
npm run build
npm run test:e2e   # 34 browser tests (desktop + mobile Chrome), demo mode
npm run test:bundle  # proves server secrets never enter the browser bundle
# With a server running on :5173 (npm run dev or npm run preview):
npm run test:a11y  # axe WCAG 2.1 AA across 15 routes × 2 viewports
npm run capture    # screenshots + overflow/error report in artifacts/qa/
```

## 2. Environment variables

Copy `.env.example` to `.env`.

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | Browser | Firebase web config (public by design). |
| `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` | Browser | Optional. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Server** | Single-line service-account JSON for Firebase Admin (token verification, server-written history). |
| `AI_PROVIDER` | **Server** | `nemotron`, `gemini`, or `rules`. Empty = first provider with a key, else rules only. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | **Server** | Nemotron via OpenRouter. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | **Server** | Gemini via the Generative Language API. Set `GEMINI_MODEL` to a current model name. |
| `BENCHMARK_ALLOWED_EMAILS` | **Server** | Comma-separated developer emails allowed to run benchmarks on a deployed server. |

Only `VITE_` variables reach the browser. Never give a server secret that prefix. `npm run test:bundle` checks this.

## 3. Firebase configuration

1. Create a Firebase project, then add a **Web app**. Copy its config into the `VITE_FIREBASE_*` variables.
2. Project settings → Service accounts → **Generate new private key**. Paste the JSON on one line into `FIREBASE_SERVICE_ACCOUNT_JSON`, keeping the `\n` escapes in the private key.
3. Restart `npm run dev`.

## 4. Firebase Authentication

1. Authentication → Sign-in method: enable **Email/Password** and **Google** (set a support email).
2. Authentication → Settings → **Authorized domains**: `localhost` is included by default. Add your Vercel domain before deploying.

Behavior: sign-up requires a name, a valid email, and a password of 8+ characters with confirmation. A verification email is sent, and protected pages, private Firestore data, and every API stay locked until the email is verified (enforced by the rules and the server, not just the UI). Password reset and Google popup sign-in are included. New accounts go through the six-step **Personal Protection Profile** onboarding.

## 5. Firestore and security rules

Create a Firestore database, then deploy the rules:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID
```

| Path | Written by | Contents |
| --- | --- | --- |
| `users/{uid}` | Owner | `displayName`, `email`, `createdAt`, `onboardingCompleted`, `protectionEnabled`, `preferences` (text size, contrast, motion, language, warning style, warning sound, verification methods, "has family passphrase" flag) |
| `users/{uid}/trustedContacts/{id}` | Owner | `displayName`, `relationshipLabel`, `phone`, `verificationPreference`, `createdAt` (up to 5) |
| `users/{uid}/incidents/{id}` | **Server only** | The brief's *analyses*: channel, risk level, evidence score, tactic and category codes, predicted action code, analysis source, timestamps. Owner may update only the recovery checklist. |
| `users/{uid}/warnings/{id}` | Owner | `warningType`, `warningLevel`, `displayedAt` (server time), `customerAction` |
| `evaluationScenarios/{id}` | **Server only** | Benchmark scenarios, expected labels, and measured `modelResults` |

The rules allow only the verified owner to read their data, validate every field and value against an allowlist (no score, psychological, or health fields can be written), and deny all client access to evaluation results and rate limits. **No raw message, transcript, evidence quote, or model prose is ever stored.**

Rules tests (needs Firebase CLI and Java 21+):

```bash
firebase emulators:exec --only firestore --project demo-tsecure "npm run test:rules"
firebase emulators:exec --only auth,firestore --project demo-tsecure "npm run test:auth"
```

## 6. AI provider configuration

Pipeline (`server/service.js`):

1. Receive the message or transcript (authenticated, rate-limited, 12,000-character cap).
2. **Deterministic checks**: the rule engine and the conversation-manipulation engine. Only the other party's words are scanned, never the customer's replies.
3. Send the text to the configured provider (`server/ai-provider.js` → `nemotron.js` or `gemini.js`). Both use the same prompt (`server/prompt.js`).
4. **Validate** the JSON (`shared/report.js`): known risk levels and tactic names only, confidence values in 0–1, and every evidence quote must appear verbatim in the caller's words. Anything else is rejected.
5. **Risk engine**: the model can raise the deterministic rating by one level at most, and can never lower it.
6. Build the structured report: `communication_type`, `risk_level`, `risk_score`, `detected_tactics[]`, `predicted_next_action`, `recommended_action`, `explanation`. Safety advice is written by the application, never by the model.
7. Show a proportional warning (Low / Elevated / High).

If the provider fails, the result is marked **incomplete**, rule warnings stay active, and the UI says the AI analysis could not finish. It never presents a fallback as an AI result. With no provider configured, the UI says "Independent rule checks (no AI provider configured)".

The **evidence score** (0–100) grows only with quoted evidence, stays inside its level's band (Low 0–29, Elevated 30–69, High 70–95), and never reaches 100. It is not a probability of fraud.

### Model benchmarking

Developer page: `#/developer` (linked in the footer). It runs 12 fixed synthetic scenarios (Scenarios A, B, and C plus 9 others, including 5 that are not scams) through Nemotron, Gemini, or the rule baseline, and shows **only measured results**:

- scam vs. not scam
- acceptable risk level
- benign scenarios kept low
- next-action match
- tactic recall and precision
- median latency
- tokens
- provider-reported cost

Explanations are shown side by side for human review. Results are stored in `evaluationScenarios`. The rule baseline was written alongside these scenarios, so its scores are optimistic, and 12 synthetic scenarios cannot establish real-world accuracy. The page says so.

On a deployed server, benchmarking requires a verified account listed in `BENCHMARK_ALLOWED_EMAILS`. In demo mode, only the rule baseline runs (in the browser).

## 7. Deploy to Vercel

1. Import the repository in Vercel (the Vite preset is detected; `vercel.json` sets the build, output, function duration, and security headers).
2. Add every variable from section 2 under Project → Settings → Environment Variables.
3. Deploy, then add the Vercel domain to Firebase **Authorized domains**.
4. Smoke-test: sign-up, verification email, Google sign-in, onboarding, a message check, a simulated call, history, and deleting history.

API routes (all need `Authorization: Bearer <Firebase ID token>` from a verified user):

| Route | Purpose |
| --- | --- |
| `POST /api/analyze-sms` | Message or link analysis |
| `POST /api/analyze-call` | Progressive call-transcript analysis |
| `POST /api/analyze` | Either channel (kept for compatibility) |
| `GET /api/benchmark-models` | Provider status and stored results (developers) |
| `POST /api/benchmark-models` | Run the scenarios on one provider (developers) |

`scripts/patch-jwks-rsa.mjs` works around an `ERR_REQUIRE_ESM` crash in firebase-admin's jwks-rsa dependency on Vercel. It runs on install and build ([auth0/node-jwks-rsa#507](https://github.com/auth0/node-jwks-rsa/issues/507)).

## 8. Demonstration walkthrough (about 6 minutes)

1. **Landing** (`/`): the tagline, the "scams don't arrive as one word" problem, the three levels of protection, the five engines, the privacy commitment, and why a carrier should care.
2. **Explore the demo → onboarding**: choose "Fewer interruptions", tick "family passphrase", set text size to **Large** (the whole app scales live), skip or add a trusted contact, then acknowledge privacy.
3. **Dashboard**: protection status, quick access, and recent activity. No invented statistics.
4. **Check a message → "Scenario B · Bank suspension"**: High risk. Shows the claimed identity (your bank), urgency, fear, the link request and the identity request, a note that the message refers to a link, a recommended action, the manipulation breakdown, and the predicted next step with its uncertainty. Then try **"Urgent but genuine"**: it stays **Low**, because a deadline alone isn't a scam.
5. **Call protection → Scenario A** (turn on "Play synthetic voices" if you like): the transcript and timer advance line by line. The arrest claim at turn 3 raises Elevated. At turn 5 ("I need money immediately") the prediction appears: "the caller may ask you to send money" (*Likely*). At turn 7 ("Please don't tell anyone") the call pauses with **Potential financial scam**, *before* the money request. Walk through **How do I verify this person?** (your chosen methods first, including the passphrase), **Show detected evidence**, **I need help**, and **Dismiss warning**. Resume to see the request arrive at turn 9 and the timeline mark "Predicted at turn 5, before the request at turn 9".
6. **Scenario C** (urgent but genuine call): a hospital emergency with fear and urgency, but no money, no secrecy, and an invitation to call back. It plays to the end at **Low risk** with no warning.
7. **Recovery Assistant**: "I sent money", then "I shared a verification code", then "I am not sure what happened" with its guided questions. The steps never promise money can be recovered.
8. **Protection history**: each check with its date, type, risk, indicators, predicted step, and **your action** ("Dismissed the warning"). Then **Settings → Delete all history**.
9. **Developer tools**: run the scenarios to show measured, caveated comparisons.

## Architecture

```
src/            main.js (routing, events), client.js (Firebase + demo data), views.js (app pages)
src/pages/      landing.js, onboarding.js, developer.js
src/            call-session.js (progressive playback + timer), call-voice.js (synthetic TTS), call-audio.js (warning sounds)
src/            styles.css, components.css, tokens.css
shared/         prediction.js (engines 2–4), detection.js (engine 1 rules + link inspection), network.js (engine 5, synthetic),
                report.js (structured JSON + model validation), evaluation.js (benchmark scenarios + scoring), fixtures.js, schema.js
server/         service.js, ai-provider.js, nemotron.js, gemini.js, prompt.js, http.js, auth.js, firebase.js, developer.js
api/            Vercel functions (also served by scripts/dev.mjs locally)
tests/, e2e/    unit, rules, and browser tests
```

## Product rules this build follows

No carrier integration is claimed, and no real call is monitored. There are no fabricated statistics or benchmark numbers, no customer vulnerability scores, and no profiling of a caller's personality or anyone's emotions. Trusted contacts are never contacted automatically. Every warning explains its evidence and uncertainty, and a legitimate-call scenario is included. API keys stay server-side, and private records are owner-only.

## Sources

- [Firebase Auth](https://firebase.google.com/docs/auth/web/start) · [Firestore rules](https://firebase.google.com/docs/firestore/security/get-started)
- [OpenRouter API](https://openrouter.ai/docs/api/reference/overview) · [Gemini API](https://ai.google.dev/api/generate-content)
- [FTC: what to do if you were scammed](https://consumer.ftc.gov/articles/what-do-if-you-were-scammed) · [ReportFraud.ftc.gov](https://reportfraud.ftc.gov/) · [IC3](https://www.ic3.gov/) · [IdentityTheft.gov](https://www.identitytheft.gov/)
