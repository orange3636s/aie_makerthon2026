"""Independent analytic / conservation checks for the local FiPy adapter."""
import math, sys, unittest
from pathlib import Path
import numpy as np
from scipy.special import erfc
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from diffusion_solver import evolve, silicon_mesh


def slab(nx=12, ny=100, dx=.01):
    positions = [[(x+.5)*dx, (y+.5)*dx, 0.] for y in range(ny+2) for x in range(nx)]
    materials = [10 if y < ny else 2 for y in range(ny+2) for x in range(nx)]
    return positions, materials


COEFF = {'P': dict(diffusivity=1e-5, solubility=1e8),
         'B': dict(diffusivity=2e-5, solubility=8e7)}


class DiffusionPhysics(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pos, cls.mat = slab()
        cls.fields, cls.info = evolve(cls.pos, cls.mat, {}, .01, COEFF, 600, 'P', 1e8)

    def test_constant_source_matches_erfc_and_dose(self):
        # Semi-infinite slab: C(z,t)=Cs erfc(z/2sqrt(Dt)), Q=2Cs sqrt(Dt/pi).
        profile = np.asarray(self.fields['P_total']).reshape(-1, 12)[:100].mean(axis=1)
        depth = 1. - (np.arange(100)+.5)*.01
        exact = 1e8*erfc(depth/(2*math.sqrt(1e-5*600)))
        self.assertLess(np.max(np.abs(profile-exact))/1e8, .008)
        dose = profile.sum()*.01
        exact_dose = 2e8*math.sqrt(1e-5*600/math.pi)
        self.assertLess(abs(dose/exact_dose-1), .008)
        self.assertEqual(self.info[0]['sourceFaces'], 12)

    def test_drive_in_conserves_both_species_and_broadens(self):
        fields = {**self.fields, 'B_total': (np.asarray(self.fields['P_total'])*.5).tolist()}
        result, info = evolve(self.pos, self.mat, fields, .01, COEFF, 600)
        depth = 1.-np.asarray(self.pos)[:, 1]
        for symbol in ['P', 'B']:
            before, after = np.asarray(fields[symbol+'_total']), np.asarray(result[symbol+'_total'])
            self.assertLess(abs(after.sum()/before.sum()-1), 1e-9)
            self.assertLess(after.max(), before.max())
            self.assertGreater(np.sum(after*depth**2)/after.sum(), np.sum(before*depth**2)/before.sum())
        self.assertTrue(all(row['sourceFaces']==0 for row in info))

    def test_repeated_steps_consistent(self):
        half, _ = evolve(self.pos, self.mat, {}, .01, COEFF, 300, 'P', 1e8)
        twice, _ = evolve(self.pos, self.mat, half, .01, COEFF, 300, 'P', 1e8)
        self.assertLess(np.max(np.abs(np.asarray(twice['P_total'])-self.fields['P_total']))/1e8, .004)

    def test_species_diffusivity_and_solubility_are_effective(self):
        result, info = evolve(self.pos, self.mat, {}, .01, COEFF, 600, 'B', 1e10)
        self.assertEqual(info[0]['effectiveSurfaceCm3'], 8e19)
        self.assertLessEqual(max(result['B_total']), 8e7)
        # B spreads farther with the deliberately different test coefficients.
        depth = 1.-np.asarray(self.pos)[:, 1]
        b, p = np.asarray(result['B_total']), np.asarray(self.fields['P_total'])
        self.assertGreater(np.sum(b*depth)/b.sum(), np.sum(p*depth)/p.sum())

    def test_mask_window_and_lateral_diffusion(self):
        nx, ny = 30, 40
        pos, mat = slab(nx, ny)
        # Bottom row of air becomes oxide except for a 10-cell window.
        for x in range(nx):
            if not 10 <= x < 20: mat[ny*nx+x] = 3
        result, info = evolve(pos, mat, {}, .01, COEFF, 300, 'P', 1e8)
        c = np.asarray(result['P_total']).reshape(-1, nx)
        self.assertEqual(info[0]['sourceFaces'], 10)
        self.assertGreater(c[ny-1, 9], 1e5)  # Diffusion laterally below the mask.
        self.assertLess(c[ny-1, 9], c[ny-1, 15])
        self.assertTrue(all(v==0 for v,m in zip(result['P_total'],mat) if m!=10))

    def test_barrier_and_sealed_void(self):
        pos, mat = slab(12, 40)
        # Entire horizontal oxide layer separates Si regions.
        for x in range(12): mat[20*12+x] = 3
        # Air pocket in bottom Si is disconnected from the ambient.
        mat[10*12+6] = 2
        result, info = evolve(pos, mat, {}, .01, COEFF, 600, 'P', 1e8)
        self.assertEqual(info[0]['sourceFaces'], 12)
        self.assertEqual(max(result['P_total'][:20*12]), 0)
        self.assertGreater(max(result['P_total'][21*12:]), 0)

    def test_missing_source_and_missing_inventory_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Drive-in'):
            evolve(self.pos, self.mat, {}, .01, COEFF, 600)
        mat = [3 if m==2 else m for m in self.mat]
        with self.assertRaisesRegex(ValueError, 'Si 표면'):
            evolve(self.pos, mat, {}, .01, COEFF, 600, 'P', 1e8)
        with self.assertRaisesRegex(ValueError, 'Si 영역'):
            silicon_mesh(self.pos, [2]*len(self.pos), .01)


if __name__ == '__main__': unittest.main(verbosity=2)
