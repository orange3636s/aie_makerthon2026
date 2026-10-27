"""Coupled parameter corners: all minima / all maxima in every example."""
import json,sys
import scenarios as suite
from scenarios import run,check,report,ROOT
suite.REPORT='corners'
for ex in json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))['examples']:
 for edge in ['min','max']:
  def test(ex=ex,edge=edge):
   d=run({'example':ex['id'],'params':{f['key']:f[edge] for f in ex['fields']}},'engine.py')
   assert not d.get('failure'),d.get('failure')
  check(ex['id']+':all-'+edge,test)
sys.exit(any(r['status']=='FAIL' for r in report))
