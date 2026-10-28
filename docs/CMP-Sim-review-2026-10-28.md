# CMP-Sim integration review

Decision: **do not use CMP-Sim as ProcessTrace's sequential cross-section engine yet**. The checkout was tested separately; no CMP-Sim code or calibration constants were incorporated into the service.

- Repository: https://github.com/khleecnce/cmp-sim
- Tested commit: `7221148e76a8f988f59157f45f72e869fd85d268`
- Source licence: MIT (the cited papers are not relicensed).
- Upstream tests executed: `test_pattern_density.py`, `test_pattern_units.py`, `test_preston.py`: **38 passed**.
- Independent reproducible audit: `tests/cmp-sim-review.py`; detailed output: `.runtime/cmp-sim-review.json`.

## Observations

| Scenario | Result | Integration implication |
|---|---|---|
| Oxide example + pattern density 0.5 | Removal rate computed; dishing constants missing | No default oxide dishing prediction |
| Cu damascene example | Removal rate computed; oxide sensitivity coefficient missing | No default Cu dishing prediction |
| W plug example + pattern density 0.5 | Pattern effects skipped: planarization length missing | Not a plug-shape simulator as configured |
| Synthetic fully specified pattern model; time 0, 10, 100 s | Same steady-state dishing: 95.6175 nm | This is an asymptotic diagnostic, not time-resolved dishing; drawing it as current geometry would be wrong |
| Same synthetic cases without explicit overpolish time | Erosion omitted | The caller must supply/calibrate overpolish; recipe time alone is insufficient |

The wrapper uses one scalar pattern density and an assumed die-scale layout. It does not consume ProcessTrace's arbitrary multilayer polygons. Several ProcessTrace materials have no pack (HZO, Al₂O₃, HfO₂, Co, Mo, TiN). Passing arithmetic tests does not validate absolute rates on our process.

Integration would need measured film/stop-layer rates, pad planarization length, a transient dishing model, actual layout extraction and geometry coupling. No invented coefficients were used to fill those gaps.

## C&C shipped locally

Native `Planarize` with `y_cut = max(y_stop, y_top − rate × time)`, where `y_stop` is the surface top before the last deposition. Rate and time affect geometry. This endpoint cap prevents polishing below the stored stop plane. It is an ideal geometric removal model, not a Preston/pad/selectivity/dishing model. Slurry is metadata and does not change geometry or similarity scoring.

## Slurry list evidence

These are abrasive families or documented application examples, not interchangeable complete formulations or calibrated ProcessTrace rates.

| Film | Listed candidate | Evidence |
|---|---|---|
| SiO₂ | Ceria; colloidal silica | [AGC](https://www.agc.com/en/products/electoric/detail/cmp.html), [EPFL facility](https://www.epfl.ch/research/facilities/cmi/equipment/etching/alpsitec-e460-f-new-cmp/) |
| Si, Poly Si, Si₃N₄ | Colloidal silica | [EPFL](https://www.epfl.ch/research/facilities/cmi/equipment/etching/alpsitec-e460-f-new-cmp/), [Fujimi product families](https://www.fujimiinc.co.jp/english/service/cmp/lineup.html) |
| SiGe | Silica-based research formulation | [Research article](https://www.sciencedirect.com/science/article/abs/pii/S136980011831607X) |
| W | Silica-based formulation | [Entegris technical poster](https://www.entegris.com/content/dam/web/resources/poster/poster-post-cmp-cleaners-for-tungsten-ucpss-2016.pdf) |
| Co | Dedicated formulation; abrasive undisclosed | [Fujifilm](https://www.fujifilm.com/us/en/business/semiconductor-materials/cmp) |
| Mo | Silica-based research formulation | [Original research](https://pmc.ncbi.nlm.nih.gov/articles/PMC11477894/) |
| TiN | Silica-based patent example | [US20030162399A1, Example II](https://patents.google.com/patent/US20030162399A1/en) |
| HfO₂ | Colloidal silica patent example | [US20210301173A1](https://patentimages.storage.googleapis.com/85/80/fb/c5f48d7ec6e0e1/US20210301173A1.pdf) |
| Al₂O₃, HZO | Formulation unverified | Explicitly labelled unverified, no abrasive assigned |
