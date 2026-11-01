# Poly-Si LPCVD example correction

Conventional polysilicon gates use thermal LPCVD; sputtered PVD is not the appropriate default for these teaching flows. PVD remains available for other materials and user experiments.

Sources checked 2026-11-01:
- [NIST polysilicon LPCVD furnace](https://www.nist.gov/laboratories/tools-instruments/nanofab-tool-sandvik-lpcvd-amorphous-and-polycrystalline-silicon): undoped and phosphine-doped polysilicon.
- [Stanford silicon process guide](https://nanoguide.stanford.edu/guide/materials/silicon): LPCVD polysilicon.
- [Utah Nanofab undoped polysilicon recipe](https://process.nanofab.utah.edu/design_your_process/show_parameters.php?process_id=314): 630 °C, 200 mTorr, SiH4 60 sccm, 11.02 nm/min. The reported rate is a single-run measurement, not a universal process constant.

Updated MOSFET, FD-SOI, PD-SOI, RCAT and charge-trap gate films, plus the SADP sacrificial Poly-Si mandrel. The shared recipe builder also covers observation mode and regenerated candidate flows. Gate polarity/concentration remain independent editable controls; a SADP mandrel is not treated as a gate.

The nominal 150 nm blanket film now takes about 817 s (13.6 min) of deposition. Loading, heating and cooling are excluded from the existing process-time total. Numerical wall time is independent of this physical duration.

The LPCVD teaching response uses the published nominal rate multiplied by an Arrhenius factor (630 °C reference, illustrative 1 eV activation energy), flow ratio to the power 0.4 and a saturating pressure factor. Those off-nominal sensitivities are educational assumptions, not fitted equipment data. Thermal LPCVD ignores RF power. The native particle-transport solver uses sticking probability 0.05 and cosine exponent 1; it computes the resulting geometry rather than retaining old PVD meshes. No grain structure, dopant-dependent deposition kinetics or automatic thermal diffusion during deposition is claimed. The uniform gate doping control does not simulate an in-situ dopant gas recipe.

Validation: Python/browser response parity, unsupported chemistry rejection, all six reference flows and their two alternatives, stage-by-stage closed geometry and 2D/3D rendering, and the existing gate doping/I–V regressions. Cached numerical results must be regenerated after the model changes; no old result is relabeled as LPCVD.
