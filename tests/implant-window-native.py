import json,sys,os,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root))
from reverse_engine import run
def calc(species,mask):
 with tempfile.TemporaryDirectory(dir=root/'.runtime') as tmp:
  os.chdir(tmp)
  try:d=run(dict(target='pn-junction',steps=[dict(op='diffusion',params=dict(method='Ion implantation',species=species,implant_mask=mask,implant_width=.3,implant_pitch=.8))]))
  finally:os.chdir(root)
 assert d['failure'] is None,d['failure']
 assert d['frames'][-1]['concentration']['fields']['net_total']
 assert d['frames'][0]['polygons']==d['frames'][-1]['polygons'],'implant screen must not change wafer geometry'
 return d['frames'][-1]['concentration']
a=calc('P','Central');b=calc('P','Double');c=calc('B','Central')
assert a['fields']['net_total']!=b['fields']['net_total']
assert max(a['fields']['net_total'])>0 and min(c['fields']['net_total'])<0
assert a['fields']['net_total']!=c['fields']['net_total']
print('P/B polarity, central/double mask concentration, unchanged geometry passed')
