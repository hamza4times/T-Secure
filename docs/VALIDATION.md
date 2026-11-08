# T-Secure verification

Verified locally on November 8, 2026 (Windows 11, Node 24.19, Chrome via Playwright 1.65), in demo mode with no Firebase or AI credentials.

## Passing checks

| Check | Result |
| --- | --- |
| Unit tests (`npm test`): engines, Scenarios A/B/C, evidence score bands, structured report shape, model-output validation, caller-only grounding, provider resolution, Nemotron and Gemini adapters, service, benchmark, developer access, call scheduling and alerts, audio, restricted-ESM function startup | 69 / 69 passed |
| Browser tests (`npm run test:e2e`), desktop 1440×1000 and Pixel 7 | 34 / 34 passed (17 per project) |
| Axe WCAG 2.1 A/AA (`npm run test:a11y`), 15 routes × 2 viewports, including landing, sign-in, sign-up, and onboarding | 0 violations |
| Layout capture (`npm run capture`), desktop, 390px, 320px, tablet, landscape, 720px zoom-equivalent | No browser errors, no horizontal overflow |
| Production build and server-secret isolation (`npm run test:bundle`), OpenRouter, Gemini, and Firebase Admin sentinels | Passed |

Scenario behavior (rule engine, verified by unit and browser tests):

- **A (family emergency call):** Elevated at turn 3 (arrest claim). Payment request predicted (*Likely*) at turn 5. High-risk warning and pause at turn 7 (secrecy). The money request arrives at turn 9.
- **B (bank suspension text):** High. Bank impersonation, fear, and urgency, plus link and identity-verification requests. The text refers to a link without containing one, and this is noted.
- **C (urgent but genuine family call):** Low at every turn, despite fear and urgency, because there is no money, no secrecy, and the caller invites a callback.

The rule baseline scores 12/12 on classification and 11/12 on next action across the evaluation scenarios. It was written alongside them, so these numbers are optimistic and do not validate real-world accuracy.

## Not verified in this environment

- **Firestore rules and emulator auth tests** (`tests/rules/`, `e2e/auth/`) were rewritten for the new collections and flows, but were not run: the Firebase CLI and Java are not installed on this machine. Run them before deploying the rules.
- **Live Nemotron and Gemini calls.** No API keys were available. The adapters are covered with mocked HTTP responses, and benchmarks against the real models still need to be run from the developer page.
- **Live Firebase.** Email delivery, Google OAuth completion, and Firestore persistence for real accounts need a smoke test once credentials are configured.
- **Vercel deployment** has not been performed.
- **Speech output** was tested with a stubbed browser speech API; check it on a physical device.

The build keeps a size warning for the lazily loaded Firebase Firestore chunk (about 580 KB). It loads only for signed-in accounts.
