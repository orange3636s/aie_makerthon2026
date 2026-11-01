import json,math,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from reverse_catalog import BY_OP,validate
from recipe_models import resolve
def params(op,**values):return {**{f['key']:f['default'] for f in BY_OP[op]['fields']},**values}
def result(op,**values):return resolve(op,params(op,**values),{})
assert result('photo',action='Coat',coat_mode='Spin',spin_speed=6000)[0]['thickness']<result('photo',action='Coat',coat_mode='Spin',spin_speed=1500)[0]['thickness']
assert result('photo',action='HMDS',treatment_time=120)[1]['adhesionIndex']>result('photo',action='HMDS',treatment_time=1)[1]['adhesionIndex']
assert result('photo',action='Exposure',focus=.5)[1]['conversion']<result('photo',action='Exposure',focus=0)[1]['conversion']
assert result('photo',action='Develop',developer_concentration=4)[0]['develop_time']>result('photo',action='Develop',developer_concentration=2)[0]['develop_time']
assert result('etch',input_mode='Equipment',material='Si',gas='Cl2',pressure=10)[1]['anisotropy']>result('etch',input_mode='Equipment',material='Si',gas='Cl2',pressure=100)[1]['anisotropy']
assert result('cmp',input_mode='Equipment',slurry='Silica tungsten',down_force=6)[0]['rate']>result('cmp',input_mode='Equipment',slurry='Silica tungsten',down_force=2)[0]['rate']
for op,kw in [('etch',dict(input_mode='Equipment',method='Isotropic',material='W',etchant='HF')),('deposition',dict(input_mode='Equipment',method='CVD',source_gas='SiH4',material='W'))]:
 try:result(op,**kw);raise AssertionError('unsupported chemistry accepted')
 except ValueError:pass
cases=[]
hot=result('etch',input_mode='Equipment',method='Isotropic',material='Si3N4',etchant='H3PO4',etch_temperature=165)[0]['rate']
cold=result('etch',input_mode='Equipment',method='Isotropic',material='Si3N4',etchant='H3PO4',etch_temperature=25)[0]['rate']
assert abs(hot*1000*60-4.5)<1e-10 and cold<hot/100,'hot phosphoric reference temperature'
for temperature in [25,140,165,200]:
 p=params('etch',input_mode='Equipment',method='Isotropic',material='Si3N4',etchant='H3PO4',etch_temperature=temperature)
 q,_,_=resolve('etch',p,{});cases.append(dict(op='etch',params=p,nm=q['rate']*q['time']*1000))
for op,variations in [('deposition',[dict(method='PVD',material='Cu',power=1000,time=20),dict(method='CVD',material='SiO2',depo_temperature=500,source_flow=150,time=20),dict(method='CVD',material='SiO2',cvd_type='Thermal CVD',time=20),dict(method='ALD',material='Al2O3',precursor='TMA/H2O',pulse=.2,cycles=300)]),('etch',[dict(material='SiO2',gas='CF4',time=20),dict(method='Isotropic',material='SiO2',etchant='HF',etch_temperature=40,time=10),dict(method='ALE',cycles=50,epc=.0002)])]:
 for values in variations:
  p=params(op,input_mode='Equipment',**values);q,m,_=resolve(op,p,{})
  nm=m.get('nominalThicknessNm',q['epc']*q['cycles']*1000 if q.get('method')=='ALE' else q['rate']*q['time']*1000)
  cases.append(dict(op=op,params=p,nm=nm))
# Unified reference recipes: condition changes must agree in browser and native resolver.
for op,values in [('deposition',dict(method='PVD',power=1100,pvd_pressure=12,argon_flow=80)),('deposition',dict(method='CVD',depo_temperature=480,cvd_pressure=2,source_flow=160)),('etch',dict(method='Directional',rf_power=700,gas_flow=90,pressure=70)),('etch',dict(method='Isotropic',etch_temperature=40))]:
 p=params(op,**values);q,_,_=resolve(op,p,{})
 cases.append(dict(op=op,params=p,nm=q['rate']*q['time']*1000))
# LPCVD has a thermal anchor, no RF response, and independent time/flow/pressure responses.
poly=params('deposition',input_mode='Equipment',method='CVD',material='PolySi',
 cvd_type='LPCVD',source_gas='SiH4',source_flow=60,cvd_pressure=.2,depo_temperature=630,time=150/(11.02/60))
base=resolve('deposition',poly,{})[0]['rate']
assert abs(base*1000*60-11.02)<1e-10
for mode in ['Equipment','Effective']:
 for delta in [{},{'depo_temperature':650},{'source_flow':120},{'cvd_pressure':.4},{'time':2000},{'power':50},{'power':2000}]:
  p={**poly,'input_mode':mode,'rate':base,**delta};q,_,_=resolve('deposition',p,{})
  if 'power' in delta:assert abs(q['rate']-base)<1e-15
  if any(k in delta for k in ['depo_temperature','source_flow','cvd_pressure']):assert q['rate']>base
  cases.append(dict(op='deposition',params=p,nm=q['rate']*q['time']*1000))
for delta in [{'source_gas':'SiH4/O2'},{'material':'SiO2','source_gas':'SiH4/O2'}]:
 try:resolve('deposition',{**poly,**delta},{});raise AssertionError('unsupported LPCVD chemistry accepted')
 except ValueError:pass
js="const fs=require('fs'),r=require('./web/recipe-response.js');const cases=JSON.parse(fs.readFileSync(0,'utf8'));for(const c of cases){const n=r.nominal(c.op,c.params).nm;if(Math.abs(n-c.nm)>1e-8)throw Error('preview/backend mismatch '+JSON.stringify(c));}console.log(cases.length+' frontend/backend nominal-response parity cases passed');"
subprocess.run(['node','-e',js],input=json.dumps(cases),text=True,cwd=ROOT,check=True)
print('Spin, adhesion, exposure, develop, pressure, CMP and unsupported chemistry tests passed',flush=True)
if '--native' in sys.argv:
 from native_flows import simulate
 def row(op,**kw):return dict(op=op,params=params(op,**kw))
 flow=[row('photo',action='HMDS'),row('photo',action='Coat',coat_mode='Spin'),row('photo',action='Soft bake'),row('photo',action='Exposure',width=.4),row('photo',action='PEB'),row('photo',action='Develop'),row('photo',action='Hard bake'),row('etch',input_mode='Equipment',material='Si',gas='Cl2',time=5),row('photo',action='Ashing'),row('cmp',action='Cleaning',chemical='SC-1')]
 d=simulate(dict(target='mosfet',steps=flow));assert len(d['frames'])==11
 assert d['frames'][4]['metrics']['resolutionNm']>0
 assert d['frames'][8]['metrics']['etchRateNmS']>0
 print('Native HMDS → spin → bake → exposure → PEB → develop → hard bake → RIE → ashing → clean passed',flush=True)
 for method,kw in [('PVD',dict(material='Cu',power=500,time=5)),('CVD',dict(material='SiO2',source_gas='SiH4/O2',time=5)),('ALD',dict(material='Al2O3',precursor='TMA/H2O',cycles=100,pulse=.2))]:
  d=simulate(dict(target='mosfet',steps=[row('deposition',input_mode='Equipment',method=method,**kw)]));assert d['frames'][-1]['metrics']['topGrowthUm']>0
  print('Native equipment '+method+' growth passed',flush=True)
