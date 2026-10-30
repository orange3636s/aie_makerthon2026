# Tutorial and rendering review · 2026-10-30

## Change

Replaced the dense tutorial introduction with a five-step Trench walkthrough, annotated UI illustrations, viewer controls, expandable process models, and a separate design/evaluation guide. The guide distinguishes conceptual Live animation, calculated results, and extruded 3D geometry. Existing simulation models and cached results are unchanged.

## Executed locally

- `node tests/studio-render-browser.cjs`: all 24 examples; 2D/3D geometry identity, X/Y/Z slices, layer/material separation and viewport fit, rotation, zoom, mobile widths. Passed without WebGL fallback or page exceptions.
- `node tests/tutorial-walkthrough-browser.cjs`: five lessons and seven process guides at 1440, 1024, 768, 390 and 320 px; previous/next limits, keyboard interaction, catalog failure recovery. Passed.
- `node tests/tutorial-demo-browser.cjs`: three cached MOSFET candidate flows, guide interactions, keyboard and responsive layout. Passed. Local candidate loading took 1.24–1.90 seconds in this run.
- `npm test`: all 27 configured suites passed.
- `npm run build`: passed.

Screenshots were inspected for desktop/mobile tutorial layout, process detail, MOSFET 2D, MBCFET 3D and mobile 3D. Screenshots and command logs are retained in the ignored `.runtime` directory.

## Scope

This is a UI/rendering regression review, not physical validation of every semiconductor structure. Automated rendering tests verify geometry consistency and viewport containment, not agreement with measured devices. The existing 3D view extrudes the calculated 2D cross-section; it is not an independent 3D process solver. Browser tests ran in Chrome; other browser engines and physical mobile GPUs were not tested.
