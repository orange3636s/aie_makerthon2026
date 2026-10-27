"""Every observation parameter, min/max independently; no external API involved."""
import json,sys,time
from pathlib import Path
from scenarios import run,ROOT
report=[]
prior=json.loads((ROOT/'.runtime/qa/boundaries.json').read_text(encoding='utf-8')) if '--failed-only' in sys.argv else []
passed={r['name']:r for r in prior if r['status']=='PASS'}
for example in json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))['examples']:
 for field in example['fields']:
  for edge in (range(len(field['options'])) if 'options' in field else ['min','max']):
   name=f"{example['id']}:{field['key']}:{edge}";start=time.monotonic()
   if name in passed:
    report.append(passed[name]);continue
   try:
    result=run(dict(example=example['id'],params={field['key']:(field['options'][edge] if 'options' in field else field[edge])}),'engine.py')
    assert not result.get('failure'),str(result.get('failure'))
    assert len(result['frames'])>=2
    row=dict(name=name,status='PASS',seconds=round(time.monotonic()-start,2))
   except Exception as e:row=dict(name=name,status='FAIL',error=str(e),seconds=round(time.monotonic()-start,2))
   report.append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
   (ROOT/'.runtime/qa/boundaries.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'.runtime/qa/boundaries.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
sys.exit(any(r['status']=='FAIL' for r in report))
