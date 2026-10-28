"""Native device scenarios, physical material invariants and parameter limits."""
import json,sys
import scenarios as suite
from scenarios import ROOT,run,report
from reverse_catalog import BY_TARGET,validate
from advanced_devices import SOURCES
suite.REPORT='advanced-devices'
prior=json.loads((ROOT/'.runtime/qa/advanced-devices.json').read_text(encoding='utf-8')) if '--failed-only' in sys.argv else []
passed={r['name']:r for r in prior if r['status']=='PASS'}

def check(name,fn):
    if name in passed:report.append(passed[name])
    else:suite.check(name,fn)

def extent(polys,mat):
    points=[p for q in polys if q['material']==mat for p in q['points']]
    assert points, f'material {mat} missing'
    return min(y for x,y in points),max(y for x,y in points)

def verify(ex,params,save=False):
    d=run(dict(example=ex['id'],params=params),'engine.py');kind=ex['id']
    assert not d.get('failure'),d.get('failure')
    assert len(d['frames'])==len(d['steps'])+1
    assert all(f['label'] for f in d['frames'])
    f=d['frames'][-1];poly=f['polygons'];mats={q['material'] for q in poly}
    if kind=='rcat':
        lo,hi=extent(poly,11);assert lo<-.1 and hi>.08,'recess gate must cross the wafer surface'
        assert {10,11,16,30}<=mats
    elif kind=='bcat':
        buried=next(f for f in d['frames'] if f['label']=='Cap CMP');lo,hi=extent(buried['polygons'],70);assert hi<.015 and lo<-.1,'gate must remain buried'
        assert 16 in mats and 'concentration' in f
    elif kind in ('fdsoi','pdsoi'):
        body=params.get('body',.04 if kind=='fdsoi' else .16)
        assert d['frames'][0]['label'].startswith('SOI wafer')
        assert len([q for q in poly if q['material']==10])>=2,'BOX must split body and handle'
        assert extent(d['frames'][0]['polygons'],30)[0]<-body-.13
        c=f['concentration']
        assert max(abs(v) for i,v in enumerate(c['fields']['net_total']) if c['origin'][1]+(i//c['nx']+.5)*c['dx']<-body-.15)==0,'implant must not restart below BOX'
    elif kind in ('gaafet','cfet'):
        assert 13 not in mats,'sacrificial SiGe survives release'
        assert len([q for q in poly if q['material']==10])>= (3 if kind=='cfet' else 2),'released Si channel missing'
        assert {32,79}<=mats
        if kind=='cfet':
            assert extent(poly,70)[0]-extent(poly,79)[1]>.025,'upper/lower gate isolation lost'
            assert 30 in mats
    elif kind=='charge-trap':
        assert {10,11,16,30}<=mats
        nitride=extent(poly,16);gate=extent(poly,11)
        assert nitride[0]>.005 and nitride[1]<gate[0]-.005,'ONO order / blocking oxide lost'
    elif kind=='pn-junction':
        assert min(f['concentration']['fields']['net_total'])<0<max(f['concentration']['fields']['net_total'])
    if f.get('concentration'):
        c=f['concentration']
        assert all(v==0 for v,m in zip(c['fields']['net_total'],c['mask']) if not m),'doping outside active Si'
    if save:
        d['params']={z['key']:z['default'] for z in ex['fields']}
        (ROOT/'references'/(kind+'.json')).write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

(ROOT/'.runtime/qa').mkdir(exist_ok=True)
examples=[e for e in json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))['examples'] if e['id'] in SOURCES]
for ex in examples:
    check(ex['id']+':default',lambda ex=ex:verify(ex,{},True))
    for f in [f for f in ex['fields'] if 'options' not in f and not f['key'].startswith('sd_')]:
        for edge in ('min','max'):
            check(f"{ex['id']}:{f['key']}:{edge}",lambda ex=ex,f=f,edge=edge:verify(ex,{f['key']:f[edge]}))
    for edge in ('min','max'):
        check(ex['id']+':all-'+edge,lambda ex=ex,edge=edge:verify(ex,{f['key']:f[edge] for f in ex['fields'] if 'options' not in f and not f['key'].startswith('sd_')}))

def reference_matches():
    catalog=json.loads((ROOT/'reverse-catalog.json').read_text(encoding='utf-8'))
    for target in catalog['targets']:
        assert target==BY_TARGET[target['id']],'Python/JSON catalog drift'
        validate(dict(target=target['id'],steps=target['recipe']))
        r=json.loads((ROOT/'references'/(target['id']+'.json')).read_text(encoding='utf-8'))
        assert not r['failure'] and len(r['frames'])==len(target['recipe'])+1,target['id']
check('reference / catalog consistency',reference_matches)
(ROOT/'.runtime/qa/advanced-devices.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
if any(r['status']=='FAIL' for r in report):sys.exit(1)
