"""Fresh one-section device calculations and numerical topology diagnostics."""
import json,sys,concurrent.futures
from pathlib import Path
from scenarios import run,ROOT
out=ROOT/'.runtime/unified-devices';out.mkdir(parents=True,exist_ok=True)
def check(kind):
    data=run(dict(example=kind,params={}), 'engine.py')
    (out/(kind+'.json')).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    last=data['frames'][-1];c=last.get('concentration',{})
    row=dict(id=kind,frames=len(data['frames']),failure=data.get('failure'),elapsed=data['elapsed'],evidence=last.get('processEvidence'),bounds=data['bounds'],peaks={k:max(v) for k,v in c.get('fields',{}).items() if k.endswith('_active')})
    print(json.dumps(row,ensure_ascii=False),flush=True)
    return row
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(check,sys.argv[1:] or ['finfet','gaafet','mbcfet','cfet','bcat']))
(out/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
assert all(not r['failure'] for r in results)
