---
version: 1
slug: "src-recorded-tests-js"
primary_target: "src/recorded-tests.js"
related_targets: ["src/recorded-tests.css"]
---

# Recorded tests

The `#/recorded-tests` destination presents the six experiments supplied in
`LLM tone tests 1-6-20261108T155256Z-1-001.zip`. Each example includes the original
target recording, any reference used in that experiment, timestamp playback,
saved classifications, intended scripts, and the submitted prompt. It makes no
analysis requests. Original source documents and the unused generated audio are
available under **Source files**. Audio is loaded on demand and is not included
in the PWA's offline shell cache.

Source audio and text live in `public/recorded-tests/`. The structured view data
in `src/recorded-tests-data.json` preserves the supplied results, confidence
labels, and timestamp gaps. Scripts are written source material, not inferred
transcripts. Model/run settings are attributed to the archive, not independently
verified deployment settings.

Test 3 is the corrected run using the entire reference as a positive “happily”
example. Test 4 repeats that experiment with a required happy segment and labels
the weak evidence. Test 5 preserves the Gemini table's initial seven-second gap
and small intervening gaps. Only a Nemotron prompt was supplied for Test 5.
Test 6 includes Nemotron's original run through 02:25 followed by a continuation
clip, with its timestamps aligned to the target. The supplied 57.3% statistic is
time agreement with Gemini, not a measured accuracy score.

Playback follows explicit user actions. A timestamp starts the target at that
position. Starting the reference pauses the target and vice versa. Changing
tests or leaving the page stops the old recording; opening the mobile menu
retains playback. Native player controls provide seeking and playback speed.
Missing media shows recovery guidance and a download link.

## Direction contract

**THESIS:** Make each recorded experiment understandable by pairing listening
with the exact saved model output. Keep experiment conditions visible and place
long source material behind native disclosures.

**OWN-WORLD:** Extend T-Secure's existing Manrope typography, magenta selection,
pale rose canvas, flat work surfaces, and labeled navigation. This page uses the
existing design system without introducing new global tokens.

**STORY:** Select one of six experiments, listen to its target or reference, jump
to a reported tone segment, then inspect the original scripts and prompts.

**FIRST VIEWPORT:** A standard page introduction precedes a compact example
index and selected test. The desktop index sits beside the audio and results;
small screens stack the index above the example and reflow the results into
labeled rows. Native audio and timestamp buttons are the primary controls.

**FORM:** An extension of the existing application shell, using the user-approved
master/detail layout. Code-led implementation; no concept seed or image comp
applies to this precisely scoped addition.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Validation

Browser coverage in `e2e/recorded-tests.spec.js` exercises reference mapping,
constrained results, real MP3/M4A playback and seeking, mutual player exclusion,
mobile-menu preservation, example switching, keyboard controls, failed audio,
comparison provenance, and downloadable source links.
