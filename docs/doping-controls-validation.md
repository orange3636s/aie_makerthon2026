# Independent wafer, gate and S/D controls

Validated 2026-11-01.

- PolySi deposition cards explicitly offer n+ (P) / p+ (B). Changing wafer polarity selects the opposite recommended gate polarity, preserving gate concentration. Subsequent gate edits are independent. An API request omitting the gate setting follows the wafer recommendation too.
- Each implantation card offers dopant species and a concentration gauge. `Cpeak = dose / (sqrt(2*pi)*headSigma)` is a Gaussian-equivalent input, using the native CSV's species/energy-dependent headSigma in cm. It converts to the existing bounded dose parameter; it does not overwrite or recolor native concentration fields. Final active concentration still depends on masking, the dual-Pearson implantation distribution and subsequent diffusion/activation.
- Single FET examples support p-body NMOS and n-body PMOS, with signed voltages/currents and the documented 0.4 hole/electron mobility approximation. Gate work function/depletion, body charge and S/D access resistance remain separate contributions. Intrinsic bodies and inconsistent or compensated S/D access produce guidance, not stale curves. CFET retains its complementary lower/upper bodies.
- Wafer/gate-only edits reuse identical, immutable native geometry and transport results. S/D dose, species, masks, energy or thermal changes still recompute native transport. This does not change the existing model/versioned reference caches.

## Validation

- `npm test`: existing regression suite plus CSV consistency, dose/concentration conversion, independent gate settings, nine single-FET polarity models and body sensitivity.
- `tests/doping-variants-native.py` + `tests/doping-variants-check.cjs`: 21 complete native runs across all 11 device examples. Eleven cases produce changed finite I–V curves; ten intentionally weakened or species-swapped recipes have insufficient near-gate S/D access and correctly produce a diagnosis without a curve. Mask/thermal settings calibrated for P are not automatically assumed valid for B. No native fields were fabricated for these tests.
- `tests/doping-api.cjs`: real MOSFET PMOS calculation, omitted-gate default, independent gate/body/S-D concentration response, native result reuse and reference isolation.
- Actual browser: 24 examples, 520 process frames, 2,080 2D/3D renders; no empty Y/3D frames, WebGL errors or overflowing controls. Manual PMOS workflow, reverse-design save/reload, gate recommendation and S/D dose conversion verified.
- 390px mobile viewport: scientific-notation concentration and dose fields, gauges and polarity selector fit without horizontal overflow.

The baseline render matrix covers every example/stage, not every possible parameter combination. Native full-flow recomputation remains dependent on recipe complexity; analytic wafer/gate adjustments can reuse a matching result.
