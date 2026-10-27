"""Relative physical trends, not experimental/TCAD calibration claims."""
import sys
import scenarios as suite
suite.REPORT="physics-trends"
from scenarios import check,okay,photo,etch,strip,ald,dep,step,report
def dose_addition():
 d=okay([step('diffusion'),step('diffusion')]);a=sum(d['frames'][1]['concentration']['fields']['P_total']);b=sum(d['frames'][2]['concentration']['fields']['P_total'])
 assert abs(b/a-2)<.001,(a,b)
def energy_depth():
 means=[]
 for energy in [10,100]:
  c=okay([step('diffusion',energy=energy)])['frames'][-1]['concentration'];v=c['fields']['P_total']
  assert sum(v)>0
  means.append(sum(x*(-c['origin'][1]-(i//c['nx']+.5)*c['dx']) for i,x in enumerate(v))/sum(v))
 assert means[1]>means[0],means
def compensation():
 d=okay([step('diffusion',species='B'),step('diffusion',species='P'),step('diffusion',method='Anneal',temperature=1100,time=120)])
 c=d['frames'][-1]['concentration']['fields'];assert any(v<0 for v in c['net_total'])
 for b,p,n in zip(c['B_total'],c['P_total'],c['net_total']):assert abs((p-b)-n)<max(1,abs(n)*1e-12)
def ald_growth():
 a=okay([ald('SiO2',.01)])['frames'][-1]['highest'];b=okay([ald('SiO2',.08)])['frames'][-1]['highest'];assert b>a+.03,(a,b)
def coverage():
 prefix=[photo(.4,'Positive'),etch('Si',.25),strip()];m=[]
 for method in ['PVD','CVD']:
  film=dep('SiO2',.1,method)
  if method=='PVD':film['params']['exponent']=5
  metric=okay(prefix+[film])['frames'][-1]['metrics'];m.append(metric)
 assert all('stepCoverage' in x for x in m),m
 assert m[1]['stepCoverage']>m[0]['stepCoverage'],m
if __name__=='__main__':
 for name,fn in [('repeated-dose-addition',dose_addition),('energy-depth',energy_depth),('B-P-compensation',compensation),('ALD-cycle-growth',ald_growth),('CVD-PVD-coverage',coverage)]:check('trend:'+name,fn)
 sys.exit(any(r['status']=='FAIL' for r in report))
