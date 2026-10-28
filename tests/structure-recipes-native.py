import json,os,sys,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root))
from reverse_catalog import TARGETS,validate
from engine import run
specs=json.loads((root/'catalog.json').read_text(encoding='utf-8'))['examples']
report=[]
for s in specs:

 params={f['key']:f['default'] for f in s['fields']}
 with tempfile.TemporaryDirectory(dir=root/'.runtime') as tmp:
  os.chdir(tmp)
  try:d=run(dict(example=s['id'],params=params))
  finally:os.chdir(root)
 assert not d.get('failure'),(s['id'],d.get('failure'))
 assert len(d['steps'])+1==len(d['frames']),s['id']
 assert len(d['steps'])<=96
 for row in d['steps']:
  p=row['params'];assert p.get('action')!='Pattern';assert p.get('method') not in ('Conformal','Selective removal','Pattern transfer')
 assert all(f['polygons'] and all(p['closed'] for p in f['polygons']) for f in d['frames'])
 if s['id']=='locos':assert any(p['material']==30 for p in d['frames'][-1]['polygons'])
 # Reference and observation must use exactly the same recipe.
 t=next(t for t in TARGETS if t['id']==s['id']);_,answer=validate(dict(target=t['id'],steps=t['recipe']))
 if s['group']=='구조':assert answer==d['steps'],s['id']+' reference recipe mismatch'
 (root/'references'/f"{s['id']}.json").write_text(json.dumps(d,ensure_ascii=False),encoding='utf-8')
 report.append(dict(id=s['id'],frames=len(d['frames']),elapsed=d['elapsed']))
 print(s['id'],len(d['frames']),'frames',flush=True)
(root/'.runtime/structure-recipe-qa.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
