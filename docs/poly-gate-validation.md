# Editable Poly-Si gate validation

Validated 2026-11-01.

- Gate polarity (n/P or p/B) and active concentration (1e17–1e20 cm⁻³) are editable in the PolySi deposition step. This is one uniform in-situ gate-film setting per device, shared by its PolySi gate films; SADP sacrificial PolySi is excluded.
- Recalculation updates material doping, the common 2D/3D color scale, work function, gate depletion and the educational I–V model. Si implantation fields remain independent.
- Gate-only changes reuse geometry caches. Reverse-design save/restore, undo, comparison drafts, previews, exports and tutor context carry the setting.
- Five PolySi examples (MOSFET, FD-SOI, PD-SOI, RCAT, charge trap): n/p at 1e18 and 1e20 change threshold and drain current at the same Vgs. Invalid inputs, full gate depletion, defaults/cache isolation and metal-gate invariance are covered by regression tests.
- All 24 baseline examples / 520 frames: geometry, 3,963 meshes, 4,680 X/Y/Z slices and exploded-view restoration passed. Actual browser checks covered 2,080 2D/3D renders in two batches (60 + 460 frames), with no blank Y/3D views, WebGL errors or overflowing parameter controls.
- Manual browser checks: gate controls, polarity/color response, I–V graph, reverse-design persistence, invalid concentration rejection and 390px mobile layout.
- Commands: `npm test`, `npm run build`, `npm run test:rendering`, `node tests/poly-gate-api.cjs`. `npm run qa:prepare` creates ignored localhost-only browser QA fixtures. Production API checks use `TEST_BASE`.

The electrical model is an educational 300 K work-function / depletion-capacitance approximation, not calibrated TCAD. It omits gate diffusion, grain-boundary trapping, degeneracy and bias-dependent gate depletion. Very low concentration can fully deplete a thin gate, in which case the UI reports the model limit instead of drawing an unsupported curve. Every baseline stage was checked, not every possible recipe parameter combination.
