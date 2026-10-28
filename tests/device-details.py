"""Contacts/dopants survive the new flow; omissions must reduce the real score."""
import json,sys,subprocess,shutil
from pathlib import Path
from native_flows import simulate,ROOT
from reverse_catalog import TARGETS

node=shutil.which('node') or 'C:/Program Files/nodejs/node.exe'
out=ROOT/'.runtime/device-details';out.mkdir(parents=True,exist_ok=True)
report=[]
def grade(file):return json.loads(subprocess.check_output([node,str(ROOT/'tests/grade-result.cjs'),str(file)],encoding='utf-8'))
for base in TARGETS:
    if base['id'] not in ('pn-junction','mosfet','fdsoi','pdsoi','rcat','bcat','finfet','gaafet','mbcfet','charge-trap','cfet'):continue
    variants=[('gate',base)] if base.get('assessment') else []
    variants+=list(base.get('sections',{}).items())
    for view,t in variants:
        key=base['id']+('' if view=='gate' else '-'+view)
        reference=ROOT/'references'/(key+'.json');d=json.loads(reference.read_text(encoding='utf-8'))
        f=d['frames'][-1];mats={p['material'] for p in f['polygons']}
        assert mats&{70,72,80},(key,'missing contact metal')
        assert 5 not in mats,(key,'untyped Metal survives')
        c=f['concentration'];values=c['fields']['net_active']
        for sign in [-1,1]:
            assert any(abs(v)>1e15 and sign*(c['origin'][0]+(i%c['nx']+.5)*c['dx'])>.2 for i,v in enumerate(values)),(key,'missing lateral active dopants')
        assert grade(reference)['score']==100,key
        no_contact={**d,'frames':[dict(f,polygons=[p for p in f['polygons'] if p['material'] not in {70,72,80}])]}
        file=out/(key+'-missing-metal.json');file.write_text(json.dumps(no_contact),encoding='utf-8')
        assert grade(file)['score']<100,(key,'missing contacts unpenalized')
        # Native omission cases exercise transport after later dielectric/metal steps.
        if base['id'] in ('mosfet','rcat','charge-trap','finfet','mbcfet','cfet'):
            payload=dict(target=base['id'],view=view,steps=[s for s in t['recipe'] if s['op']!='diffusion'])
            actual=simulate(payload);file=out/(key+'-no-dopants.json');file.write_text(json.dumps(actual),encoding='utf-8');g=grade(file)
            assert g['score']<=55,(key,g)
            report.append(dict(target=key,scenario='native-no-dopants',score=g['score'],elapsed=actual['elapsed']))
        print(key,'contacts + active S/D + grading PASS',flush=True)
(out/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
