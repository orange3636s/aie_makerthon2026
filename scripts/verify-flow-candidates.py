"""Run candidate recipes in isolated native workers, with bounded parallelism."""
import concurrent.futures, json, os, subprocess, sys, time
from pathlib import Path
root=Path(__file__).resolve().parents[1]; folder=root/'.runtime'/'flow-candidates'
def run(src):
    out=src.with_name(src.name.replace('-input','-result'));start=time.monotonic()
    if out.exists():
        previous=json.loads(out.read_text(encoding='utf8'));wanted=json.loads(src.read_text(encoding='utf8'))
        if not previous.get('failure') and previous.get('steps')==wanted['steps'] and len(previous.get('frames',[]))==len(wanted['steps'])+1:
            print(src.stem,'VERIFIED CACHE',flush=True);return src.stem
    p=subprocess.run([sys.executable,str(root/'reverse_engine.py'),str(src),str(out)],cwd=root,
      env={**os.environ,'OMP_NUM_THREADS':'1','PYTHONIOENCODING':'utf-8'},capture_output=True,timeout=180)
    if p.returncode:raise RuntimeError(src.stem+' '+p.stderr.decode('utf8',errors='replace')[-800:])
    r=json.loads(out.read_text(encoding='utf8'))
    assert not r.get('failure'),(src.stem,r.get('failure'))
    assert len(r['frames'])==len(r['steps'])+1
    print(src.stem,'PASS',round(time.monotonic()-start,1),'s',flush=True)
    return src.stem
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    entries=json.loads((folder/'recipes.json').read_text(encoding='utf8'))
    inputs=[folder/(t['target']+'-'+c['id']+'-input.json') for t in entries for c in t['candidates'][1:]]
    jobs=[pool.submit(run,p) for p in inputs]
    failed=[]
    for f in concurrent.futures.as_completed(jobs):
        try:f.result()
        except Exception as e:failed.append(str(e));print('FAIL',str(e),flush=True)
if failed:sys.exit(1)
print('All 48 native candidate calculations completed.',flush=True)
