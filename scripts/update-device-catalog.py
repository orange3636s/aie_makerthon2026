"""Regenerate the four unified device definitions; other examples are untouched."""
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from reverse_catalog import TARGETS, OPS, n
from longitudinal_devices import IDS
from process_presets import recipe as process_recipe
catalog=json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))
for spec in catalog['examples']:
    if spec['id']=='photo-lithography':
        next(f for f in spec['fields'] if f['key']=='pattern')['options']=['Central','Double','Triple','Repeat']
    if spec['id']=='bosch':
        count=int(next(f for f in spec['fields'] if f['key']=='cycles')['default'])
        spec['flow']=['초기 트렌치 식각']+[f'{i+1}회 · {label}' for i in range(count) for label in ['보호막 형성','바닥 개방','식각·보호막 제거']]
    if spec['id'] in ('lele','sadp'):
        params={f['key']:f['default'] for f in spec['fields']}
        spec.update(mode='physics',model='Native sequential process',flow=[s['label'] for s in process_recipe(spec['id'],params)],note='PR 패턴, 막별 식각, 마스크 제거를 순서대로 계산합니다. 반복 패턴은 삼중·이중 마스크로 만들며 10 nm 격자의 학습 모델입니다. 광학 노광·장비 보정은 포함하지 않습니다.')
    if spec['id'] not in IDS:continue
    t=next(t for t in TARGETS if t['id']==spec['id'])
    fields=[n('length','게이트 길이',.32,.26,.40,'µm',.01)]
    if spec['id']=='finfet':
        fields += [n('depth','Fin 격리 식각 깊이',.20,.15,.25,'µm',.01),n('oxide','HfO₂ 성장량',.02,.015,.025,'µm',.005),n('gate','TiN 성장량',.08,.06,.10,'µm',.01)]
    if spec['id'] in ('gaafet','cfet'):
        fields += [n('channel','Si 채널 두께',.06,.04,.08,'µm',.01)]
    if spec['id']=='mbcfet':
        fields += [n('sheets','Si 채널 수',3,2,4,'층',1),n('thickness','Si 채널 두께',.04,.03,.05,'µm',.005),n('gap','SiGe 간격',.06,.05,.07,'µm',.01)]
    if spec['id']=='cfet':fields += [n('isolation','층간 SiO₂ 두께',.10,.08,.14,'µm',.01)]
    fields += [n('sd_dose','S/D 주입량',1e13,1e12,1e14,'ions/cm²',1e12),n('sd_anneal','950 °C 활성화 시간',5,1,20,'s',1)]
    descriptions={'length':'길이 방향 게이트 PR의 폭입니다. 식각에 따라 실제 게이트 길이가 달라질 수 있습니다.','depth':'Fin 양 끝 격리부의 식각 깊이입니다.','oxide':'HfO₂ 등각 성장량입니다.','gate':'TiN 명목 성장량입니다.','channel':'S/D 지지부를 잇는 Si 채널의 성장량입니다.','sheets':'S/D에 연결된 수평 Si 채널의 수입니다.','thickness':'적층 Si 채널 하나의 성장량입니다.','gap':'채널 사이에서 제거할 SiGe 성장량입니다.','isolation':'상하 트랜지스터 사이 SiO₂ 성장량입니다.','sd_dose':'노출된 S/D Si에 주입할 dose입니다.','sd_anneal':'950 °C에서 확산·활성화하는 시간입니다.'}
    if spec['id']=='mbcfet':descriptions['sd_dose']='30·100·200 keV에 균등 분할하는 총 S/D 주입량입니다. 각 시트 높이에 도핑이 분포하도록 계산합니다.'
    for f in fields:f['description']=descriptions[f['key']]
    spec.update(fields=fields,note=t['assumptions'],description=t['section'],section=t['section'],flow=[s.get('label',s['op']) for s in t['recipe']])
(ROOT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'reverse-catalog.json').write_text(json.dumps(dict(operations=OPS,targets=TARGETS),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print({t['id']:len(t['recipe']) for t in TARGETS if t['id'] in IDS})
