import json,sys,os,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root))
from reverse_engine import run
from reverse_catalog import step
def calc(method,**p):
 with tempfile.TemporaryDirectory(dir=root/'.runtime') as tmp:
  os.chdir(tmp)
  try:r=run(dict(target='sti',steps=[step('photo',action='Pattern',pattern='Central',tone='Positive',width=.3),step('etch',method=method,material='Si',**p)]))
  finally:os.chdir(root)
 assert r['failure'] is None,r['failure']
 return r['frames'][-1]
a=calc('ALE',cycles=100,epc=.0002);b=calc('ALE',cycles=200,epc=.0002);c=calc('ALE',cycles=100,epc=.0004)
assert a['polygons']!=b['polygons']
assert b['polygons']==c['polygons'],'ALE integrated depth must depend on EPC × cycles'
print('ALE cycle/EPC sensitivity passed')
dry=calc('Directional',rate=.15,time=1,isotropic=0)
wet=calc('Isotropic',rate=.15,time=1)
def silicon_at(frame,x,y):
 inside=False
 for poly in frame['polygons']:
  if poly['material']!=10:continue
  pts=poly['points']
  for (a,b),(c,d) in zip(pts,pts[1:]+pts[:1]):
   if (b>y)!=(d>y) and x<(c-a)*(y-b)/(d-b)+a:inside=not inside
 return inside
# Opening half-width is 150 nm. This point is 80 nm beneath the mask edge.
assert silicon_at(dry,.23,-.04),'dry etch should preserve Si beneath mask'
assert not silicon_at(wet,.23,-.04),'wet etch should undercut the mask'
print('Wet etch lateral undercut verified at 80 nm beneath mask; dry preserves it')
