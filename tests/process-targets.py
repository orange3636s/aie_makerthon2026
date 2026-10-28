"""Native shared process targets: reference replay, polarity, masks, etch limits."""
import sys,json,subprocess,shutil
from scenarios import ROOT,run
from native_flows import simulate
from reverse_catalog import BY_TARGET
from process_presets import IDS
node=shutil.which('node') or 'C:/Program Files/nodejs/node.exe'
out=ROOT/'.runtime/process-targets';out.mkdir(exist_ok=True)
rows=[]
for key in sorted(IDS):
    target=BY_TARGET[key];ref=simulate(dict(target=key,steps=target['recipe']))
    (ROOT/'references'/(key+'.json')).write_text(json.dumps(ref,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    d=run(dict(example=key,params={}),'engine.py');assert not d.get('failure'),(key,d.get('failure'))
    file=out/(key+'.json');file.write_text(json.dumps(d),encoding='utf-8')
    score=json.loads(subprocess.check_output([node,str(ROOT/'tests/grade-result.cjs'),str(file)],encoding='utf-8'))['score'];assert score==100,(key,score)
    rows.append(dict(example=key,frames=len(d['frames']),score=score,seconds=d['elapsed']));print(rows[-1],flush=True)
for tone in ['Positive','Negative']:
    for pattern in ['Central','Double','Repeat']:
        d=run(dict(example='photo-lithography',params=dict(tone=tone,pattern=pattern)),'engine.py');assert not d.get('failure'),d.get('failure')
        assert len(d['frames'])==7 and d['frames'][3].get('exposure')
        assert all(p['material']!=0 for p in d['frames'][-1]['polygons'])
        (out/(tone+'-'+pattern+'.json')).write_text(json.dumps(d),encoding='utf-8')
        rows.append(dict(scenario=tone+'-'+pattern,status='PASS'))
assert json.loads((out/'Positive-Repeat.json').read_text())['frames'][-1]['polygons']!=json.loads((out/'Negative-Repeat.json').read_text())['frames'][-1]['polygons']
for key,params in [('rie',dict(rate=.5,duration=1.6,lateral=.3)),('photo-lithography',dict(oxide=.12,etch_time=.2)),('photo-lithography',dict(oxide=.04,etch_time=2)),('planarization',dict(height=.3,film=.15)),('planarization',dict(height=.08,film=.35))]:
    d=run(dict(example=key,params=params),'engine.py');assert not d.get('failure'),(key,d.get('failure'));rows.append(dict(scenario=key,params=params,status='PASS'))
(out/'report.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8');print('PASS process targets, polarity and boundary scenarios',flush=True)
