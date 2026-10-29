"""Reproducible recipe experiments; no fabricated measurements or factory costs."""
import copy, hashlib, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from reverse_catalog import validate

OUT=ROOT/'.runtime'/'flow-candidates'
OUT.mkdir(parents=True,exist_ok=True)
catalog=json.loads((ROOT/'reverse-catalog.json').read_text(encoding='utf8'))
if __name__=='__main__':
    from industrial_routes import generate
    data=[generate(t) for t in catalog['targets']]
    (OUT/'recipes.json').write_text(json.dumps(data,ensure_ascii=False),encoding='utf8')
    for entry in data:
        for c in entry['candidates'][1:]:
            (OUT/(entry['target']+'-'+c['id']+'-input.json')).write_text(json.dumps(dict(target=entry['target'],steps=c['steps']),ensure_ascii=False),encoding='utf8')
    print('Generated',len(data),'targets and',len(data)*2,'native experiments')
