"""Reproducible recipe experiments; no fabricated measurements or factory costs."""
import copy, hashlib, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from reverse_catalog import validate

OUT=ROOT/'.runtime'/'flow-candidates'
OUT.mkdir(parents=True,exist_ok=True)
catalog=json.loads((ROOT/'reverse-catalog.json').read_text(encoding='utf8'))
def clone(v): return copy.deepcopy(v)
def generate(t):
    refpath=ROOT/'references'/(t['id']+'.json')
    ref=json.loads(refpath.read_text(encoding='utf8'))
    base=ref['steps']; fast=clone(base); alt=clone(base)
    # Only manipulate parameters implemented by the current solver. The names
    # describe interventions, never promise better device performance.
    anneals=[i for i,s in enumerate(base) if s['op']=='diffusion' and s['params']['method']=='Anneal']
    ox=[i for i,s in enumerate(base) if s['op']=='diffusion' and 'oxidation' in s['params']['method']]
    etches=[i for i,s in enumerate(base) if s['op']=='etch' and s['params']['method'] not in ['Selective removal','Pattern transfer']]
    deps=[i for i,s in enumerate(base) if s['op']=='deposition']
    if anneals:
        for i in anneals: fast[i]['params']['time']=max(1,base[i]['params']['time']*.7)
        note='활성화 열처리 시간을 30% 줄여 농도와 효율을 비교합니다.'
    elif ox:
        for i in ox: fast[i]['params']['oxidation_time']*=.75
        note='산화 시간을 25% 줄여 산화막 두께를 비교합니다.'
    elif etches:
        i=etches[-1]; p=fast[i]['params']; key='cycles' if p['method']=='ALE' else 'time'
        p[key]=max(1,round(p[key]*.8)) if key=='cycles' else max(.05,p[key]*.8)
        note=f'STEP {i+1} 식각 처리량을 20% 줄여 잔류막과 치수를 비교합니다.'
    else:
        i=deps[-1];p=fast[i]['params'];key='cycles' if p['method']=='ALD' else 'time'
        p[key]=max(5,round(p[key]*.8)) if key=='cycles' else max(.1,p[key]*.8)
        note=f'STEP {i+1} 증착 처리량을 20% 줄여 두께를 비교합니다.'
    # Split a meaningful removal step to inspect its intermediate structure.
    # Same integrated removal budget is NOT assumed to produce identical geometry.
    split=[i for i in etches if (base[i]['params']['cycles']>=2 if base[i]['params']['method']=='ALE' else base[i]['params']['time']>=.1)]
    if split:
        i=split[-1];a=clone(base[i]);b=clone(base[i]);p=a['params'];q=b['params']
        key='cycles' if p['method']=='ALE' else 'time'; total=p[key]
        p[key]=int(total//2) if key=='cycles' else total/2;q[key]=total-p[key]
        name=base[i].get('label') or 'Etch'
        a['label']=(name[:60]+' · 1/2');b['label']=(name[:60]+' · 2/2')
        alt[i:i+1]=[a,b];altname='분할 식각';altnote=f'STEP {i+1}을 두 번으로 나눕니다. 총 처리량은 같고 단계 비용이 늘어납니다.'
    else:
        raise ValueError('No supported split operation '+t['id'])
    # Some examples have a suitable thin-film transport alternative. This is an
    # actual different supported model, with equal nominal planar growth only.
    film=next((i for i in deps if .01<=((base[i]['params']['gpc']*base[i]['params']['cycles']) if base[i]['params']['method']=='ALD' else base[i]['params']['rate']*base[i]['params']['time'])<=.3 and base[i]['params']['material'] in ['SiO2','HfO2','Si3N4']),None)
    if film is not None and t['id'] not in ['bosch','ale-har','sf6','wet','stack','regrowth']:
        alt=clone(base);p=alt[film]['params'];old=p['method']
        thickness=p['cycles']*p['gpc'] if old=='ALD' else p['rate']*p['time']
        if old=='ALD':
            p.update(method='CVD',rate=.05,time=thickness/.05,sticking=.2,exponent=1.)
        else:
            cycles=min(120,max(5,round(thickness/.001)))
            p.update(method='ALD',cycles=cycles,gpc=thickness/cycles,pulse=.1,ald_sticking=.00005)
        alt[film]['label']=p['method']+' · '+p['material']+' alternative'
        altname='박막 방식 비교';altnote=f"STEP {film+1}: {old} → {p['method']}. 평면 기준 성장량을 맞추고 피복 형상을 비교합니다."
    rows=[dict(id='reference',name='기준 플로우',description='기존 예시의 조건입니다.',steps=base),
          dict(id='short',name='시간·처리량 축소',description=note,steps=fast),
          dict(id='alternative',name=altname,description=altnote,steps=alt)]
    for row in rows:
        _,row['steps']=validate(dict(target=t['id'],steps=row['steps']))
    return dict(target=t['id'],title=t['title'],referenceHash=hashlib.sha256(refpath.read_bytes()).hexdigest(),candidates=rows)

if __name__=='__main__':
    data=[generate(t) for t in catalog['targets']]
    (OUT/'recipes.json').write_text(json.dumps(data,ensure_ascii=False),encoding='utf8')
    for entry in data:
        for c in entry['candidates'][1:]:
            (OUT/(entry['target']+'-'+c['id']+'-input.json')).write_text(json.dumps(dict(target=entry['target'],steps=c['steps']),ensure_ascii=False),encoding='utf8')
    print('Generated',len(data),'targets and',len(data)*2,'native experiments')
