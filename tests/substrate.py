"""Native finite-substrate bounds and input validation regression."""
import sys, math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from reverse_catalog import validate
from reverse_engine import run

for invalid in [0,-1,.099,1.201,True,'0.3',float('nan'),float('inf')]:
    try: validate(dict(target='mosfet',steps=[],substrateThickness=invalid))
    except ValueError: pass
    else: raise AssertionError(f'accepted invalid thickness: {invalid}')
for target in ['mosfet','fdsoi','locos']:
    for depth in [.3,.6,1.2]:
        r=run(dict(target=target,steps=[],substrateThickness=depth))
        assert r['failure'] is None,r['failure']
        points=[v for p in r['frames'][0]['polygons'] for v in p['points']]
        assert math.isclose(min(y for x,y in points),-depth,abs_tol=.011),(target,depth)
        assert math.isclose(max(y for x,y in points),0,abs_tol=.011)
        assert r['substrateThickness']==depth
print('Substrate: 8 invalid inputs and 9 native Si/SOI/LOCOS bounds passed')
