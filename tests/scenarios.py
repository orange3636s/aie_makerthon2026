"""CPU integration scenarios. Run from the project with the native Python runtime."""
import json, math, subprocess, sys, tempfile, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from reverse_catalog import step,photo,etch,strip,ald,dep
report=[];REPORT='scenarios'
def run(payload,engine='reverse_engine.py'):
    with tempfile.TemporaryDirectory(dir=ROOT/'.runtime') as folder:
        folder=Path(folder);src=folder/'in.json';out=folder/'out.json'
        src.write_text(json.dumps(payload),encoding='utf-8')
        p=subprocess.run([sys.executable,str(ROOT/engine),str(src),str(out)],cwd=folder,capture_output=True,timeout=150)
        assert p.returncode==0,p.stderr[-600:]
        data=json.loads(out.read_text(encoding='utf-8'))
        assert data['frames'],'no frames'
        for f in data['frames']:
            assert f['polygons']
            for poly in f['polygons']:
                assert poly['closed']
                assert all(math.isfinite(v) for point in poly['points'] for v in point)
        return data
def flow(steps,target='sti'):return run(dict(target=target,steps=steps))
def check(name,test):
    t=time.monotonic()
    try:test();row=dict(name=name,status='PASS',seconds=round(time.monotonic()-t,2))
    except Exception as e:row=dict(name=name,status='FAIL',error=str(e),seconds=round(time.monotonic()-t,2))
    report.append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
    (ROOT/'.runtime/qa'/(REPORT+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
def okay(rows,target='sti'):
    d=flow(rows,target);assert not d['failure'],d['failure'];assert len(d['frames'])==len(rows)+1;return d
def rejection(rows,word,target='sti'):
    d=flow(rows,target);assert d['failure'] and word in d['failure']['message'],d.get('failure')
    assert len(d['frames'])==d['failure']['step'], 'failed step must not count as completed'
def polarity():
    a=okay([photo(.4,'Positive')]);b=okay([photo(.4,'Negative')])
    assert a['frames'][-1]['polygons']!=b['frames'][-1]['polygons']
def anisotropy():
    a=okay([photo(.4,'Positive'),etch('Si',.25,0)])
    b=okay([photo(.4,'Positive'),etch('Si',.25,1)])
    assert a['frames'][-1]['polygons']!=b['frames'][-1]['polygons']
def anneal():
    d=okay([step('diffusion',dose=1e13),step('diffusion',method='Anneal',temperature=1100,time=120),dep('SiO2',.04)])
    before=d['frames'][1]['concentration'];after=d['frames'][2]['concentration'];last=d['frames'][3]['concentration']
    a=before['fields']['P_total'];b=after['fields']['P_total'];c=last['fields']['P_total']
    assert abs(sum(a)-sum(b))/sum(a)<.005,'anneal mass conservation'
    assert max(b)<max(a),'anneal must broaden the distribution'
    assert abs(sum(b)-sum(c))/sum(b)<.02,'deposition must preserve implanted silicon dose'
def masked_implant():
    d=okay([photo(.4,'Negative'),step('diffusion',dose=1e13)])
    c=d['frames'][-1]['concentration'];center=[];sides=[]
    for i,v in enumerate(c['fields']['P_total']):
        x=c['origin'][0]+(i%c['nx']+.5)*c['dx']
        if abs(x)<.15:center.append(v)
        elif .3<abs(x)<.7:sides.append(v)
    assert sum(center)/len(center)<sum(sides)/len(sides)*.2,'PR must block implant'
if __name__=='__main__':
    (ROOT/'.runtime/qa').mkdir(parents=True,exist_ok=True)
    for ex in json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))['examples']:
        def default(ex=ex):
            d=run(dict(example=ex['id'],params={}), 'engine.py');assert not d.get('failure'),d.get('failure')
            if ex['id'] in ['sti','locos','fin','mosfet','finfet','mbcfet']:(ROOT/'.runtime/qa'/('fresh-'+ex['id']+'.json')).write_text(json.dumps(d),encoding='utf-8')
        check('observation:'+ex['id'],default)
    check('positive-negative PR',polarity)
    check('double-pattern PR',lambda:okay([photo(.2,'Positive','Double',.7),etch('Si',.2),strip()]))
    check('repeat-pattern PR',lambda:okay([photo(.16,'Negative','Repeat',.4),etch('Si',.2),strip()]))
    check('isotropic-directional change',anisotropy)
    for method in ['PVD','CVD','ALD']:
        check('deposition:'+method,lambda method=method:okay([photo(.4,'Positive'),etch('Si',.2),strip(),ald('SiO2',.05) if method=='ALD' else dep('SiO2',.05,method)]))
    check('implant-anneal-deposition conservation',anneal)
    check('masked implant',masked_implant)
    for name,rows,word in [
        ('CMP before deposition',[step('cmp')],'증착'),
        ('PR strip without PR',[strip()],'PR'),
        ('missing etch material',[etch('SiGe',.1)],'재료'),
        ('duplicate PR',[photo(.3),photo(.4)],'기존 PR'),
        ('oxidation without seed',[step('diffusion',method='Wet oxidation')],'seed'),
        ('anneal without implant',[step('diffusion',method='Anneal')],'도핑'),
        ('out-of-bounds etch',[step('etch',material='Si',rate=.5,time=2.)],'학습 영역'),
    ]:check('recovery:'+name,lambda rows=rows,word=word:rejection(rows,word))
    check('recovery:LOCOS implant boundary',lambda:rejection([step('diffusion')],'대칭',target='locos'))
    check('recovery:oxidation after implant',lambda:rejection([step('diffusion'),ald('SiO2',.025),step('diffusion',method='Wet oxidation')],'재분배'))
    check('recovery:anneal with PR',lambda:rejection([step('diffusion'),photo(.3),step('diffusion',method='Anneal')],'PR'))
    sys.exit(any(r['status']=='FAIL' for r in report))
