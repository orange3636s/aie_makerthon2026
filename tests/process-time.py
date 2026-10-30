"""Example retiming invariance and native shape checks. Run with native venv."""
import json, sys, subprocess, tempfile, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from process_timing import retime, anchor
from reverse_catalog import validate

catalog=json.loads((ROOT/'reverse-catalog.json').read_text(encoding='utf-8'))
old=json.loads((ROOT/'.runtime/timing-before.json').read_text(encoding='utf-8'))
count=0
for target in catalog['targets']:
    rows=old[target['id']];updated=retime(rows)
    assert retime(updated)==updated
    validate(dict(target=target['id'],steps=updated))
    for a,b in zip(rows,updated):
        if a==b:continue
        p,q=a['params'],b['params'];count+=1
        assert math.isclose(p['rate']*p['time'],q['rate']*q['time'],rel_tol=1e-12)
        assert {k:v for k,v in p.items() if k not in ('rate','time')}=={k:v for k,v in q.items() if k not in ('rate','time')}
equipment=[dict(op='deposition',params=dict(input_mode='Equipment',method='PVD',material='W',rate=.08,time=5))]
assert retime(equipment)==equipment
print(f'PASS 24 example recipes; {count} rate/time pairs; unchanged transport; idempotence; Equipment untouched',flush=True)

def native(rows,out):
    inp=out.with_suffix('.input.json');inp.write_text(json.dumps(dict(target='mosfet',steps=rows)),encoding='utf-8')
    r=subprocess.run([sys.executable,str(ROOT/'reverse_engine.py'),str(inp),str(out)],cwd=ROOT,capture_output=True,timeout=150)
    assert r.returncode==0,r.stderr[-400:]
    d=json.loads(out.read_text(encoding='utf-8'));assert not d['failure'],d['failure'];return d

# Same rough, particle-transport deposition in a trench, and mask-controlled etch.
cases={
 'PVD_trench':[{'op':'photo','params':{'action':'Pattern','width':.4,'tone':'Positive'}},{'op':'etch','params':{'material':'Si','method':'Directional','rate':.1,'time':3,'isotropic':.1}},{'op':'photo','params':{'action':'Strip'}},{'op':'deposition','params':{'method':'PVD','material':'SiO2','rate':.08,'time':1,'sticking':1,'exponent':20}}],
 'CVD_trench':[{'op':'photo','params':{'action':'Pattern','width':.4,'tone':'Positive'}},{'op':'etch','params':{'material':'Si','method':'Directional','rate':.1,'time':3,'isotropic':.1}},{'op':'photo','params':{'action':'Strip'}},{'op':'deposition','params':{'method':'CVD','material':'SiO2','rate':.08,'time':1,'sticking':.15,'exponent':1}}],
 'RIE_oxide':[{'op':'deposition','params':{'method':'CVD','material':'SiO2','rate':.08,'time':2}},{'op':'photo','params':{'action':'Pattern','width':.4,'tone':'Positive'}},{'op':'etch','params':{'material':'SiO2','method':'Directional','rate':.1,'time':1,'isotropic':.1}}],
}
with tempfile.TemporaryDirectory(dir=ROOT/'.runtime') as tmp:
    for name,rows in cases.items():
        before=native(rows,Path(tmp)/'before.json');after=native(retime(rows),Path(tmp)/'after.json')
        # Exact polygon serialization is stricter than an IoU threshold.
        assert before['frames'][-1]['polygons']==after['frames'][-1]['polygons'],name+' shape changed'
        assert before['frames'][-1].get('metrics')==after['frames'][-1].get('metrics'),name+' metrics changed'
        print('PASS native identical profile:',name,flush=True)
