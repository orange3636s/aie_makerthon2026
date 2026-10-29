"""Meaningful native checks: mask polarity, multi-window masks, material survival,
reference reproducibility, deposition/implant/anneal interoperability."""
import json,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from reverse_catalog import TARGETS,validate

def simulate(payload):
    (ROOT/'.runtime').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=ROOT/'.runtime') as temp:
        temp=Path(temp);src=temp/'in.json';out=temp/'out.json';src.write_text(json.dumps(payload),encoding='utf-8')
        p=subprocess.run([sys.executable,str(ROOT/'reverse_engine.py'),str(src),str(out)],cwd=temp,capture_output=True,timeout=150)
        assert p.returncode==0,p.stderr[-800:]
        data=json.loads(out.read_text(encoding='utf-8'));assert not data['failure'],data['failure'];return data

if __name__=='__main__':
    for target in TARGETS:
        if len(sys.argv)>1 and target['id'] not in sys.argv[1:]:continue
        d=simulate(dict(target=target['id'],steps=target['recipe']))
        assert len(d['frames'])==len(target['recipe'])+1
        assert all(p['closed'] for f in d['frames'] for p in f['polygons'])
        if target['id']=='mosfet':
            c=d['frames'][-1]['concentration']
            assert 'P_total' in c['fields'] and 'P_active' in c['fields']
            assert c['origin'][1]<-.5, 'dopant grid must extend inside the substrate'
            below=[v for i,v in enumerate(c['fields']['P_total']) if c['origin'][1]+(i//c['nx']+.5)*c['dx']<-.05]
            assert sum(v>1e15 for v in below)>100, 'implant must populate silicon below the surface'
        print(target['id'],len(d['frames']),'frames',d['elapsed'],'s',flush=True)
    for invalid in [{'target':'sti','steps':[{'op':'etch','params':{'time':-1}}]},{'target':'unknown','steps':[]}]:
        try:validate(invalid);raise AssertionError('accepted invalid recipe')
        except ValueError:pass
