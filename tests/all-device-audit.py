"""Fresh observation calculations, dopant evidence, native contact-fill regression."""
import json,sys,subprocess,shutil,concurrent.futures
from pathlib import Path
from scenarios import run,ROOT
from reverse_catalog import BY_TARGET,TARGETS,OPS
node=shutil.which('node') or 'C:/Program Files/nodejs/node.exe'
out=ROOT/'.runtime/all-device-audit';out.mkdir(parents=True,exist_ok=True)
catalog=json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))

def check(task):
    spec,view,section=task;key=spec['id']+('' if view=='gate' else '-'+view)
    params={} if view=='gate' else {'section':section}
    file=out/(key+'.json')
    # Resume only explicitly, after inspecting which recipes changed.
    d=json.loads(file.read_text(encoding='utf-8')) if '--resume' in sys.argv and file.exists() and key!='bcat' else run(dict(example=spec['id'],params=params),'engine.py')
    assert not d.get('failure'),(key,d.get('failure'))
    file.write_text(json.dumps(d,ensure_ascii=False),encoding='utf-8')
    target=BY_TARGET[spec['id']] if view=='gate' else BY_TARGET[spec['id']]['sections'][view]
    f=d['frames'][-1];c=f.get('concentration');e=f['processEvidence'];expected=target.get('assessment')
    if expected:
        assert c and set(expected['species'])<=set(e['annealedSpecies']),(key,'missing completed implant/activation')
        for species in expected['species']:
            vals=c['fields'][species+'_active']
            # Both S/D regions, or the corresponding half of the PN junction.
            sides=([-1] if species=='P' else [1]) if key=='pn-junction' else [-1,1]
            for sign in sides:
                assert any(v>1e15 and sign*(c['origin'][0]+(i%c['nx']+.5)*c['dx'])>.2 for i,v in enumerate(vals)),(key,species,sign,'missing active region')
    else:
        assert not c and not e['implantedSpecies'],(key,'gate cross section must not invent S/D doping')
    fill=json.loads(subprocess.check_output([node,str(ROOT/'tests/contact-fill.cjs'),str(file)],encoding='utf-8'))
    row=dict(target=key,frames=len(d['frames']),elapsed=d['elapsed'],doping=bool(c),evidence=e,contacts=fill)
    if fill:assert all(v['voidFraction']<.025 and v['metalFraction']>.975 for v in fill),(key,fill)
    if '--update-references' in sys.argv:
        (ROOT/'references'/(key+'.json')).write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps(row,ensure_ascii=False),flush=True);return row

tasks=[]
for spec in catalog['examples']:
    if spec['group']!='소자':continue
    tasks.append((spec,'gate',None))
    for view in BY_TARGET[spec['id']].get('sections',{}):tasks.append((spec,view,'p형 S/D·콘택' if view=='sd-p' else 'n형 S/D·콘택'))
rows=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for result in pool.map(check,tasks):
        rows.append(result);(out/'report.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
if '--update-references' in sys.argv:
    (ROOT/'reverse-catalog.json').write_text(json.dumps(dict(operations=OPS,targets=TARGETS),ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS',len(rows),'fresh device views',flush=True)
