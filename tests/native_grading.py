"""Adversarial native regression: same geometry is not a completed doped device.

Run with the configured Python/native runtime; --update-references regenerates
only the seven doped references from their unchanged canonical recipes.
"""
import copy,json,os,shutil,subprocess,sys
from pathlib import Path
from native_flows import simulate,ROOT
from reverse_catalog import TARGETS,photo,etch,strip,step,validate

out=ROOT/'.runtime/grading-v2';out.mkdir(parents=True,exist_ok=True)
node=shutil.which('node') or 'C:/Program Files/nodejs/node.exe'
reports=[]
def run(name,payload):
    result=simulate(payload);file=out/(name+'.json')
    file.write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
    return result,file
def grade(file):
    return json.loads(subprocess.check_output([node,str(ROOT/'tests/grade-result.cjs'),str(file)],text=True,encoding='utf-8'))
def record(name,g,result):
    reports.append(dict(name=name,score=g['score'],components=g['components'],issues=g['issues'],elapsed=result['elapsed']))
    (out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
    print(name,g['score'],g['components'],flush=True)

for t in TARGETS:
    if not t.get('assessment'):continue
    name=t['id'];payload=dict(target=name,steps=t['recipe'])
    baseline,file=run(name+'-complete',payload)
    if '--update-references' in sys.argv:
        (ROOT/'references'/(name+'.json')).write_text(json.dumps(baseline,ensure_ascii=False),encoding='utf-8')
    g=grade(file);assert g['score']==100,(name,g);record(name+'-complete',g,baseline)
    for variant in ('without-doping','without-anneal'):
        payload=copy.deepcopy(payload)
        payload['steps']=[s for s in t['recipe'] if not (s['op']=='diffusion' and s['params']['method'] in (['Ion implantation','Anneal'] if variant=='without-doping' else ['Anneal']))]
        actual,file=run(name+'-'+variant,payload);g=grade(file)
        assert g['components']['geometry']>.999,(name,variant,'geometry changed')
        assert g['score']<=75,(name,variant,g)
        assert g['components']['active']==0 and g['components']['process']<1
        record(name+'-'+variant,g,actual)
    if name in ('mosfet','rcat','charge-trap','pn-junction'):
        payload=copy.deepcopy(dict(target=name,steps=t['recipe']))
        for s in payload['steps']:
            if s['op']=='diffusion' and s['params']['method']=='Ion implantation':s['params']['dose']*=.01
        actual,file=run(name+'-low-dose',payload);g=grade(file)
        assert g['score']<95,(name,g);record(name+'-low-dose',g,actual)

# An actual trench distinguishes the presets. The common solver must remain
# deterministic when both methods intentionally use identical numeric inputs.
base=[photo(.4,'Positive'),etch('Si',.3),strip()]
outputs={}
for mode in ('default','matched'):
    for method in ('PVD','CVD'):
        params=dict(method=method,material='SiO2',rate=.08,time=1.)
        if mode=='matched':params.update(sticking=.2,exponent=1.)
        payload=dict(target='sti',steps=base+[step('deposition',**params)])
        actual,_=run(method+'-'+mode,payload);outputs[method,mode]=actual['frames'][-1]['polygons']
assert outputs['PVD','default']!=outputs['CVD','default'],'presets must differ on a trench'
assert outputs['PVD','matched']==outputs['CVD','matched'],'do not fabricate a method-specific physics effect'
print('PVD/CVD presets differ; matched numeric inputs correctly agree',flush=True)
