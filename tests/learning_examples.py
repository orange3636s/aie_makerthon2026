"""Native learning examples: defaults, every numeric boundary, every choice,
coupled corners, and scientific invariants. No LLM service is contacted.
"""
import json,sys
import scenarios as suite
from scenarios import run,check as record,ROOT,report
suite.REPORT='learning-examples'
prior=json.loads((ROOT/'.runtime/qa/learning-examples.json').read_text(encoding='utf-8')) if '--failed-only' in sys.argv else []
passed={r['name']:r for r in prior if r['status']=='PASS'}
def check(name,fn):
    if name in passed:report.append(passed[name])
    else:record(name,fn)

ids={'pvd','cvd','ald','implant','anneal','pn-junction'}
examples=[e for e in json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))['examples'] if e['id'] in ids]

def verify(ex,params,save=False):
    d=run(dict(example=ex['id'],params=params),'engine.py')
    assert not d.get('failure'),d.get('failure')
    assert d['example']==ex['id']
    if ex['group']=='Diffusion':
        c=d['frames'][-1]['concentration'];f=c['fields']
        assert any(abs(x)>0 for x in f['net_total']), 'empty doping distribution'
        assert all(v==0 for v,m in zip(f['net_total'],c['mask']) if not m), 'dopant outside Si'
        if ex['id']=='anneal':
            before=d['frames'][2]['concentration']['fields'][params.get('species','B')+'_total']
            after=f[params.get('species','B')+'_total']
            assert abs(sum(after)/sum(before)-1)<.005, 'mass conservation'
            assert max(after)<=max(before)*1.001, 'diffusion peak increased'
        if ex['id']=='pn-junction':
            assert min(f['net_total'])<0<max(f['net_total']), 'missing p/n regions'
    else:
        assert d['frames'][-1]['highest']>d['frames'][3]['highest'], 'no deposited film'
    if save:(ROOT/'.runtime/qa'/('new-'+ex['id']+'.json')).write_text(json.dumps(d),encoding='utf-8')

for ex in examples:
    check(ex['id']+':default',lambda ex=ex:verify(ex,{},True))
    for f in ex['fields']:
        cases=list(enumerate(f['options'])) if 'options' in f else [(k,f[k]) for k in ('min','max')]
        for label,value in cases:
            check(f"{ex['id']}:{f['key']}:{label}",lambda ex=ex,f=f,value=value:verify(ex,{f['key']:value}))
    for edge in ('min','max'):
        params={f['key']:f['options'][0 if edge=='min' else -1] if 'options' in f else f[edge] for f in ex['fields']}
        check(ex['id']+':all-'+edge,lambda ex=ex,params=params:verify(ex,params))
(ROOT/'.runtime/qa/learning-examples.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
sys.exit(any(r['status']=='FAIL' for r in report))
