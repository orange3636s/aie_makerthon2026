"""Compatibility audit of an optional local checkout; no production import."""
import json,sys,inspect
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parent/'cmp-sim-review'
sys.path[:0]=[str(REPO),str(ROOT/'.runtime/cmp-review-deps')]
import yaml
from cmp_sim.models import pattern_density as pd
from cmp_sim.cli import recipe_from_dict
from cmp_sim.core.solver import simulate,FILM_PACK

rows=[]
for file in ['oxide_baseline.yaml','cu_damascene.yaml','tungsten_plug.yaml']:
    cfg=yaml.safe_load((REPO/'examples'/file).read_text());cfg['wafer']['pattern_density']=.5
    result=simulate(recipe_from_dict(cfg)).summary()
    rows.append(dict(example=file,rateNmPerMin=result['removal_rate_nm_per_min'],pattern=result.get('pattern_effects'),extrasKeys=list(result.keys()),warnings=[x for x in result['warnings'] if any(s in x.lower() for s in ('dishing','erosion','pattern','calibrat','scale'))]))
packs={}
for name in ['oxide_silica','sti_ceria','cu_h2o2_bta','w_fe_oxidizer','poly_si_alkaline']:
    data=yaml.safe_load((REPO/'cmp_sim/data/params'/f'{name}.yaml').read_text(encoding='utf-8'));params=data.get('params',{})
    packs[name]={k:(params.get(k) or {}).get('value') for k in ['dishing_max_m','oxide_dishing_sensitivity_b','stop_layer_rate_m_per_s']}
x=np.linspace(0,.02,51);rho=np.full_like(x,.5)
steady=[]
for t in [0,10,100]:
    result=pd.evaluate(blanket_rate_m_per_s=5e-9,rho_local=rho,x_m=x,planarization_length_m=.001,initial_step_m=200e-9,time_s=t,rate_stop_m_per_s=.1e-9,dishing_max_m=100e-9,oxide_sensitivity_b=1e6)
    steady.append(dict(time=t,dishingNm=result.dishing_m*1e9,erosionNm=result.erosion_m))
assert len({round(v['dishingNm'],6) for v in steady})==1
assert all(v['erosionNm'] is None for v in steady)
report=dict(repository='https://github.com/khleecnce/cmp-sim',commit='7221148e76a8f988f59157f45f72e869fd85d268',upstreamSelectedTests=38,examples=rows,packs=packs,syntheticSteadyState=steady,supportedFilms=list(FILM_PACK),decision='Do not integrate as the sequential 2D C&C engine: scalar layout input, steady-state dishing, missing calibration constants; preserve timed native Planarize. No upstream source copied into production.')
(ROOT/'.runtime/cmp-sim-review.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(report,indent=2,ensure_ascii=False))
