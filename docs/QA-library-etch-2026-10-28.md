# Structure library and etch choices — local only

- Sidebar, tutorial navigation and target chooser now use 구조 / 소자. All 32 example IDs remain stable (21 structures, 11 devices). Structure titles identify Hole, HAR, Spacer, trench fill, patterns and doped regions.
- New recipe choices: Wet Etch / Dry Etch / ALE. Legacy operations remain readable for existing example flows. The pre-existing HAR Cryogenic observation example remains; no Cryogenic recipe option was added.
- Wet Etch uses native isotropic boundary motion. At rate 150 nm/s for 1 s and a 300 nm mask opening, Si 80 nm underneath the mask edge and 40 nm below the surface is removed. The same point remains with fully directional Dry Etch. Native regression passes.
- ALE uses EPC × cycles as the integrated directional removal budget, with other materials protecting the surface. 100 × 0.2 nm and 200 × 0.2 nm produce different geometry; 200 × 0.2 nm equals 100 × 0.4 nm. Native regression passes.
- ALE is an effective model. No precursor, purge, reaction kinetics or material-specific EPC prediction. The 10 nm grid does not resolve individual atomic layers.
- npm test and build passed; recipe UI tests cover categories, ALE fields/preview, and absence of a Cryogenic recipe option. No deployment or GitHub push.
