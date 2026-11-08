# T-Secure

A Vite + vanilla JavaScript app for senior scam protection. Includes live audio monitoring, an interactive voiced practice caller, message/link checks, a trusted contact, recovery guidance, opt-in sample-history assessments, and a T-Life concept profile.

## Run locally

Requires Node.js 22.12+ (tested with Node 24).

    npm ci
    npm run dev

Open http://localhost:5173. With Firebase configured, this opens sign-in; “Explore the local demo” remains available. Without Firebase configuration, the app opens the labeled demo directly. Demo preferences, contacts, derived assessments, and check summaries stay in this browser. Raw pasted messages and call transcripts are never written to browser storage.

## Install on a phone (PWA)

Production URL: https://t-secure-pi.vercel.app. Deploy this checkout to the existing Vercel project to enable the PWA there; no new domain or app-store release is required.

- **Android:** open the site in Chrome, then use its menu → **Install app** (or **Add to Home screen**).
- **iPhone/iPad:** open the site in Safari, then Share → **Add to Home Screen**. Enable **Open as Web App** if offered.

The installed app opens in its own window with the T-Secure shield icon. Manifest URLs are relative to the current origin, so preview deployments remain separate from the production installation.

**Automatic updates:** every production build generates `/sw.js` with a revision calculated from the actual application files. The app checks for updates on opening, returning to the foreground, reconnecting, and once per minute while visible. New files download automatically. The update activates and reloads when every open app tab is idle; active or paused calls, ongoing actions, focused inputs, and unsaved forms defer it. Save the form or leave it, or end the call, to allow the update. Reinstallation is unnecessary. Browsers control checks while an app is closed or suspended; this does not promise continuous background updates.

**Offline:** after a successful online visit and completed cache installation, the app shell, fonts, safety/recovery guides, and local demo message checks can reopen offline. Use **Explore the local demo** if account data cannot load. Sign-in, private account sync, live audio/transcription, and AI analysis need internet. An offline notice explains these limits. The service worker caches only the public build files; it never caches API responses, Firebase/provider traffic, raw messages, audio, or transcripts.

`vercel.json` prevents stale HTML, manifests, and service-worker scripts. Keep `/sw.js` at the origin root and keep these headers when changing deployment configuration. PWA registration is production-only so it cannot cache the Vite development server.

Verify with `npm run test:pwa`: this builds two production releases and tests installation eligibility, icons, offline reopening, private API cache exclusions, automatic upgrades, multi-tab draft protection, and active/paused call protection in desktop and mobile Chrome. `npm run build` includes PWA assets automatically. The committed PNG icons are derived from the existing favicon; regenerate them with `node scripts/generate-pwa-icons.mjs` when branding changes (requires local Chrome).

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

### Live audio and ElevenLabs

The supplied ElevenLabs key is saved in the ignored `.env` as `ELEVENLABS_API_KEY` (server only). Optional `ELEVENLABS_VOICE_ID` defaults to `JBFqnCBsd6RMkjVDRZzb`; `ELEVENLABS_TTS_MODEL` defaults to `eleven_flash_v2_5`. The key needs text-to-speech and realtime speech-to-text/token permissions and sufficient credits.

Open **Call protection**, choose an audio source, and press Start. Allow microphone access. **Interactive AI practice caller** generates short Nemotron replies and streams ElevenLabs PCM speech; reply aloud in your own words. **Live microphone monitoring** checks speech or speaker audio near your microphone without generating a caller. Headphones are recommended for practice. HTTPS or localhost is required. Browser permissions and provider access are required; failures are shown explicitly.

Actual 16 kHz audio goes through ElevenLabs Scribe realtime transcription using single-use tokens. The caller's playback and microphone use separate transcription streams so caller dialogue is never substituted for recognized audio. Completed transcripts are split into batches of at most two sentences and queued for Nemotron through OpenRouter, at least three seconds between requests and only one request in flight. Two complete partial sentences request an early transcript commit; shorter utterances commit after a voice-activity silence boundary. Latency includes speech segmentation, queued inference, and provider response time; this is not a hard realtime guarantee.

Localhost guests can use live providers. Production requires verified Firebase authentication, or the explicit server setting `LIVE_DEMO_ENABLED=true` to allow guests. Production guests use shared Firestore rate limits by a hashed network address. Set the ElevenLabs key, existing OpenRouter/Firebase secrets, and optional guest setting in Vercel separately; `.env` is not deployed automatically. Provider credentials never enter the browser bundle. Single-use transcription tokens expire and cannot be reused.

T-Secure keeps audio and raw transcripts in session memory and saves only derived check summaries. Audio is sent to ElevenLabs, and transcripts are sent to OpenRouter; their retention policies apply. Ending a call, navigating away, or losing transcription stops capture and playback. Pausing suspends audio processing and disables the microphone track; it does not hang up a real phone call. Call protection does not intercept a telephone line.

Only VITE_ variables enter the browser bundle. Never give server credentials that prefix. Environment files are ignored by Git. Keep provider keys and service-account JSON out of source control.

The connected app requires a verified Firebase email before private data or analysis is available. Firebase's hosted email handler completes verification; return and choose “I've verified my email.” Google uses Firebase popup sign-in.

Message checks fall back to independent rules if OpenRouter is unavailable, and identify incomplete analysis. Historical assessment requires successful, grounded model extraction; it does not silently substitute a fabricated AI result. The selected endpoint does not support response_format, so JSON is requested in the prompt and evidence is validated server-side. Optional extended reasoning is disabled to meet interactive deadlines. Whitespace around fenced JSON is accepted; truncated responses are rejected.

Local live-service checks confirmed authenticated profile loading, consent, Nemotron assessment and communication analysis, private Firestore contact persistence, shared profile views, and assessment removal on opt-out. Firestore rules and indexes were deployed to t-secur1. Vercel still needs its own environment configuration.

## Demonstration modes

- Calls: real microphone capture and Nemotron inference; optional fictional, interactive AI caller with ElevenLabs speech. No call interception, inbox access, or automatic blocking.
- Local messages: browser rules, labeled as such. Links are never opened or fetched.
- Local advanced analysis: annotated synthetic evidence, explicitly labeled demo-fixture.
- Connected analysis: authenticated server-side OpenRouter Nemotron inference plus independent rule checks.
- T-Life preview: a concept reading the same private assessment. It does not access the real T-Life application.

The sample histories demonstrate 83/100 observed risky responses, 0/100, and insufficient evidence. Zero is not a safety guarantee. This index is a prototype, not a validated probability of future fraud.

## In-call alerts

Call protection includes prevention guidance, real-time risk labels with highlighted transcript evidence, and recovery links after the call. A grounded caution warning shows a banner without interrupting. The first grounded high-risk warning pauses monitoring and practice playback and opens a keyboard-accessible dialog with the evidence, independent-verification guidance, a trusted-contact action, and controls to end or continue the demo. Escape keeps audio paused. Reviewing the alert never clears the warning.

Each call announces at most one caution and one high-risk escalation. Repeated tactics can update the evidence without replaying audio or reopening the dialog. Incomplete analysis is identified separately and does not itself trigger a scam alert. Starting a new call resets this alert budget.

“Call alert audio” defaults to visual-only alerts. Users can opt into a gentle device tone or fixed spoken guidance; that preference stays in this browser. No caller content or model-generated instructions are spoken. Audio stops when the warning is reviewed or the call ends. Visual alerts remain available when the browser cannot play audio. This does not inject sound into a real phone call or implement private/binaural carrier audio.

### Emotion-aware check-ins

The same free OpenRouter Nemotron request can extract a possible expressed emotion from the latest explicitly attributed user turn: sadness, fear, anxiety, loneliness, overwhelm, excitement, or neutral. The API validates the turn ID and exact evidence. Caller speech, unattributed mixed audio, missing evidence, unsupported labels, and failed analysis produce “not enough information.” New user speech clears the old cue while its analysis is pending. These are uncertain wording cues, not acoustic emotion detection, diagnoses, or predictions of susceptibility.

An emotional cue with an unknown/unverified caller, or a grounded caution/high-risk call, displays a supportive check-in and a pause-to-verify action. For example: “You may be feeling sad. Is everything okay?” It announces at most once per call, uses fixed application wording with the existing optional tone/spoken-guidance setting, and never raises scam risk by itself. Caller verification is selected manually before the call; a saved name or familiar voice is not sufficient. Risk warnings still apply to verified callers. Current mixed microphone monitoring does not identify the user's voice, so personal emotion cues are available in practice calls with separate user/caller streams. Emotion cues and excerpts are transient and are never saved to incident history or the vulnerability assessment.

## Architecture

- src/: frontend, Firebase client, call scheduler, views, and styles.
- shared/: independent rules, runtime validation, scoring, and synthetic fixtures.
- server/: Firebase Admin store, authentication, service logic, OpenRouter adapter, and HTTP wrapper.
- api/: Vercel functions, also served by the development server.
- tests/ and e2e/: behavior, security-rule, and browser tests.

### API

Profile routes and `/api/analyze` require `Authorization: Bearer <Firebase ID token>` for a verified user. `/api/call` follows the live-audio identity/guest policy above. Responses are not cached.

| Route | Behavior |
| --- | --- |
| POST /api/call | Live call actions: single-use transcription token, Nemotron caller reply, streaming PCM speech, and grounded live analysis. Local guests supported; production identity/guest policy described above. |
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

## Recorded tests

Open **Recorded tests** in the navigation to explore six supplied tone-analysis
experiments. Play the original target/reference recordings, jump to timestamps,
compare saved classifications, and expand the scripts, prompts, and source files.
The examples use bundled recordings and saved results without calling an analysis
provider. Audio loads on demand and needs a connection to the app server.
See [recorded-test notes](docs/recorded-tests.md) for source mapping, experiment
conditions, and validation coverage.

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
- [ElevenLabs realtime transcription](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime)
- [ElevenLabs single-use tokens](https://elevenlabs.io/docs/api-reference/tokens/create)
- [ElevenLabs streaming speech](https://elevenlabs.io/docs/api-reference/text-to-speech/stream)
- [FTC recovery guidance](https://consumer.ftc.gov/articles/what-do-if-you-were-scammed)
- [Vishing survey](https://doi.org/10.1016/j.csl.2025.101802)
- [NIST measurement guidance](https://airc.nist.gov/airmf-resources/playbook/measure/)
