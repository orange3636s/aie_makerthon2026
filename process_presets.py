"""Process targets whose observation and reverse answers share native recipes."""
import json
from pathlib import Path
IDS={'photo-lithography','lele','sadp','rie','pvd','cvd','ald','planarization','anneal'}

def recipe(kind,p):
    from reverse_catalog import step,photo,etch,strip,dep,ald,remove
    L=lambda name,s:dict(s,label=name)
    if kind=='photo-lithography':
        mask=photo(p['width'],p['tone'],p['pattern'],p['pitch'])
        return [L('SiO₂ barrier deposition',ald('SiO2',p['oxide'])),L('Develop · '+p['tone']+' PR',mask),L('SiO₂ pattern transfer',step('etch',material='SiO2',rate=.1,time=p['etch_time'],isotropic=0)),L('PR removal',strip())]
    if kind=='rie':
        return [L('Double-window PR',photo(p['width'],'Positive','Double',.8)),L('RIE · directional etch',step('etch',material='Si',rate=p['rate'],time=p['duration'],isotropic=p['lateral'])),L('PR removal',strip())]
    if kind=='lele':
        second=photo(p['cd'],'Negative','Double',p['pitch']);second['params']['offset']=p['overlay']
        return [L('Si₃N₄ target layer deposition',dep('Si3N4',.13,'PVD')),
                L('SiO₂ hardmask deposition',dep('SiO2',.12,'PVD')),
                L('Litho 1 · three-line PR',photo(p['cd'],'Negative','Triple',p['pitch'])),
                L('Etch 1 · SiO₂ hardmask',etch('SiO2',.16)),L('PR 1 removal',strip()),
                L('Litho 2 · interleaved PR',second),L('Etch 2 · Si₃N₄ pattern transfer',etch('Si3N4',.18)),
                L('PR 2 removal',strip()),L('SiO₂ hardmask removal',remove('SiO2'))]
    if kind=='sadp':
        return [L('Si₃N₄ target layer deposition',dep('Si3N4',.13,'PVD')),
                L('Poly-Si mandrel deposition',dep('PolySi',.18,'PVD')),
                L('Mandrel photo pattern',photo(p['mandrel'],'Negative','Triple',p['pitch'])),
                L('Poly-Si mandrel etch',etch('PolySi',.23)),L('Mandrel PR removal',strip()),
                L('SiO₂ spacer deposition',ald('SiO2',p['spacer'])),L('Spacer directional etchback',etch('SiO2',p['spacer']+.015)),
                L('Poly-Si mandrel removal',remove('PolySi')),L('Si₃N₄ pattern transfer',etch('Si3N4',.18)),
                L('SiO₂ spacer removal',remove('SiO2'))]
    if kind=='planarization':
        return [L('Si₃N₄ film',dep('Si3N4',p['height'],'PVD')),L('Repeat pattern',photo(.18,'Negative','Repeat',.5)),L('Pillar etch',etch('Si3N4',p['height']+.02)),L('PR removal',strip()),L('SiO₂ overburden',dep('SiO2',p['film'])),L('Global planarization',step('cmp'))]
    if kind in ('pvd','cvd','ald'):
        r=[L('Trench PR',photo(p['width'],'Positive')),L('Trench etch',etch('Si',p['depth'])),L('PR removal',strip())]
        if kind=='ald':return r+[L('ALD · SiO₂',step('deposition',method='ALD',material='SiO2',cycles=p['cycles'],gpc=.001,pulse=p['pulse'],ald_sticking=p['sticking']))]
        return r+[L(kind.upper()+' · '+str(i+1)+'/3',step('deposition',method=kind.upper(),material='SiO2',rate=.08,time=round(p['time']/3,12),sticking=p['sticking'],exponent=p['exponent'])) for i in range(3)]
    if kind=='anneal':
        r=[L('Implant window',photo(.5,'Positive')),L('Implant · '+p['species'],step('diffusion',species=p['species'],energy=30,dose=p['dose'])),L('PR removal',strip())]
        return r+[L('Anneal · '+str(round(p['time']*f,2))+' s',step('diffusion',method='Anneal',temperature=p['temperature'],time=p['time']*dt)) for f,dt in [(.25,.25),(.5,.25),(1.,.5)]]
    raise ValueError('지원하지 않는 공정 예제')

def targets():
    specs=json.loads((Path(__file__).parent/'catalog.json').read_text(encoding='utf-8'))['examples'];out=[]
    for s in specs:
        if s['id'] not in IDS:continue
        p={f['key']:f['default'] for f in s['fields']}
        t=dict(id=s['id'],title=s['title'],group=s['group'],width=1.6,bounds=[-.8,.8,-.5,.55],roi=[-.72,.72,-.5,.5],section='공정 패턴 단면',recipe=recipe(s['id'],p))
        if s['id']=='anneal':t['assessment']=dict(version=2,species=[p['species']],requireAnneal=True,weights=dict(geometry=.2,total=.35,active=.35,process=.1));t['grading']='doping'
        if s['id'] in ('lele','sadp'):t['projectedMask']=True
        out.append(t)
    return out

def run(spec,p):
    from reverse_engine import run as native
    d=native(dict(target=spec['id'],steps=recipe(spec['id'],p),_photoPreview=spec['id']=='photo-lithography'))
    d.update(params=p,mode=spec['mode'],model=spec['model'],note=spec['note'],source=spec['source'],previewFrame=len(d['frames'])-1)
    return d
