# Device I–V extension

All 11 device examples now expose an educational I–V view in Learning Analysis → Device characteristics. No process solver, grading rule, reference geometry or AI call was changed.

- PN Junction: Shockley diffusion current; active net doping peaks are uniform-junction proxies. Area, lifetime and ideality are assumptions.
- MOSFET: existing validated square-law routine retained.
- FD/PD SOI: finite-body depletion charge using extracted Si body thickness.
- RCAT/BCAT: recessed U-path effective channel length.
- FINFET/GAAFET/MBCFET: equivalent long-channel FET with extracted central gate length/EOT; total gated width is explicitly assumed, not reconstructed from 2D.
- CFET: separately checked n/p active regions and two independent transistor curves. Not an inverter model.
- Charge Trap: present dielectric stack capacitance only. Current reference lacks central nitride; UI reports this instead of claiming memory operation.

Limitations: no electrical TCAD, BSIM, short-channel, quantum, contact-resistance, trap programming or retention model. Default mobility, background concentration, flat-band voltage and dielectric constants are teaching assumptions. Full details are in `web/learning-models.html#iv`.

## Executed local checks

- `node tests/device-iv.cjs`: all 11 references; empty/absent geometry, removed gate/dielectric, missing active doping, NaN/infinite/out-of-range input; area/width/mobility scaling; SOI body depletion, recess length, PN/CFET polarity; immutable inputs.
- `node tests/device-iv-browser.cjs`: all 11 actual example selections; current/reference curves, changed input, rejected invalid input, reset, empty wafer, 1440/768/390/320 px dialog layouts; no page runtime errors. Tiny PN-current chart range also covered.
- `QA_URL=http://127.0.0.1:3034/#mosfet node tests/learning-lab-browser.cjs`: existing profile, mission, report export, escaped AI text, mocked 429 recovery, keyboard return and responsive behavior.
- `npm test`: 28 test scripts passed. `npm run build`: passed.
- Desktop CFET/PN and mobile CFET screenshots inspected under `.runtime/iv-*.png`.

Numbers are computed locally in browser JavaScript; this adds no server computation or external API dependency. Production verification is recorded after deployment.
