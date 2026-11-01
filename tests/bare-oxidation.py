"""Native integration: bare Si oxidation, no fictitious seed, geometry continuity."""
import copy,json,math,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from scenarios import run
from reverse_catalog import BY_TARGET,step

def oxide(method='Dry oxidation',time=.0324736,temperature=1000):
    return step('diffusion',method=method,oxidation_time=time,temperature=temperature)

def simulate(rows,**kw):
    r=run(dict(target='mosfet',steps=rows,**kw))
    assert not r.get('failure'),r.get('failure')
    assert len(r['frames'])==len(rows)+1
    return r

results={}
for name,row in [('reported',oxide()),('dry',oxide(time=.2)),('long',oxide(time=.4)),
                 ('wet',oxide('Wet oxidation',.2)),('cold',oxide(time=.2,temperature=950)),('hot',oxide(time=.2,temperature=1100))]:
    r=simulate([row]);f=r['frames'][-1];m=f['metrics'];results[name]=m['oxideThicknessNm']
    assert m['initialOxideNm']==0 and m['oxideThicknessNm']>0
    assert math.isclose(m['siliconConsumedNm'],.44*m['oxideGrowthNm'],rel_tol=1e-10)
    si=max(y for p in f['polygons'] if p['material']==10 for x,y in p['points'])
    ox=max(y for p in f['polygons'] if p['material']==30 for x,y in p['points'])
    assert abs(si*1000+m['siliconConsumedNm'])<.001
    assert abs(ox*1000-m['oxideSurfaceRiseNm'])<1.,(name,ox,m)
    if name=='reported':
        assert 0<results[name]<5,'no free 25 nm seed'
        assert abs((ox-si)*1000-results[name])<.001,'sub-grid oxide shell follows actual interfaces'
        (ROOT/'.runtime/bare-oxidation-result.json').write_text(json.dumps(r),encoding='utf8')
assert results['long']>results['dry'] and results['wet']>results['dry'] and results['hot']>results['dry']>results['cold']
twice=simulate([oxide(time=.2),oxide(time=.2)])
assert abs(twice['frames'][-1]['metrics']['oxideThicknessNm']-results['long'])<.001,'continued growth preserves prior thickness'
finite=simulate([oxide()],substrateThickness=.6)
assert min(y for p in finite['frames'][-1]['polygons'] if p['material']==10 for x,y in p['points'])>-.601,'finite substrate retained'
# Oxidation → LPCVD gate → pattern/etch → S/D implant/anneal → contacts.
flow=copy.deepcopy(BY_TARGET['mosfet']['recipe']);flow[0]=oxide(time=.5)
r=simulate(flow)
assert r['frames'][-1].get('concentration'),'oxidation must connect to downstream implantation'
(ROOT/'.runtime/oxidation-mosfet-result.json').write_text(json.dumps(r),encoding='utf8')
# Non-planar starts must never silently flatten user structures.
r=run(dict(target='mosfet',steps=[oxide()],substrateRoughness=.01))
assert r['failure'] and '평탄한' in r['failure']['message']
print('Bare dry/wet oxidation, temperature/time response, zero seed, 44% consumption, repeat growth, finite wafer and full MOSFET continuity passed',results)
