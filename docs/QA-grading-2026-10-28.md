# Doped-device grading regression · 2026-10-28

The old evaluator used only material geometry outside PN Junction. Removing all
implantation and annealing from MOSFET, RCAT and Charge Trap Flash therefore
left the same polygons and earned 100. This was an assessment defect, not proof
that an undoped device works.

## Assessment v2

- MOSFET, RCAT, BCAT, FD/PD-SOI and Charge Trap Flash: geometry 50%, total
  concentration 20%, active concentration 20%, completed process evidence 10%.
- PN Junction: 20%, 35%, 35%, 10%, respectively.
- Geometry uses material-balanced IoU in the existing fixed ROI (Si weight 0.25).
- Each concentration component averages signed log net concentration and each
  required species field in the same ROI. Values use cm^-3 and the existing
  10^14–10^20 log display range. Missing/malformed fields contribute zero;
  corrupt target fields raise a visible error instead of falling back to geometry.
- Each required species must have a completed implant and an anneal after its
  latest implant. Native frame snapshots record successful operations, not labels
  or the number of steps in the submitted recipe. Reimplantation invalidates that
  species' previous anneal evidence. Alternative recipes can still score well.
- Missing evidence/fields or concentration similarity below 99.5% prevents rounding
  to 100. These weights/tolerances are educational choices, not physical laws.
- Gate cross-sections with S/D outside the displayed plane remain geometry-only.
  No score verifies I–V, contact resistance, SONOS storage or manufacturing yield.

## Actual native results

| Target | Canonical flow | Remove implant + anneal | Remove anneal only | Dose × 0.01 |
|---|---:|---:|---:|---:|
| MOSFET | 100 | 50 | 75 | 80 |
| RCAT | 100 | 50 | 75 | 74 |
| BCAT | 100 | 50 | 75 | — |
| FD-SOI | 100 | 50 | 75 | — |
| PD-SOI | 100 | 50 | 75 | — |
| Charge Trap Flash | 100 | 50 | 75 | 73 |
| PN Junction | 100 | 20 | 60 | 63 |

All removal scenarios completed natively with geometry IoU 1. Their lower scores
come from concentration and process evidence, not invented geometric changes.
Seven canonical references were regenerated with completed-operation evidence.

## PVD / CVD

The current implementation intentionally shares SingleParticleProcess. Identical
numeric parameters produce identical polygons; this is now identified as a preset
in the editor and documentation. Server, Python and draft restoration use PVD
defaults (sticking 1, exponent 20) and CVD defaults (0.2, 1) consistently. Explicit
parameters are preserved. Four trench runs verify different default-preset shapes
and identical matched-parameter shapes. A dedicated sputter/chemistry model has
not been added or claimed.

## Reproduction and UI verification

- `npm test`: all 14 canonical self-comparisons, substrate/material/position
  counterexamples, seven doped targets with missing total/active fields, missing
  history, zero/low dose, corrupt grids, compensation and polarity cases.
- `python tests/native_grading.py`: 25 dopant scenarios and four deposition runs.
  `--update-references` explicitly regenerates the seven doped reference files.
- `node tests/http-grading.cjs http://127.0.0.1:3012 --presets`: real HTTP/native
  MOSFET, RCAT and CTF removal tests, reference 100, server preset defaults and
  malformed-input rejection. The same command without `--presets` accepts a
  deployed base URL and verifies the served evaluator exactly matches local code.
- Browser: load MOSFET answer → 100; delete steps 8/7 → recalculate → 50 with
  missing concentration/implant/anneal feedback; reload draft → same result.
- Total/active concentration selection uses the same field for both panels.
  Missing active concentration is explicitly shown as uncalculated instead of
  silently substituting total concentration.
- Desktop and 390px mobile layout: score chips, missing-process feedback, field
  selector and grading weights render without horizontal page overflow.

Runtime: pinned ViennaPS 4.6.2 geometry + 4.7 transport worker, CPU, Windows x64.
Machine-readable native reports are generated at `.runtime/grading-v2/report.json`.

Production Linux verification: MOSFET, RCAT and CTF with omitted doping score 50;
RCAT and CTF canonical native recalculations score 100. RCAT has approximately
0.17% geometry-raster difference from the saved Windows reference. Comparing
canonical and no-doping results within the same Linux runtime gives IoU 1.
The HTTP regression therefore tests this causal invariant against a fresh native
baseline and allows up to 0.5% contour-raster difference across platforms.
The application grading formula itself was not relaxed for this test.
