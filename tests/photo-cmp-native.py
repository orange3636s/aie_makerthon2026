"""Local native regression: separate photo steps, timed development/CMP, materials."""
import json,sys,tempfile,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from reverse_engine import run
from reverse_catalog import step
from process_presets import recipe

def execute(rows):
    with tempfile.TemporaryDirectory(prefix='photo-cmp-',dir=ROOT/'.runtime') as folder:
        previous=os.getcwd();os.chdir(folder)
        try:r=run(dict(target='photo-lithography',steps=rows))
        finally:os.chdir(previous)
    assert r['failure'] is None,r['failure']
    assert len(r['frames'])==len(r['steps'])+1
    assert all(p['closed'] for f in r['frames'] for p in f['polygons'])
    return r

base=[step('photo',action='Coat',thickness=.1,tone='Positive'),step('photo',action='Patterning',pattern='Double',width=.25,pitch=.65)]
a=execute(base+[step('photo',action='Develop',develop_time=20)])
b=execute(base+[step('photo',action='Develop',develop_time=60)])
c=execute(base+[step('photo',action='Develop',develop_time=120)])
assert a['frames'][1]['polygons']==a['frames'][2]['polygons'],'Patterning must not remove PR'
assert a['frames'][-1]['polygons']!=b['frames'][-1]['polygons']!=c['frames'][-1]['polygons']
assert a['frames'][-1]['metrics']['development']['fraction']<b['frames'][-1]['metrics']['development']['fraction']
negative=execute([{**base[0],'params':{**base[0]['params'],'tone':'Negative'}},base[1],step('photo',action='Develop',develop_time=120)])
assert negative['frames'][-1]['polygons']!=c['frames'][-1]['polygons']
strip=execute(base+[step('photo',action='Develop',develop_time=120),step('photo',action='Strip')]);assert not any(p['material']==0 for p in strip['frames'][-1]['polygons'])
print('Photo: coating, immutable alignment, 3 development times, both tones, strip passed')
dep=step('deposition',material='SiO2',method='PVD',rate=.08,time=2)
short=execute([dep,step('cmp',rate=.001,time=20)])
long=execute([dep,step('cmp',rate=.001,time=100)])
other=execute([dep,step('cmp',rate=.001,time=100,slurry='Ceria oxide')])
assert short['frames'][-1]['highest']>long['frames'][-1]['highest']
assert long['frames'][-1]['polygons']==other['frames'][-1]['polygons'],'record-only slurry must not affect geometry'
for name,mid in [('Al2O3',31),('HfZrO2',201)]:
    r=execute([step('deposition',material=name,method='PVD',rate=.08,time=1),step('etch',material=name,rate=.02,time=1)])
    assert any(p['material']==mid for p in r['frames'][-1]['polygons'])
print('C&C: removal-time sensitivity, slurry invariance; Al2O3/HZO deposition + etch passed')
catalog=json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'));spec=next(s for s in catalog['examples'] if s['id']=='photo-lithography');params={f['key']:f['default'] for f in spec['fields']}
r=execute(recipe('photo-lithography',params));r['params']=params
assert r['frames'][-1]['polygons'], 'photo example must retain its patterned film'
print('Photo Lithography example:',len(r['frames']),'frames; reference unchanged')
