"""Concurrent native jobs sharing a cwd must match their isolated serial results."""
import concurrent.futures,json,math,os,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(dir=ROOT/'.runtime') as directory:
    work=Path(directory)
    def run(kind,label):
        src=work/(label+'-input.json');out=work/(label+'-output.json')
        payload=dict(target='mosfet',steps=[dict(op='diffusion',params=dict(method='Ion implantation',species=kind,energy=30,dose=1e13)),dict(op='diffusion',params=dict(method='Anneal',temperature=1000,time=2))])
        src.write_text(json.dumps(payload),encoding='utf8')
        subprocess.run([sys.executable,str(ROOT/'reverse_engine.py'),str(src),str(out)],cwd=work,env={**os.environ,'OMP_NUM_THREADS':'1'},capture_output=True,check=True,timeout=120)
        data=json.loads(out.read_text(encoding='utf8'));assert not data['failure'],data['failure']
        return data['frames'][-1]['concentration']['fields']
    serial={k:run(k,'serial-'+k) for k in ['B','P']}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        parallel=dict(zip(['B','P'],pool.map(lambda k:run(k,'parallel-'+k),['B','P'])))
    for kind in serial:
        assert serial[kind].keys()==parallel[kind].keys()
        for field,values in serial[kind].items():
            actual=parallel[kind][field];assert len(values)==len(actual)
            assert all(math.isclose(a,b,rel_tol=1e-10,abs_tol=1e-8) for a,b in zip(values,actual)),(kind,field)
    assert not list(work.glob('transport-*')),'transport scratch must be cleaned'
print('PASS: B/P simultaneous implants + anneals equal serial fields; no scratch collision or leftovers')
