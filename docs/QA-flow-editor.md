# ProcessTrace — layer flows and unified devices

## Implemented scope

- Simulation now has basic-condition and operation-condition tabs. A sequential flow card selects the corresponding operation, including photo preview frames. Recalculation keeps the selected operation and vertical scroll position.
- LELE: 9 operations, including target film, hardmask, first photo/etch/strip, interleaved second photo/etch/strip and hardmask removal. SADP: 10 operations, including mandrel photo/etch, spacer deposition/etchback, mandrel removal and pattern transfer.
- Central, Double, Triple and Repeat masks share the same implementation in observation and reverse design. Offset, pitch, linewidth and positive/negative PR remain editable.
- Bosch shows the initial etch and every passivation/opening/etch cycle. Default: 5 cycles, 17 frames. Each phase's coating, opening depth or etch time can be changed independently; earlier frames remain identical.
- FINFET/GAAFET/MBCFET/CFET use a single channel-length teaching section containing supported Si, gate, S/D concentration and contacts. Default recipes: 25/25/33/52 operations. MBCFET distributes total implant dose across 30/100/200 keV before activation.
- CFET includes separate lower n and upper p tiers, inter-tier dielectric and six contacts. The release frames retain connected Si anchors instead of presenting unsupported islands.
- BCAT uses a wider implant mask and 950°C/5 s activation. Its default high-dose regions (>10^17 cm^-3) do not connect across the channel; center concentration is below 10^15 cm^-3. This is a concentration/topology check, not an electrical short-circuit test.
- 2.5D uses nearest-surface extrusion rather than material-ID painter ordering. It is still an extruded 2D section, not a full 3D solve.
- Image analysis offers up to three related learning examples across categories. Reasons are omitted. A short, explicitly tentative image identification remains.

## Validation

- `npm test`: grading, recipe validation, display, extrusion, AI response contracts, UI conventions, design guides and unified-device regressions passed.
- Fresh native calculations for all 11 devices: implant/anneal evidence and both S/D regions verified. Contact checks include both CFET tiers; only cavities open to the contact mouth count, excluding pre-existing enclosed gate pockets. Each measured contact exceeds 97.5% metal fill.
- Updated MBCFET: active S/D peak exceeds 10^16 cm^-3 on both sides at each of the three sheet heights. Supported release-section connectivity and CFET tier dopant separation passed.
- `tests/process-targets.py`: nine native process targets replayed to 100 against their generated references, plus polarity/mask and parameter-bound checks. Triple positive/negative masks were checked separately after adding the basic-condition option.
- `tests/flow-update-scenarios.py`: six combined device-bound scenarios, three independent Bosch phase changes, four masks and photo-preview operation mapping passed. CFET's tested thin/thick combinations completed in about 63–64 seconds on the local CPU with two tests running concurrently; this is not a production latency guarantee.
- HTTP integration: 35 scenarios passed, including malformed input, stage ranges, 65-operation rejection, origin checks, caching and solver recovery.
- Browser harness: 89 scenarios passed at 1396px, and the same 89 scenarios passed in isolated 390px and 768px same-origin iframe viewports. Tests cover selected-step preservation, scrolling, operation editing/deletion/undo, 64-operation limit, three recommendation cards, modal layout and errors. Actual native LELE mask-offset editing and individual Bosch coating edits were also exercised through the UI.
- Live Gemini: MBCFET image returned MBCFET plus related deposition/etch examples. SADP image returned SADP, RIE and ALD with no recommendation reasons. Missing MBCFET implants and anneal returned grounded step IDs and restoration suggestions. AI wording can still vary and is not a calibrated physical diagnosis.

## Explicit limits

- Conformal growth uses native spherical offset with assumed out-of-plane supply. Pattern transfer uses native Boolean projection of the PR pattern. Neither is a calibrated plasma/precursor model. Tutorial documents both separately from transport calculations.
- Source/drain Si fill and the prepared upper CFET Si layer are geometry approximations; crystal growth, strain, fabrication feasibility and I–V are not solved.
- Wet/SF6/O2/cryo/stack/redeposition observation models retain their model-wide controls; their saved time snapshots are not independently composable reverse-design operations. Sequential recipes and Bosch phases have independent stage editing.
- Changing basic conditions regenerates the preset flow. Stage edits are retained in the current simulation result and can be exported with it; reverse-design drafts use their own versioned browser storage.
