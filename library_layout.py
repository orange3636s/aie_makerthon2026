"""Structure-oriented names; stable IDs preserve saved flows and references."""
NAMES={'photo-lithography': 'Line pattern', 'pvd': 'Trench', 'sti': 'STI', 'wet': 'Cavity', 'regrowth': 'Lateral cavity', 'sf6': 'Hole', 'stack': 'Multi-layer Hole', 'bosch': 'Bosch HAR', 'ale-har': 'ALE HAR', 'sadp': 'Spacer', 'locos': 'LOCOS', 'fin': 'FIN', 'planarization': 'Planar space'}
def organize(rows):
 devices={'pn-junction','mosfet','fdsoi','pdsoi','rcat','bcat','finfet','gaafet','mbcfet','charge-trap','cfet'}
 for row in rows:
  if row['id'] in NAMES:row['title']=NAMES[row['id']]
  row['group']='소자' if row['id'] in devices else '구조'
 return rows
