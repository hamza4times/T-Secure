# T-Secure verification

Verified locally on November 7, 2026.

## Passing checks

| Check | Result |
| --- | --- |
| Core detection, scoring, consent, authentication guards, service behavior, call scheduling/alerts, audio lifecycle, OpenRouter adapter, and restricted-ESM runtime startup | 43 tests passed |
| Firestore security rules on demo-tsecure emulator | 8 tests passed |
| Desktop, portrait mobile, and landscape Chrome interaction flows | 26 tests passed |
| Plain-text/HTML platform crashes, malformed API responses, reviewed JSON errors, and valid profile responses | 4 new desktop/mobile regression tests passed |
| Firebase Auth + Firestore integration | 4 tests passed |
| Axe WCAG A/AA checks across 10 routes × 2 viewport sizes | 0 violations |
| Call caution, high-risk dialog, and after-call states × 5 viewport sizes | 15 checks; 0 accessibility violations, browser errors, or horizontal overflow |
| Production build and server-secret sentinel isolation | Passed; 7 browser artifacts inspected |
| Production dependency audit | 0 known vulnerabilities |
| Screenshot/layout capture | No browser exceptions or horizontal overflow |

Authentication integration on local Firebase emulators covers signup, email verification, login, private contact persistence, password reset, sign-out, account-bound advanced-analysis opt-in, Google popup cancellation, and API rejection of missing/invalid/unverified tokens. It also verifies that an AI provider failure cannot block opting out or subsequent standard message checks. Synthetic accounts only.

The scoring checks cover minimum evidence, uncertain responses, incoming-threat volume, repeated evidence, and grounded user turns. Consent tests cover account binding, opt-out during extraction, and deletion while extraction is in flight. Call tests cover pause/resume, persistent warnings, late results, and leaving/returning through navigation.

Call-alert checks additionally cover one alert per risk level per call, non-interrupting caution, a single high-risk pause, new-call reset, no scam alert for incomplete/benign analysis, grounded model escalation, keyboard review and Escape behavior, no repeated interruption after continuing, transcript focus retention, and visible actions at zoom-equivalent sizes. Audio checks cover visual-only defaults, optional tones and fixed spoken advice, cancellation on review/end, unavailable browser APIs, and cancellation while audio activation is pending. Browser speech tests use a controlled API stub; physical speakers and platform speech engines still need device testing.

The native warning dialog keeps its heading and actions visible while details scroll. The transcript and long warning details accept keyboard focus. Essential warning copy remains 20px. A new script, scripts/audit-call-alerts.mjs, writes targeted screenshots and an accessibility/layout report under artifacts/qa/call-alerts/.

Desktop captures use 1440 × 1000; mobile captures use 390 × 844 and 320 × 740. Additional captures cover 768 × 1024 tablets and 844 × 390 landscape phones. The layout pass also checks 720 CSS pixels as a 200%-zoom equivalent. The responsive Menu exposes every destination, closes after navigation, and uses keyboard-operable controls with at least 48px targets. These are Chrome viewport checks; physical-device testing remains separate.

Toolchain: Node 24.13.0, Vite 8.3.6, Playwright 1.65.0 with installed Chrome, Firebase CLI 15.34.0, Java 26.0.2.1.

## Live-service fixes and verification

The login error reported on t-secure-pi.vercel.app was reproduced publicly: unauthenticated requests to both /api/profile and /api/analyze returned HTTP 500 text/plain with FUNCTION_INVOCATION_FAILED before application authentication ran. Supplied Vercel logs identified ERR_REQUIRE_ESM in jwks-rsa's synchronous import of jose. A fresh local process with --no-experimental-require-module reproduced the same failure. The version-checked installation/build patch now loads jose asynchronously in both jwks-rsa entry paths, retaining current dependency versions. The restricted-loader regression boots all four API handlers, confirms HTTP 401 JSON for absent identity, converts an RSA JWK, accepts a genuine signature, and rejects a modified message.

Client.api now catches non-JSON and malformed responses, preserves HTTP error status, rejects null/array responses, and displays a readable service message. It retains valid application JSON errors. The four new browser regression checks pass on desktop and mobile. Production still needs this source revision deployed before the public login failure can be considered resolved.

An isolated npm ci without environment files applied the compatibility patch through postinstall, retained the locked dependency versions, and reported zero known vulnerabilities. Running the restricted-loader startup/RSA regression from that clean installation passed. Re-running the patch was a no-op verification. Production build and browser-secret isolation also passed.

The original repeated 503s came from missing Firebase Admin configuration. The supplied Firebase service account and OpenRouter key are now stored in the ignored .env file. A read-only Firestore request and provider-key authorization both succeeded. No credentials are included in this report.

An authenticated live-project smoke test against t-secur1 returned 200 for GET /api/profile, POST /api/profile/consent, POST /api/profile/analyze, and POST /api/analyze. The model produced 83/100 from six assessable responses across three conversations. Communication analysis returned a high warning with hybrid analysis and incomplete=false. A real Firebase session in mobile Chrome saved a private trusted contact, displayed the same assessment in both profile views, and removed the Firestore assessment on opt-out. Its temporary synthetic Auth account, private documents, incidents, and rate-limit records were removed afterward. Reports are under ignored artifacts/qa/.

Firestore rules and indexes were deployed successfully to t-secur1. No new service-account identities, keys, or IAM grants were created.

The selected free model's optional extended reasoning caused incomplete responses or exceeded the interactive deadline. The adapter now disables optional thinking, accepts whitespace around fenced JSON, and rejects truncated/nonfinal content. Evidence remains grounded against source text and turn IDs. Endpoint-specific 429/503 backoff and call-error cooldown prevent repeated failed requests without blocking consent changes, deletion, or unrelated checks.

The live synthetic model evaluation produced expected scores of 83, 0, and insufficient information, with 14/14 response classifications correct and benign surprise-party conversations excluded. Primary tactic categories matched 11/14 fixed labels; category selection remains a prototype limitation. Those three requests took approximately 1.6–4.3 seconds each. These small fixture checks do not validate real-world fraud prediction.

## Remaining external setup

- Vercel CLI had no existing credentials. No public deployment was performed; Vercel needs the same environment-variable names configured separately.
- Actual T-Life/carrier integration is outside this prototype; its profile view is labeled as a concept.

The Firebase public project-config request returned 200 for t-secur1 and authorized localhost, t-secur1.firebaseapp.com, and t-secur1.web.app. Use http://localhost:5173 for local Google sign-in. Live email delivery and a completed Google OAuth sign-in still need checks with the intended account; verification and cancellation behavior passed on emulators.

The build retains a size warning for the approximately 580 KB lazy-loaded Firebase Firestore vendor chunk. The local demo entry is approximately 64 KB before compression; no size warning was suppressed.

Use README.md and .env.example for setup, then repeat deployed signup, Google sign-in, inference, profile revocation, and private-data smoke tests before sharing a production URL.
