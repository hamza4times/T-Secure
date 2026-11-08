# T-Secure

A Vite + vanilla JavaScript app for senior scam protection. Includes progressive call simulations, message/link checks, a trusted contact, recovery guidance, opt-in sample-history assessments, and a T-Life concept profile.

## Run locally

Requires Node.js 22.12+ (tested with Node 24).

    npm ci
    npm run dev

Open http://localhost:5173. With Firebase configured, this opens sign-in; “Explore the local demo” remains available. Without Firebase configuration, the app opens the labeled demo directly. Demo preferences, contacts, derived assessments, and check summaries stay in this browser. Raw pasted messages and call transcripts are never written to browser storage.

## Connect Firebase and OpenRouter

1. Create a Firebase project and web application.
2. Enable Authentication → Email/password and Google. Configure the Google provider's support email.
3. Create Firestore and deploy this project's rules:

       firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID

4. Browser configuration for t-secur1 has been added to the ignored .env file. For a new checkout, copy .env.example to .env and fill in VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID. The bucket and messaging sender fields are optional.
5. The supplied project's public Auth configuration was verified and currently includes localhost. Use http://localhost:5173 for local Google sign-in. Add the exact Vercel domain before deployment; add 127.0.0.1 only if you choose to use that hostname.
6. The supplied Firebase Admin service account is configured locally as FIREBASE_SERVICE_ACCOUNT_JSON. For a new checkout, set it to a single-line service-account JSON object for the same project, preserving private-key JSON escapes. This is a server secret.
7. The supplied OpenRouter key is configured locally as OPENROUTER_API_KEY. OPENROUTER_MODEL defaults to the requested nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free. The key is required even for free models. Requests use https://openrouter.ai/api/v1/chat/completions; no alternate model or paid fallback is configured.
8. Restart the dev server.

Only VITE_ variables enter the browser bundle. Never give server credentials that prefix. Environment files are ignored by Git. Keep provider keys and service-account JSON out of source control.

The connected app requires a verified Firebase email before private data or analysis is available. Firebase's hosted email handler completes verification; return and choose “I've verified my email.” Google uses Firebase popup sign-in.

Message checks fall back to independent rules if OpenRouter is unavailable, and identify incomplete analysis. Historical assessment requires successful, grounded model extraction; it does not silently substitute a fabricated AI result. The selected endpoint does not support response_format, so JSON is requested in the prompt and evidence is validated server-side. Optional extended reasoning is disabled to meet interactive deadlines. Whitespace around fenced JSON is accepted; truncated responses are rejected.

Local live-service checks confirmed authenticated profile loading, consent, Nemotron assessment and communication analysis, private Firestore contact persistence, shared profile views, and assessment removal on opt-out. Firestore rules and indexes were deployed to t-secur1. Vercel still needs its own environment configuration.

## Demonstration modes

- Calls: fictional text conversations; no microphone, call interception, inbox access, or automatic blocking.
- Local messages: browser rules, labeled as such. Links are never opened or fetched.
- Local advanced analysis: annotated synthetic evidence, explicitly labeled demo-fixture.
- Connected analysis: authenticated server-side OpenRouter Nemotron inference plus independent rule checks.
- T-Life preview: a concept reading the same private assessment. It does not access the real T-Life application.

The sample histories demonstrate 83/100 observed risky responses, 0/100, and insufficient evidence. Zero is not a safety guarantee. This index is a prototype, not a validated probability of future fraud.

## In-call alerts

Call practice includes prevention guidance, real-time risk labels with highlighted transcript evidence, and recovery links after the call. A grounded caution warning shows a banner without interrupting. The first grounded high-risk warning pauses the simulation and opens a keyboard-accessible dialog with the evidence, independent-verification guidance, a trusted-contact action, and controls to end or continue the demo. Escape keeps the call paused. Reviewing the alert never clears the warning.

Each call announces at most one caution and one high-risk escalation. Repeated tactics can update the evidence without replaying audio or reopening the dialog. Incomplete analysis is identified separately and does not itself trigger a scam alert. Starting a new call resets this alert budget.

“Call alert audio” defaults to visual-only alerts. Users can opt into a gentle device tone or fixed spoken guidance; that preference stays in this browser. No caller content or model-generated instructions are spoken. Audio stops when the warning is reviewed or the call ends. Visual alerts remain available when the browser cannot play audio. This does not inject sound into a real phone call or implement private/binaural carrier audio.

## Architecture

- src/: frontend, Firebase client, call scheduler, views, and styles.
- shared/: independent rules, runtime validation, scoring, and synthetic fixtures.
- server/: Firebase Admin store, authentication, service logic, OpenRouter adapter, and HTTP wrapper.
- api/: Vercel functions, also served by the development server.
- tests/ and e2e/: behavior, security-rule, and browser tests.

### API

All routes require Authorization: Bearer <Firebase ID token> for a verified user. Responses are not cached.

| Route | Behavior |
| --- | --- |
| POST /api/analyze | Accepts channel, text, sequence, optional sessionId and source; returns grounded reasons and a server session ID. |
| POST /api/profile/consent | Stores enabled, allowlisted historySetId, consent version/time, and an incremented revision; removes the previous assessment. |
| POST /api/profile/analyze | Loads sample history, extracts evidence, computes the score, and commits only if consent still matches. |
| GET /api/profile | Returns the owner's consent and assessment. |
| DELETE /api/profile | Deletes the assessment and invalidates pending results. |

Limits: 12,000 text characters, a 60 KB HTTP body cap, 45 ordinary requests/minute/user, and 8 profile mutations/minute/user. Calls permit one analysis in flight with a minimum three-second interval. Provider timeouts are 8 seconds for communication and 25 seconds for sample history. Failed analysis endpoints back off for at least 30 seconds after 429/503, respecting Retry-After. Call network errors also back off. Existing warnings remain active; consent changes, deletion, and unrelated analysis routes remain available.

### Stored data

    users/{uid}/settings/contact
    users/{uid}/private/consent
    users/{uid}/private/assessment
    users/{uid}/incidents/{sessionId}
    _limits/{uid-kind}

Contacts are owner-managed with bounded fields. Scores, consent revisions, and analysis summaries are server-written. Clients can update only reviewed recovery-step identifiers on incidents. Other access is denied. Admin operations repeat identity and ownership checks because Admin bypasses rules.

No raw message, transcript, evidence excerpt, provider output, or token is persisted in incident documents or application logs. Sample fixtures are synthetic. Derived history remains until deletion.

Opting out deletes the assessment transactionally. Deletion also advances the consent revision so an in-flight job cannot restore it.

## Verification

    npm test
    npm run build
    npm run test:e2e
    npm run test:bundle

Browser tests use installed Google Chrome and a separate demo-only server on port 5175, isolated from the live Firebase .env configuration. If Chrome is unavailable, install a Playwright browser and change the configured channel.

Local Firebase tests require Firebase CLI and Java 21+:

    firebase emulators:exec --only firestore --project demo-tsecure "npm run test:rules"
    firebase emulators:exec --only auth,firestore --project demo-tsecure "npm run test:auth"

Auth tests use synthetic accounts and a separate development server on port 5174. Emulator connections are development-only.

With the normal preview server running:

    npm run test:a11y
    npm run capture

For call alerts across desktop, mobile, landscape, and zoom-equivalent viewports:

    node scripts/audit-call-alerts.mjs

Reports/screenshots go under ignored artifacts/qa/. Captures check overflow, browser exceptions, and a 720px CSS viewport equivalent to 200% zoom on a 1440px display. Automated accessibility checks complement manual review.

The bundle check builds with synthetic server-secret sentinels and verifies that they never enter browser output. Expected permission-denied messages appear during denied-access rule tests.

See [validation notes](docs/VALIDATION.md) for completed checks and deployment limitations.

Patched dependency overrides address SDK advisories without downgrading Firebase. Keep package-lock.json, rerun tests when upgrading, and check npm audit.

Firebase Admin 14.5.0 brings jwks-rsa 4.1.0, whose synchronous CommonJS imports of ESM-only jose 6 can crash Vercel functions with ERR_REQUIRE_ESM. scripts/patch-jwks-rsa.mjs replaces those two imports with asynchronous imports while retaining the installed versions and verification logic. Both postinstall and the build command apply this version-checked, idempotent patch, including when Vercel reuses dependency caches. Recheck the patch when upgrading jwks-rsa. The upstream compatibility issue is tracked at [auth0/node-jwks-rsa#507](https://github.com/auth0/node-jwks-rsa/issues/507).

The runtime regression in npm test disables synchronous require(ESM), boots every API handler, checks unauthenticated rejection, and validates real RSA signing-key conversion and tampered-signature rejection. API response tests also cover platform text/HTML errors and malformed successful responses; users receive a readable service error instead of a JSON parser exception.

## Deploy to Vercel

1. Sign in to Vercel CLI or import the repository in its dashboard.
2. Use the Vite preset; vercel.json configures the output, API duration, and headers.
3. Add Firebase browser configuration and backend secrets as Vercel environment variables.
4. Run vercel --prod, then authorize that exact domain in Firebase Authentication.
5. Smoke-test verification email, Google popup, privacy isolation, message analysis, profile opt-in, and opt-out.

Without configuration, deployment exposes only the labeled local demo. Real T-Life/carrier support needs an authorized API and identity contract. Firebase email matching alone is not a T-Mobile identity link.

## Sources

- [Firebase authentication](https://firebase.google.com/docs/auth/web/start)
- [OpenRouter model](https://openrouter.ai/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free)
- [OpenRouter API](https://openrouter.ai/docs/api/reference/overview)
- [FTC recovery guidance](https://consumer.ftc.gov/articles/what-do-if-you-were-scammed)
- [Vishing survey](https://doi.org/10.1016/j.csl.2025.101802)
- [NIST measurement guidance](https://airc.nist.gov/airmf-resources/playbook/measure/)
