"""All bundled steps: units, finite parameter responses and active numeric bounds.
This is a response-model boundary audit, not a native solve at every extreme.
"""
import copy,json,math,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from reverse_catalog import TARGETS,BY_OP,validate
from recipe_models import resolve
count=0;steps=0;ald=0
def finite(value):
    if isinstance(value,float):assert math.isfinite(value)
    elif isinstance(value,dict):
        for v in value.values():finite(v)
    elif isinstance(value,(list,tuple)):
        for v in value:finite(v)
for target in TARGETS:
    _,rows=validate(dict(target=target['id'],steps=target['recipe']))
    for row in rows:
        steps+=1;op=row['op'];p=row['params'];finite(resolve(op,p,{}));count+=1
        if op=='deposition' and p['method']=='ALD':
            ald+=1;assert .00001<=p['gpc']<=.0002,(target['id'],p['gpc'])
        for field in BY_OP[op]['fields']:
            if 'options' in field or not all(p.get(k) in v for k,v in field.get('when',{}).items()):continue
            for edge in ('min','max'):
                if edge not in field:continue
                candidate={**p,field['key']:field[edge]}
                finite(resolve(op,candidate,{}));count+=1
print(json.dumps(dict(examples=len(TARGETS),steps=steps,responseCases=count,aldFilms=ald,status='PASS')))
