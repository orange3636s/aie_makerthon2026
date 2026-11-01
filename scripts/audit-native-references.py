"""Recompute every observation example; validate all exported frames before publishing."""
import concurrent.futures,json,math,os,subprocess,sys,time,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.runtime'/'academic-audit';OUT.mkdir(parents=True,exist_ok=True)
def run(ex):
    src=OUT/(ex['id']+'-input.json');dst=OUT/(ex['id']+'.json')
    src.write_text(json.dumps(dict(example=ex['id'],params={})),encoding='utf8')
    start=time.monotonic()
    with tempfile.TemporaryDirectory(dir=OUT) as working:
        subprocess.run([sys.executable,str(ROOT/'engine.py'),str(src),str(dst)],cwd=working,env={**os.environ,'OMP_NUM_THREADS':'1'},check=True,capture_output=True,timeout=240)
    data=json.loads(dst.read_text(encoding='utf8'));assert not data.get('failure'),(ex['id'],data.get('failure'))
    assert len(data['frames'])==len(data['steps'])+1,ex['id']
    for f in data['frames']:
        assert f['polygons'] and all(p['closed'] and all(math.isfinite(v) for point in p['points'] for v in point) for p in f['polygons']),(ex['id'],f['label'])
        if f.get('concentration'):assert all(math.isfinite(v) for values in f['concentration']['fields'].values() for v in values)
    (ROOT/'references'/(ex['id']+'.json')).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    row=dict(id=ex['id'],frames=len(data['frames']),seconds=round(time.monotonic()-start,2));print(json.dumps(row),flush=True);return row
if __name__=='__main__':
    examples=json.loads((ROOT/'catalog.json').read_text(encoding='utf8'))['examples']
    if len(sys.argv)>1:examples=[e for e in examples if e['id'] in sys.argv[1:]]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:rows=list(pool.map(run,examples))
    (OUT/'references-report.json').write_text(json.dumps(rows,indent=2),encoding='utf8')
    print('PASS',len(rows),'examples',sum(r['frames'] for r in rows),'frames',flush=True)
