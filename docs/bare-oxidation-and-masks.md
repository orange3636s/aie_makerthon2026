# Direct oxidation and implantation display corrections

Bare-wafer oxidation was blocked in the application before the solver ran. The installed ViennaPS 4.6.2 coupled oxidation path also produced an empty oxide shell from zero thickness. The newer public solver documents improved startup, but upgrading the entire ray tracer would introduce unrelated platform changes.

`planar_oxidation.py` uses the installed ViennaPS Deal–Grove rate table for a **flat, unmasked Si/SiO2 stack**, with the actual starting oxide thickness, including zero. Native level-set interfaces move by 44% inward (Si consumption) and 56% outward. Repeated steps accumulate physical growth; no free seed is inserted. For sub-grid planar films, export uses the two native interfaces directly instead of meshing a Boolean shell, which distorts very thin films. Finite substrate bottoms and the dopant solver's lower guard are retained. The resulting ordinary material stack supports subsequent deposition, etching and implantation.

Limitations: Deal–Grove is an educational approximation for very thin oxides; it does not reproduce Massoud early-growth enhancement. Non-planar/masked oxidation retains the existing seeded coupled solver. Oxidation after implantation still rejects unsupported dopant redistribution; SOI/multimaterial oxidation is not added.

- [TU Wien: oxidation and 0.44 silicon consumption](https://iue.tuwien.ac.at/diss/radi/node21.html)
- [ViennaPS 4.7 oxidation model documentation](https://github.com/ViennaTools/ViennaPS/blob/v4.7.0/include/viennaps/models/psOxidation.hpp)

The reported dry case, 1000 °C for 0.0324736 h, gives 1.4494 nm oxide and 0.6377 nm consumed Si. Tests also cover dry/wet ordering, temperature/time response, repeated growth, a finite wafer and a complete thermal-oxide → LPCVD → S/D implant/anneal MOSFET flow.

S/D mask controls now identify actual gate/PR shielding and explicit aperture masks. A gate-protection preset derives two openings from the current Poly-Si gate projection with a 20 nm margin, using the already-supported native Double mask. Grey mask geometry matches the native temporary mask height (surface +50 to +150 nm). Static arrows and live particles share the same vertical impact calculation: stop on the mask or non-Si surface; enter only exposed Si. Gate color still represents separately configured deposition doping, not an S/D implant into the gate. Ion stopping is the existing ideal non-Si barrier model, not energy-dependent penetration through a real resist.

The finite mask is also sliced in X and Z; a Z plane outside the mask height must not show a projected mask as though it were present at that height. The 3D minimap retains the same mask. Native tests confirm exposed S/D receives dose while the masked outer Si and channel remain unimplanted. Browser regression: 24 examples, 520 stages, 2080 renders pass; mesh/slice checks: 3990 meshes and 4680 slices pass. X/Z mask slices and actual mask selection/calculation were additionally checked in the UI. Custom full-flow recalculation can still exceed 15 seconds; cached examples remain available immediately.
