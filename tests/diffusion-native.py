"""Local integration: FiPy, native implants/anneal, masks, errors and regridding."""
import json, subprocess, sys, tempfile, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from reverse_catalog import BY_TARGET,step,photo,strip,dep

def simulate(rows):
    with tempfile.TemporaryDirectory(dir=ROOT/'.runtime') as folder:
        folder=Path(folder);src=folder/'input.json';out=folder/'output.json'
        src.write_text(json.dumps(dict(target='pre-deposition',steps=rows)),encoding='utf-8')
        p=subprocess.run([sys.executable,str(ROOT/'reverse_engine.py'),str(src),str(out)],cwd=folder,capture_output=True,timeout=120)
        assert p.returncode==0,p.stderr[-500:]
        return json.loads(out.read_text(encoding='utf-8'))

def check(name, rows, error=None):
    start=time.perf_counter();d=simulate(rows)
    if error:
        assert d['failure'] and error in d['failure']['message'],d['failure']
        assert 'Traceback' not in d['failure']['message'] and 'ValueError' not in d['failure']['message']
    else:
        assert d['failure'] is None,d['failure']
        c=d['frames'][-1]['concentration'];assert any(c['fields']['net_active'])
        assert all(p['closed'] for f in d['frames'] for p in f['polygons'])
    report.append(dict(name=name,seconds=round(time.perf_counter()-start,2),frames=len(d['frames']),expectedError=bool(error)))
    print(report[-1],flush=True);return d

report=[]
base=BY_TARGET['pre-deposition']['recipe']
check('Drive-in without dopant', [step('diffusion',method='Drive-in')], 'Drive-in')
check('Pre-deposition with PR', [photo(.4),step('diffusion',method='Pre-deposition')], 'PR')
check('Fully blocked Si', [dep('SiO2',.08,'Conformal'),step('diffusion',method='Pre-deposition')], 'Si 표면')
check('B, high temperature and solubility cap',base[:-1]+[step('diffusion',method='Pre-deposition',species='B',surface_concentration=1e21,temperature=1100,diffusion_time=3600)])
d=check('Repeated pre-deposition and drive-in',base+[step('diffusion',method='Pre-deposition',diffusion_time=60),step('diffusion',method='Drive-in',diffusion_time=60)])
assert d['frames'][-1]['concentration']['info']['diagnostics'][0]['massRelativeError']<1e-6
d=check('Implant -> drive-in -> native Anneal -> oxide deposition',[
    photo(.5),step('diffusion',species='P',dose=1e14,energy=30),strip(),
    step('diffusion',method='Drive-in',diffusion_time=60),step('diffusion',method='Anneal',time=5),dep('SiO2',.02,'Conformal')])
assert d['frames'][-1]['processEvidence']['implantedSpecies']==['P']
assert sum(d['frames'][-1]['concentration']['fields']['P_total'])>0
(ROOT/'.runtime/diffusion-native-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS diffusion integration scenarios',flush=True)
