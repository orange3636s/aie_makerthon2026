import copy,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from scenarios import run
from reverse_catalog import BY_TARGET
recipe=copy.deepcopy(BY_TARGET['mosfet']['recipe'])
index=next(i for i,s in enumerate(recipe) if s['op']=='diffusion' and s['params'].get('method')=='Ion implantation')
rows=[]
for mask in ['Existing','Double']:
    flow=copy.deepcopy(recipe[:index+1]);flow[-1]['params'].update(implant_mask=mask,implant_width=.3,implant_pitch=.6,implant_offset=0)
    r=run(dict(target='mosfet',steps=flow));assert not r.get('failure'),r.get('failure')
    c=r['frames'][-1]['concentration']
    def peak(lo,hi):
        return max((v for i,v in enumerate(c['fields']['P_total']) if lo<c['origin'][0]+(i%c['nx']+.5)*c['dx']<hi),default=0)
    assert peak(.22,.35)>1e16,'exposed S/D receives dose'
    assert peak(-.05,.05)<1e14,'gate shields channel'
    rows.append(dict(mask=mask,exposed=peak(.22,.35),outer=peak(.6,.7),channel=peak(-.05,.05)))
    if mask=='Double':(ROOT/'.runtime/implant-mask-native-result.json').write_text(json.dumps(r),encoding='utf8')
assert rows[0]['outer']>1e16 and rows[1]['outer']<1e14,'selected mask changes actual implanted region'
print('Native gate/selected-mask blocking, open S/D dose and unimplanted outer Si passed',rows)
