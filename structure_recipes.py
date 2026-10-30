"""Editable teaching recipes. Dedicated chemistry models remain in engine.py."""
import copy
EXTRA={'wet','sf6','bosch','cryo','stack','regrowth','implant','ale-har'}
def modernize(rows):
 from reverse_catalog import step
 out=[];last_deposition=None
 for row in copy.deepcopy(rows):
  p=row['params'];op=row['op'];name=row.get('label','')
  if op=='deposition':last_deposition=p.get('material')
  if op=='cmp' and not p.get('slurry'):
   p['slurry']={'SiO2':'Ceria oxide','Si3N4':'Silica nitride','Si':'Silica silicon','SiGe':'Silica SiGe','PolySi':'Silica polysilicon','W':'Silica tungsten','Co':'Cobalt formulated','Mo':'Silica molybdenum','TiN':'Silica TiN','HfO2':'Silica hafnia'}.get(last_deposition,'Unspecified')
  if op=='photo' and p.get('action','Pattern')=='Pattern':
   out.extend([dict(step('photo',action='Coat',tone=p.get('tone','Negative'),thickness=p.get('thickness',.06)),label='PR coating'),
               dict(step('photo',action='Patterning',**{k:p[k] for k in ('pattern','width','pitch','offset') if k in p}),label=name or 'Patterning'),
               dict(step('photo',action='Develop',develop_time=150),label='Developing')]);continue
  if op=='deposition' and p.get('method')=='Conformal':p.update(method='CVD',sticking=.05,exponent=1.)
  if op=='etch' and p.get('method')=='Selective removal':p.update(method='Isotropic',rate=.3,time=2.,access='Section sides')
  if op=='etch' and p.get('method')=='Pattern transfer':p.update(method='Directional',isotropic=0.)
  out.append(row)
 return out

def recipe(kind,p):
 from process_timing import retime
 return retime(_recipe(kind,p))

def _recipe(kind,p):
 from reverse_catalog import step,dep,photo,etch,strip,ald
 L=lambda name,s:dict(s,label=name)
 width=min(1.,max(.1,p.get('width',.5)))
 if kind=='ale-har':
  width=p['width'];rows=[L('Si₃N₄ hardmask',dep('Si3N4',.08,'PVD')),photo(width,'Positive'),etch('Si3N4',.10),strip()]
  count=int(p['cycles']);parts=min(5,count);base,extra=divmod(count,parts)
  for i in range(parts):rows.append(L(f'ALE · cycle batch {i+1}',step('etch',material='Si',method='ALE',cycles=base+(i<extra),epc=p['epc'])))
  return modernize(rows)
 if kind=='implant':return modernize([photo(width,'Positive'),L('Ion implantation',step('diffusion',method='Ion implantation',species=p['species'],energy=p['energy'],dose=p['dose'])),strip(),L('Activation annealing',step('diffusion',method='Anneal',temperature=1000,time=30))])
 if kind in ('wet','sf6','cryo'):
  depth=.15*p.get('duration',1.) if kind=='wet' else .6
  return modernize([L('Si₃N₄ hardmask',dep('Si3N4',.08,'PVD')),photo(width,'Positive'),etch('Si3N4',.10),strip(),L('Wet Etch' if kind=='wet' else 'Dry Etch · effective profile',step('etch',material='Si',method='Isotropic' if kind=='wet' else 'Directional',rate=.15,time=depth/.15,isotropic=.005 if kind=='cryo' else .03))])
 if kind=='bosch':
  rows=[L('Si₃N₄ hardmask',dep('Si3N4',.08,'PVD')),photo(width,'Positive'),etch('Si3N4',.10),strip()]
  for i in range(min(12,int(p['cycles']))):
   # SiO2 is an explicit surrogate protective liner, not a C4F8 chemistry model.
   rows.extend([L(f'Cycle {i+1} · Si etch',step('etch',material='Si',method='Directional',rate=.12,time=p['etch_time'],isotropic=.08)),L(f'Cycle {i+1} · liner deposition',ald('SiO2',.015)),L(f'Cycle {i+1} · bottom etchback',etch('SiO2',.02))])
  return modernize(rows)
 if kind in ('stack','regrowth'):
  count=min(8,int(p.get('layers',6)));rows=[]
  for i in range(count):rows.append(L(f'Layer {i+1} · '+('SiO₂' if i%2 else 'Si₃N₄'),dep('SiO2' if i%2 else 'Si3N4',.06,'PVD')))
  rows.append(photo(width,'Positive'))
  for i in range(count-1,-1,-1):rows.append(L(f'Layer {i+1} · Dry Etch',etch('SiO2' if i%2 else 'Si3N4',.07)))
  rows.append(strip())
  if kind=='regrowth':rows.extend([L('Lateral nitride recess',step('etch',material='Si3N4',method='Isotropic',rate=.05,time=2)),L('SiO₂ surface coating',ald('SiO2',.01))])
  return modernize(rows)
 raise ValueError(kind)

def targets(specs):
 out=[]
 for s in specs:
  if s['id'] not in EXTRA:continue
  p={f['key']:f['default'] for f in s['fields']}
  t=dict(id=s['id'],title=s['title'],group='구조',width=1.6,bounds=[-.8,.8,-.8,.7],roi=[-.75,.75,-.75,.65],section='공통 레시피 학습 단면',recipe=recipe(s['id'],p))
  if s['id']=='implant':t.update(grading='doping',assessment=dict(version=2,species=[p['species']],requireAnneal=True,weights=dict(geometry=.2,total=.35,active=.35,process=.1)))
  out.append(t)
 return out
