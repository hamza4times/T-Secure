# Live audio validation — November 8, 2026

Call protection now uses actual microphone audio and, in practice mode, the actual PCM output of an interactive AI caller. ElevenLabs Scribe produces transcripts; completed segments are queued for Nemotron in batches of one or two sentences. No fixed transcript turns are added by the live interface.

## Verified

- The supplied ElevenLabs credential is stored as server-only `ELEVENLABS_API_KEY` in the ignored `.env`. `git check-ignore .env` confirms exclusion.
- Live provider checks successfully issued a single-use transcription token and generated speech.
- An end-to-end provider smoke check generated 142,664 PCM bytes, transcribed the audio into a 69-character committed segment, and returned a grounded Nemotron high-risk result with three reasons, `analysisSource=hybrid`, and `incomplete=false`. Nemotron also generated a caller response. No key, token, or raw user audio is included in this receipt.
- All eight dedicated live-audio browser checks passed across desktop and mobile Chrome. Chrome used fake microphone hardware while running real Web Audio capture, AudioWorklets, PCM scheduling, sentence batching, and alert controls; external HTTP/WebSocket providers were replaced at their boundaries. Tests cover spoken replies, microphone monitoring, permission denial, disconnection, and actual media-track release.
- All 44 combined desktop/mobile browser scenarios passed across the isolated suite and targeted reruns. Concurrent runs initially collided over default trace artifacts; the isolated run used a separate port and output directory. A restarted-call fixture was corrected to address the current user transcription socket, and slow microphone initialization was checked serially with a longer device-startup allowance.
- The final unit/service suite passed 73 tests, including the concurrently developed emotion integration.
- The production build and bundle-secret isolation check passed, including the new ElevenLabs secret sentinel. The existing lazy Firebase vendor-size warning remains.
- Desktop and mobile screenshots were inspected. The design detector reported existing palette/type-ramp metadata advisories; the established interface was preserved.

## Runtime boundaries

Model requests are serialized and spaced at least three seconds apart. Segmentation and provider latency affect alert timing. Independent rules can warn before Nemotron completes; unavailable AI analysis is identified explicitly. Pausing disables microphone input and suspends practice playback, while ending or leaving releases capture and closes transcription sockets. These controls do not hang up or intercept a real phone call.

T-Secure stores only derived check summaries. Session audio and transcript buffers remain in memory; ElevenLabs and OpenRouter retention policies apply to data sent to them.

No deployment was performed. Vercel needs `ELEVENLABS_API_KEY` and the existing server configuration separately. Guest live audio in production requires `LIVE_DEMO_ENABLED=true`; otherwise callers must sign in with a verified Firebase account. See [setup instructions](../README.md#live-audio-and-elevenlabs).
