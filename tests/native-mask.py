import sys
sys.path.insert(0,'tests')
from native_flows import simulate
from reverse_catalog import BY_OP
p={f['key']:f['default'] for f in BY_OP['diffusion']['fields']}
p.update(method='Ion implantation',species='P',implant_mask='Central',implant_width=.3,implant_pitch=.6,implant_offset=0)
d=simulate(dict(target='mosfet',steps=[dict(op='diffusion',params=p)]));c=d['frames'][-1]['concentration'];v=c['fields']['P_total'];opened=[];blocked=[]
for i,n in enumerate(v):
 x=c['origin'][0]+(i%c['nx']+.5)*c['dx'];z=c['origin'][1]+(i//c['nx']+.5)*c['dx']
 if -.15<z<0 and c['mask'][i]:
  if abs(x)<.1:opened.append(n)
  elif abs(x)>.5:blocked.append(n)
assert max(opened)>1e16
assert max(blocked)<max(opened)*.01,(max(blocked),max(opened))
print('Native implant mask: protected silicon peak below 1% of opening peak; implanted profile present')
