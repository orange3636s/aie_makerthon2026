import json,time,urllib.request,urllib.error,math
from pathlib import Path
base='http://127.0.0.1:3001'
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def call(route,data=None):
 r=urllib.request.Request(base+route,data=None if data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json'})
 with opener.open(r,timeout=10) as out:return json.load(out)
def run(data,route='/api/flow'):
 job=call(route,data)['job']
 for _ in range(300):
  state=call('/api/jobs/'+job)
  if state['state']=='done':return state['result']
  assert state['state']!='error',state
  time.sleep(.25)
 raise AssertionError('timeout')
cat=call('/flow-catalog.json');targets=call('/targets.json')
for t in cat['targets']:
 result=run({'target':t['id'],'steps':t['recipe']})
 assert result['failure'] is None,result['failure']
 assert result['frames'][-1]['polygons']==targets[t['id']]['frames'][-1]['polygons']
 assert all(p['closed'] and all(math.isfinite(v) for xy in p['points'] for v in xy) for f in result['frames'] for p in f['polygons'])
 print('PASS target',t['id'],len(result['frames']),flush=True)
recipe=json.loads(json.dumps(cat['targets'][1]['recipe']));recipe[-1]['params']['thickness']=.18
result=run({'target':'finfet','steps':recipe})
assert result['frames'][-1]['polygons']!=targets['finfet']['frames'][-1]['polygons']
print('PASS changed thickness changes result',flush=True)
result=run({'target':'finfet','steps':[{'op':'strip','params':{'material':'Mask'}}]})
assert result['failure']['step']==1 and len(result['frames'])==1
print('PASS invalid sequence returns last valid frame',flush=True)
for op,steps in [('cvd',[{'op':'cvd','params':{}}]),('wet',cat['targets'][2]['recipe'][:1]+[{'op':'wet','params':{}}]),('oxidation',[{'op':'coat','params':{}},{'op':'oxidation','params':{}}])]:
 result=run({'target':'trench','steps':steps});assert not result['failure'],result['failure'];print('PASS additional operation',op,flush=True)
try:call('/api/flow',{'target':'finfet','steps':[{'op':'coat','params':{'thickness':999}}]})
except urllib.error.HTTPError as e:assert e.code==400
else:raise AssertionError('accepted invalid number')
print('PASS bounds validation',flush=True)
for spec in call('/api/catalog')['examples']:
 result=run({'example':spec['id']},'/api/run');assert len(result['frames'])>=2
 print('PASS existing example',spec['id'],flush=True)
