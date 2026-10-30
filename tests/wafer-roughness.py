"""Wafer geometry, validation, determinism and downstream native propagation."""
import sys, math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from wafer_model import profile
from reverse_catalog import validate
from reverse_engine import run

for invalid in [-.001,.021,True,'0.01',float('nan'),float('inf')]:
    try:validate(dict(target='mosfet',steps=[],substrateRoughness=invalid))
    except ValueError:pass
    else:raise AssertionError(f'accepted roughness {invalid}')
try:validate(dict(target='fdsoi',steps=[],substrateRoughness=.02))
except ValueError:pass
else:raise AssertionError('roughness can pierce SOI body')
for rq in [0,.005,.02]:
    ys=[y for x,y in profile(1.6,rq)[:-1]]
    mean=sum(ys)/len(ys)
    assert abs(mean)<1e-10
    assert math.isclose(math.sqrt(sum(y*y for y in ys)/len(ys)),rq,abs_tol=1e-10)

flat=run(dict(target='mosfet',steps=[],substrateThickness=.5,substrateRoughness=0))
rough=run(dict(target='mosfet',steps=[],substrateThickness=.5,substrateRoughness=.02))
repeat=run(dict(target='mosfet',steps=[],substrateThickness=.5,substrateRoughness=.02))
assert rough['frames'][0]['polygons']==repeat['frames'][0]['polygons']
assert rough['frames'][0]['polygons']!=flat['frames'][0]['polygons']
assert len(rough['frames'][0]['polygons'])==1,'rough wafer must be a closed solid, not inverted air'
for r in [rough,run(dict(target='fdsoi',steps=[],substrateRoughness=.005)),run(dict(target='locos',steps=[],substrateRoughness=.02))]:
    assert r['failure'] is None,r['failure']
    assert all(p['closed'] for p in r['frames'][0]['polygons'])
    assert max(y for p in r['frames'][0]['polygons'] for x,y in p['points'])>.001
step=dict(op='deposition',params=dict(method='ALD',material='SiO2',cycles=100))
results=[run(dict(target='mosfet',steps=[step],substrateThickness=.5,substrateRoughness=q)) for q in [0,.02]]
for r in results:assert r['failure'] is None,r['failure']
assert results[0]['frames'][-1]['polygons']!=results[1]['frames'][-1]['polygons'],'native deposition must start from rough geometry'
print('Wafer: validation, Rq normalization, repeatability, solid Si/SOI/LOCOS and downstream ALD passed')
