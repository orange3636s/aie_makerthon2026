# Local process workspace

The native solver remains a **2D level-set process calculation**. Three.js renders a finite, opaque extrusion of its material regions. Front/back caps and bottom faces are triangulated; intentional air gaps remain empty. X/Y/Z slices sample that same finite extrusion. Y is the extrusion direction, Z is wafer height. Y slices therefore agree wherever they lie inside the extrusion. This is not a full 3D process solve or a device-specific reconstructed 3D layout.

Live particles illustrate transport only; they do not change saved geometry, scoring, or material mass. CVD particles represent gaseous species, not exclusively ions. Native recalculation still determines the resulting material profile. Existing discrete parameter previews use cached native results.

## Recipe inputs

Existing recipes retain `Effective` inputs. Equipment inputs opt into `recipe_models.py`: bounded teaching response functions feed effective rates into the native solver. Their coefficients are illustrative, not fitted fab recipes. `web/recipe-response.js` duplicates only nominal preflight values and is parity-tested against Python. Unsupported chemistry/material combinations fail visibly instead of inventing material data.

| Operation | Calculation / behavior | Main limit |
|---|---|---|
| HMDS | Saturating adhesion index and illustrative contact angle | No chemical surface-energy solve; lifting is a risk flag |
| Spin coating | Thickness proportional to inverse square root of RPM with a transient time factor | PR-specific calibration is absent |
| Soft bake / PEB / hard bake | Residual-solvent decay, Arrhenius diffusion length, empirical hardness | Does not simulate CAR chemistry or polymer mechanics |
| Exposure / develop | Rayleigh resolution and DOF; bounded dose/focus response; time-dependent removal and tapered opening | Approximate PR response; no aerial-image diffraction solver |
| Wet / dry etch | Material-specific illustrative reference rates; temperature or power/flow scaling; pressure-dependent anisotropy | Does not predict plasma chemistry; only PR has finite erosion in the equipment mode |
| PVD / CVD | Equipment response → rate/sticking/angular source → native SingleParticleProcess | Material/gas coverage deliberately limited |
| ALD | Precursor GPC and pulse saturation → native SingleParticleALD | Purge completeness is a risk indicator; no molecular purge simulation; perfect coverage is not guaranteed |
| Implant | Existing tabulated dual-Pearson depth profile, tilt projected by twist onto the 2D section | Not a 3D channeling or crystal-orientation solver |
| Anneal / oxidation | Existing native transport/oxidation implementation retained | Existing unsupported sequencing constraints remain |
| Cleaning | Chemical-specific first-order removal index; selected oxide-loss budget | Contamination is a normalized teaching state, not measured particle counts |
| CMP | Preston-style removal budget with illustrative coefficients | Existing planar-stop geometry; no added dishing/erosion solver |

Lengths remain µm internally and nm in the UI. Rate inputs follow µm/s internally. Species dose is cm⁻² and concentration cm⁻³. No defect flag is converted into real wafer yield. No new electrical, molecular, or wafer-scale simulation is claimed.

Sources for model form (not validation of our coefficients):

- [ViennaPS models](https://viennatools.github.io/ViennaPS/models/)
- [ViennaPS ion implantation](https://viennatools.github.io/ViennaPS/models/prebuilt/ionImplantation.html)
- [Three.js ExtrudeGeometry](https://threejs.org/docs/#api/en/geometries/ExtrudeGeometry)

This update is local only; no deployment or repository push is part of it.

## Local verification · 2026-10-30

- `npm test`: existing grading, 72 recipe candidates, unit/UI contracts, 520 saved frames, 38 closed solid reference meshes and measurement reentrancy regression passed.
- `.venv/Scripts/python.exe tests/recipe-models.py --native`: new Photo sequence, equipment PVD/CVD/ALD and 7 frontend/backend estimate parity cases passed.
- `.venv/Scripts/python.exe tests/native_flows.py mosfet sti finfet mbcfet locos sadp`: six complete native flows passed.
- `npm run build`: passed.
- Browser at `http://127.0.0.1:3024/#mosfet`: observation and reverse-design mode switching; adding and calculating equipment CVD; X/Z position changes; opaque whole 3D; rotation and zoom; Live toggle; desktop/mobile viewport transitions checked.
- Fixed a reproduced `Maximum call stack size exceeded` on pending recipe edits: leaving a measurement now triggers only one redraw. Added `tests/metrology-transitions.cjs`.
- No production deployment, live Gemini API verification, full 3D physical calculation, or calibrated equipment accuracy is asserted by these tests.
