"""Recompute real implantation/annealing for all device examples; no field recoloring."""
import json, sys, concurrent.futures
from pathlib import Path
from scenarios import run, ROOT
IDS=['mosfet','fdsoi','pdsoi','rcat','bcat','finfet','gaafet','mbcfet','charge-trap','cfet','pn-junction']
OUT=ROOT/'.runtime/doping-variants';OUT.mkdir(parents=True,exist_ok=True)
def check(case):
    id,variant=case
    ref=json.loads((ROOT/'references'/f'{id}.json').read_text(encoding='utf-8'))
    steps=ref['steps']
    for s in steps:
        p=s['params']
        if s['op']=='diffusion' and p['method']=='Ion implantation':
            if variant=='p':p['species']='B'
            elif variant=='half':p['dose']*=.5
            elif variant=='upper-half' and p['species']=='B':p['dose']*=.5
    result=run(dict(target=id,steps=steps))
    assert not result.get('failure'),(id,variant,result.get('failure'))
    (OUT/f'{id}-{variant}.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    row=dict(id=id,variant=variant,seconds=result['elapsed'],frames=len(result['frames']))
    print(json.dumps(row),flush=True)
    return row
cases=[(id,'half') for id in IDS]+[(id,'p') for id in IDS if id not in ('cfet','pn-junction')]+[('cfet','upper-half')]
if len(sys.argv)>1:cases=[c for c in cases if c[0] in sys.argv[1:]]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(check,cases))
(OUT/'summary.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print('PASS: real native doping variants',len(results),flush=True)
