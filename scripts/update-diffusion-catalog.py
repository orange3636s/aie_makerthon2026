"""Add two local diffusion examples and refresh operation schemas, not references."""
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
catalog=json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))

def number(key,label,default,lo,hi,unit,step,description):
    return dict(key=key,label=label,default=default,min=lo,max=hi,unit=unit,step=step,description=description)

for kind,title,temperature,duration in [('pre-deposition','Pre-deposition',1000,600),('drive-in','Drive-in',1050,1200)]:
    note='노출된 Si 표면의 고정 농도 공급' if kind=='pre-deposition' else '1000 °C · 300 s Pre-deposition 후 공급 없는 확산'
    spec=dict(id=kind,title=title,group='Diffusion',mode='physics',model='FiPy finite-volume diffusion',
        subtitle='Si · B/P diffusion',description=note,note=note+' · 10 nm 격자 · 고유 확산·평형 활성화 · 비 Si 완전 차단',
        source='https://pages.nist.gov/fipy/en/stable/generated/examples.diffusion.mesh1D.html',
        fields=[dict(key='species',label='도펀트',default='P',options=['P','B'],description='Si에서 종별 Arrhenius 계수를 사용합니다.'),
            number('width','확산 창 폭',.5,.2,.8,'µm',.05,'SiO₂ 확산 마스크의 개구 폭입니다.'),
            number('surface_concentration','표면 공급 농도',1e20,1e17,1e21,'cm⁻³',1e17,'Pre-deposition의 공급 농도. 온도별 고용도로 제한됩니다.'),
            number('temperature','온도',temperature,950,1100,'°C',25,'선택 단계의 고유 확산 계수를 결정합니다.'),
            number('duration','확산 시간',duration,60,3600,'s',60,'선택 단계의 처리 시간입니다.')],
        flow=['SiO₂ diffusion mask','Diffusion window photo','SiO₂ window etch','PR removal','Pre-deposition']+(['Drive-in'] if kind=='drive-in' else []))
    found=next((i for i,s in enumerate(catalog['examples']) if s['id']==kind),None)
    if found is None:
        at=max(i for i,s in enumerate(catalog['examples']) if s['group']=='Diffusion')+1
        catalog['examples'].insert(at,spec)
    else:catalog['examples'][found]=spec
(ROOT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
from reverse_catalog import OPS,TARGETS
(ROOT/'reverse-catalog.json').write_text(json.dumps(dict(operations=OPS,targets=TARGETS),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Pre-deposition / Drive-in schemas updated')
