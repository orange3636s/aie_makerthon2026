# Local recipe update validation

Scope: localhost:3004 only. No repository push or hosted deployment.

## Completed

- Length/rate inputs and axes show nm; solver and saved recipe units remain unchanged.
- Process Recipe replaces the basic/step condition tabs.
- New Photo operations: PR coating, Patterning, Developing, PR strip. Thickness belongs to coating. Patterning overlays a gray mask; Developing overlays arrows and applies timed vertical PR removal (1 nm/s, uncalibrated geometric model).
- New recipe choices omit Conformal, Pattern transfer, Selective removal, Metal and Dielectric; existing recipes remain readable and executable.
- Material choices put Poly Si after Si and include Al₂O₃ and HZO. HZO is a geometric material identity, not a ferroelectric model.
- Ion implantation / Diffusion / Oxidation have separate add buttons.
- C&C accepts removal rate, duration, and record-only slurry. Its ideal plane cut is capped at the last pre-deposition stop plane; no dishing or erosion is claimed.
- Changing examples cancels the old native calculation and ignores stale results.

## Automated checks

- `npm test`: all suites passed, including grading, recipe persistence, material rendering, AI response mocks, process estimates, and 572 unit roundtrips. No live API call.
- `npm run build`: passed.
- `tests/photo-cmp-native.py`: passed. Three Developing durations, both PR tones, immutable mask alignment, PR strip, C&C duration sensitivity, slurry geometry invariance, Al₂O₃/HZO deposition and etch; Photo Lithography has 7 frames.
- `tests/cancel-local.cjs`: native CFET task cancelled; next Photo job completed with 7 frames.
- Native MOSFET example: 19 frames, 12.336 s on this run, no failed stage, final concentration present. This is a local measurement, not a general timing guarantee.
- CMP-Sim: 38 upstream tests passed; oxide/Cu/W examples and steady-state diagnostics reviewed separately. Not integrated; see [review](CMP-Sim-review-2026-10-28.md).

## Browser checks

- CFET → PN Junction during initial calculation: navigation remained enabled and final page stayed on PN Junction.
- Selected Developing step remained selected after recalculation.
- Gray masks in 2D/2.5D, Developing arrows and partial PR removal inspected.
- Reverse editor: new Photo defaults to coating; Patterning hides thickness; implant and oxidation have distinct fields; advanced deposition controls start collapsed; preview displays only title and thickness.
- Material ordering, missing generic placeholders and retained legacy recipe values checked.
- C&C 1 nm/s × 20 s and 10 nm/s × 120 s executed through the UI, showing partial removal and final plane cut.
- 390 × 844 viewport: document width 375 px; recipe form stayed within viewport. Temporary viewport override reset.
- Final browser console: no captured errors. Desktop 2.5D view inspected.

Legacy full browser-scenarios fixture was not rerun; obsolete tab-specific assertions need separate maintenance. Current coverage uses automated contract/native tests and the browser interactions above.
