"""Native regressions for editable layer/cycle flows and parameter bounds."""
import json,sys,concurrent.futures
from scenarios import ROOT,run
from reverse_catalog import BY_TARGET,photo,etch,strip
out=ROOT/'.runtime/flow-update';out.mkdir(exist_ok=True)
cases=[('finfet-min',dict(example='finfet',params=dict(length=.26,depth=.15,gate=.06,oxide=.015))),
       ('gaafet-thick',dict(example='gaafet',params=dict(length=.4,channel=.08))),
       ('mbcfet-two',dict(example='mbcfet',params=dict(sheets=2,thickness=.03,gap=.05))),
       ('mbcfet-four',dict(example='mbcfet',params=dict(sheets=4,thickness=.05,gap=.07))),
       ('cfet-thin',dict(example='cfet',params=dict(channel=.04,isolation=.08))),
       ('cfet-thick',dict(example='cfet',params=dict(channel=.08,isolation=.14)))]
def check(case):
    name,payload=case;d=run(payload,'engine.py');assert not d.get('failure'),(name,d.get('failure'))
    assert len(d['frames'])==len(d['steps'])+1
    assert max(abs(v) for v in d['frames'][-1]['concentration']['fields']['net_active'])>1e15
    (out/(name+'.json')).write_text(json.dumps(d,ensure_ascii=False),encoding='utf-8')
    row=dict(case=name,frames=len(d['frames']),seconds=d['elapsed']);print(row,flush=True);return row
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:rows=list(pool.map(check,cases))
base=run(dict(example='bosch',params={}),'engine.py')
assert len(base['frames'])==17 and len(base['stageControls'])==16
for index,value in [(4,1.2),(8,.10),(9,.16)]:
    d=run(dict(example='bosch',params={},stages={str(index):value}),'engine.py')
    assert d['frames'][:index]==base['frames'][:index],('changed earlier cycle',index)
    assert d['frames'][index]['polygons']!=base['frames'][index]['polygons'],('no stage effect',index)
    rows.append(dict(case='bosch phase '+str(index),status='PASS'))
for pattern in ['Central','Double','Triple','Repeat']:
    d=run(dict(target='sti',steps=[photo(.15,'Positive',pattern,.4),etch('Si',.15),strip()]))
    assert not d['failure'],d['failure'];rows.append(dict(case='mask '+pattern,status='PASS'))
# Photo preview frames must map back to their editable operation, not their
# position in the seven-frame animation.
d=run(dict(example='photo-lithography',params={}),'engine.py')
assert [f['stepIndex'] for f in d['frames']]==[0,1,2,2,2,3,4]
(out/'report.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS',len(rows),'native boundary/cycle/mask scenarios and preview mapping',flush=True)
