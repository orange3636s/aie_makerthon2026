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

## Unified recipe controls (2026-10-30)

The workspace exposes one recipe editor. Serialized `input_mode` is retained only
for backwards compatibility with saved equipment recipes. Existing reference
recipes use their explicit R0/GPC and transport parameters as the nominal point.
The editor hides the old mode selector. Reference rates remain editable under
advanced settings; pressure/power/flow/temperature multiply that reference rate.
No real-tool calibration is implied.

PVD: R/R0 = (P/500 W) * 1.25/(1+p/20 mTorr) * 2F/(F+50 sccm).
CVD: R/R0 = Arrhenius(T, 400 C, 0.3 eV) * (F/100)^0.4 * 2p/(p+1),
with p in Torr; PECVD additionally uses (P/500 W)^0.3.
Dry etch: R/R0 = (P/300)^0.5 * (F/50)^0.3; lateral fraction scales
with (pressure/30)^0.5 * (300/P)^0.3, bounded to [0,1].
Wet etch: reference rate times Arrhenius(T,25 C,0.25 eV).
CMP: reference rate times pressure/3 psi and platen speed/60 RPM.
Defaults are identity factors to preserve existing example targets.
These transfer functions are teaching assumptions, not universal equipment laws.
Existing equipment recipes retain the prior chemistry-specific coefficients.

Photo choices: KrF 248 nm, ArF 193 nm, EUV 13.5 nm. Default NA values are
0.60/0.85/0.33. Supported upper NA is 0.93/1.35/0.55. Patterning is an ideal
mask operation; Exposure activates the simplified optical model. Resolution
check is R=0.6*lambda/NA against the exposure pattern width, not the final
multi-patterned CD. Node names are not physical feature widths. Exposure effort
weights 2/3/6 are educational units, never actual price ratios.
Source: https://www.asml.com/en/technology/lithography-principles/light-and-lasers

3D and minimap show finite extrusion of the calculated 2D geometry. X/Z cuts
resample concentration assuming uniform extrusion in Y. They are not a 3D
transport solver. Implant frames display total net concentration; after active
concentration exists, display active net concentration. Both are clipped to
silicon-containing materials. Live particle motion is conceptual; mask openings
and blocking are shared with the preview, while native transport computes the
actual geometry/concentration.

Typography: SUIT Variable, locally hosted; SIL OFL at web/fonts/SUIT-LICENSE.txt.
