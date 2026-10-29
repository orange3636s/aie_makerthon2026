# Recipe Studio — 2026-10-29

## Scope

All 24 library examples expose three comparison recipes: the existing reference,
a reduced time/processing-budget experiment, and a supported thin-film method
alternative or split etch sequence. These are not three universally correct
manufacturing routes. Of 72 entries, 58 meet the existing educational rubric and
14 are explicitly labelled exploratory because a measured target is missed.

Candidate results come from the native process engine, not an LLM or mockup.
48 new alternatives were run in isolated native workers; the 24 previously
computed references are retained. All 48 new runs completed without a solver
failure and produced one frame per step plus the starting substrate. Metadata
includes a reference file hash and final-result hash. The API rejects stale
reference comparisons rather than showing unverified scores.

The UI shows material geometry, dimensional compliance, doping similarity where
available, recorded process time, and educational relative effort. The cost
weights are LearningScore.resources, not measured fab prices. Time excludes
unentered purge, transfer and equipment setup. There is no new dielectric,
electrical-performance, yield or factory-throughput model.

## Learning loop

Choose a candidate → load editable recipe → calculate → evaluate numerical
evidence → select one of five diagnostic priorities and write a reason → see
feedback → change a parameter and repeat. The choice is checked deterministically
against measured evidence. Written reasoning is stored but is not automatically
graded. Existing AI commentary runs only after submission, cannot change the
numerical score, and can fail without blocking the deterministic report.

Only the first finding is expanded by default. Each finding separates observation,
interpretation and the next experiment. Numerical details, cost assumptions and
scope notes are collapsed. Incoming AI updates preserve expanded details and
scroll position.

Recent 30 submissions are stored in this browser's localStorage. No account sync
or new remote learning database is introduced. Browser data removal loses these
notes. Historical comparison is restricted to the same example.

## Reproduce

```text
.venv/Scripts/python.exe scripts/generate-flow-candidates.py
.venv/Scripts/python.exe -u scripts/verify-flow-candidates.py
node scripts/publish-flow-candidates.cjs
npm test
npm run build
node server.cjs
```

The native verification uses two isolated workers and bounded execution time.
Intermediate inputs/results are under ignored `.runtime/flow-candidates/`.
`flow-candidates.json` is the published recipe/metric manifest, without large
frame sequences. Applying an alternative requires recalculation; an exact
reference recipe may reuse its already calculated frames.

## Verification

- 48 alternative native calculations: completed, finite frames, failure=null.
- 72 candidate records: distinct per target, parameter validity, <=96 steps,
  request body <48 KB, reference hashes and measured metrics checked.
- All 24 candidate GET endpoints returned the matching target and 3 entries.
- Unknown/path-like target IDs returned 404; negative recipe time returned 400.
- Existing npm suite passed: grading, doping omissions, saved recipe validation,
  material visibility, 2.5D occlusion, graph measurements, AI response schemas,
  bounded retries, 401/429/503 failure handling and preview/state contracts.
- New tests cover five-choice diagnosis for all 24 targets, missing doping,
  extra effort, dimensional/geometry mismatch, no/short/overlong responses,
  and feedback gating.
- Actual browser MOSFET reference: 100 points. Removing activation anneal and
  rerunning produced identical geometry but active P peak 0 and 72 points.
  Wrong-choice feedback and subsequent AI explanation identified the missing
  activation step after submission. The API did not set the numeric score.
- Actual browser: empty/short answer rejection, successful submission, note
  persistence across tabs, desktop candidate modal, 390px and 768px layouts
  without horizontal page/card overflow.

Full workbench browser regression passed 1,126 checks across all 24 examples,
with no uncaught runtime errors. It uses saved native reference responses to test
all steps' UI state and graphs, 2D/2.5D toggles, candidate application, deletion,
undo, reset, selected-stage retention and network retry. This fixture test is
separate from the 48 actual native calculations.

Production verification passed 28 asset/catalog checks after deployment. A final
browser check found a silent candidate button during initial calculation. It now
allows browsing while busy and shows an explicit wait message on apply; verified
with MBCFET's actual initial calculation. Candidate integrity tests passed again.

## Limits

Scores are educational matching metrics, not device-function certification.
Not every candidate is a distinct manufacturing route; some change conditions
or split one operation. High-k/low-k substitutions are not ranked as electrical
performance improvements. Arbitrary open-ended explanations and all external
AI outages cannot be exhaustively verified. Different native versions or
transport sampling can produce small differences when a candidate is rerun.
