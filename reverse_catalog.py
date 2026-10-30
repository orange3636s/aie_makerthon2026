"""Reverse-design operations. Every geometric/numerical parameter maps to a native API."""
import math

def n(key,label,default,lo,hi,unit='',step=.01,when=None):
    d=dict(key=key,label=label,default=default,min=lo,max=hi,unit=unit,step=step)
    if when:d['when']=when
    return d
def choice(key,label,options,default,when=None):
    d=dict(key=key,label=label,options=options,default=default)
    if when:d['when']=when
    return d
MATERIALS=['Si','PolySi','SiO2','Si3N4','SiGe','Al2O3','HfO2','HfZrO2','TiN','W','Co','Mo','Al','Cu','Ti','Metal','Dielectric']
OPS=[
 dict(id='photo',title='Photo',model='PR coating / mask geometry / timed vertical development',fields=[
  choice('action','작업',['Coat','Patterning','Develop','Strip','Pattern'],'Coat'),
  choice('pattern','마스크',['Central','Double','Triple','Repeat'],'Central',{'action':['Pattern','Patterning']}),
  choice('tone','PR 극성',['Positive','Negative'],'Positive',{'action':['Pattern','Coat']}),
  n('width','패턴 폭',.3,.06,1.,'µm',.01,{'action':['Pattern','Patterning']}),
  n('pitch','패턴 간격',.6,.15,1.,'µm',.01,{'action':['Pattern','Patterning'],'pattern':['Double','Triple','Repeat']}),
  n('offset','정렬 위치',0,-.4,.4,'µm',.01,{'action':['Pattern','Patterning']}),
  n('thickness','PR 두께',.06,.03,.15,'µm',.01,{'action':['Coat']}),
  n('develop_time','현상 시간',60,1,180,'s',1,{'action':['Develop']})],
  note='노광 창: Central은 중앙 1개, Double은 ±pitch/2, Triple은 −pitch·0·+pitch, Repeat는 pitch 간격입니다. Positive PR은 창에서 제거되고 Negative PR은 창에 남습니다. PR coating → Patterning → Developing → PR strip을 분리합니다. Developing은 1 nm/s의 일정 수직 제거 모델이며 광학 노광·현상 화학은 계산하지 않습니다.'),
 dict(id='etch',title='Etch',model='DirectionalProcess / material-selective geometric etch',fields=[
  choice('material','식각 재료',MATERIALS,'Si'),
  choice('method','방식',['Isotropic','Directional','ALE','Pattern transfer','Selective removal'],'Directional'),
  n('rate','식각률',.15,.005,.5,'µm/s',.005,{'method':['Directional','Isotropic','Pattern transfer']}),
  n('time','식각 시간',1.,.05,8.,'s',.05,{'method':['Directional','Isotropic','Pattern transfer']}),
  n('isotropic','등방성 비율',1.,0,1,'',.05,{'method':['Directional']}),
  choice('access','식각 접근면',['Exposed','Section sides'],'Exposed',{'method':['Isotropic']}),
  n('cycles','ALE 사이클',100,1,500,'cycle',1,{'method':['ALE']}),
  n('epc','사이클당 제거량',.0002,.00005,.002,'µm/cycle',.00005,{'method':['ALE']})],
  note='ALE는 EPC×사이클 수를 native DirectionalProcess로 적분한 유효 제거량 모델입니다. 개별 반응·흡착·퍼지나 재료별 EPC는 예측하지 않습니다. 10 nm 격자이므로 원자층 정확도는 아닙니다. DirectionalProcess의 directionalVelocity=−rate×(1−비율), isotropicVelocity=−rate×비율. 다른 재료는 maskMaterial로 보호합니다. Pattern transfer는 PR 수직 투영 외부를 깊이 rate×time만큼 자르는 Boolean 기하 모델입니다. Selective removal은 선택 재료의 전체 제거로, 반응 속도 모델이 아닙니다.'),
 dict(id='deposition',title='Deposition',model='SingleParticleProcess / SingleParticleALD',fields=[
  choice('method','증착 조건 프리셋',['PVD','CVD','ALD','Conformal'],'CVD'),choice('material','재료',MATERIALS,'SiO2'),
  n('rate','평면 증착률',.08,.005,.3,'µm/s',.005,{'method':['PVD','CVD','Conformal']}),
  n('time','증착 시간',1.,.1,8.,'s',.1,{'method':['PVD','CVD','Conformal']}),
  n('sticking','부착 확률',.2,.01,1.,'',.01,{'method':['PVD','CVD']}),
  n('exponent','입사 방향성 지수',1.,0,40,'',1,{'method':['PVD','CVD']}),
  n('cycles','ALD 사이클',30,5,120,'cycle',1,{'method':['ALD']}),
  n('gpc','사이클당 성장량',.001,.0005,.003,'µm/cycle',.0005,{'method':['ALD']}),
  n('pulse','전구체 펄스 시간',.1,.05,.5,'s',.05,{'method':['ALD']}),
  n('ald_sticking','초기 부착 확률',.00005,.00001,.001,'',.00001,{'method':['ALD']})],
  presets={'PVD':dict(sticking=1.,exponent=20.),'CVD':dict(sticking=.2,exponent=1.)},
  note='PVD/CVD는 공통 SingleParticleProcess의 조건 프리셋입니다. 모든 수치가 같으면 결과도 같습니다. PVD 기본값: sticking=1, sourceExponent=20; CVD: 0.2, 1. Step coverage는 계산된 막 형상에서 측정합니다. ALD는 SingleParticleALD; incomingFlux=2e6, s0=3.36, evaporationFlux=2.5, 무한 평균자유행로를 고정합니다. Conformal은 반경 rate×time의 등방 offset으로 성장시키는 기하 모델이며 단면 밖에서 재료가 공급된다고 가정합니다. 특정 전구체/장비에 보정되지 않았습니다.'),
 dict(id='diffusion',title='Diffusion',model='IonImplantation / Anneal / Oxidation',fields=[
  choice('method','공정',['Ion implantation','Pre-deposition','Drive-in','Anneal','Wet oxidation','Dry oxidation'],'Ion implantation'),
  choice('species','도펀트',['P','B'],'P',{'method':['Ion implantation','Pre-deposition']}),
  choice('energy','주입 에너지 (keV)',[8,10,30,50,100,130,200],30,{'method':['Ion implantation']}),
  n('dose','주입량',1e13,1e11,1e15,'ions/cm²',1e12,{'method':['Ion implantation']}),
  choice('implant_mask','주입 마스크',['Existing','Central','Double','Triple','Repeat'],'Existing',{'method':['Ion implantation']}),
  n('implant_width','개구 폭',.3,.06,1.,'µm',.01,{'method':['Ion implantation'],'implant_mask':['Central','Double','Triple','Repeat']}),
  n('implant_pitch','개구 간격',.6,.15,1.,'µm',.01,{'method':['Ion implantation'],'implant_mask':['Double','Triple','Repeat']}),
  n('implant_offset','정렬 위치',0,-.4,.4,'µm',.01,{'method':['Ion implantation'],'implant_mask':['Central','Double','Triple','Repeat']}),
  n('temperature','온도',1000,950,1100,'°C',25,{'method':['Anneal','Pre-deposition','Drive-in','Wet oxidation','Dry oxidation']}),
  n('time','열처리 시간',30,1,120,'s',1,{'method':['Anneal']}),
  n('surface_concentration','표면 공급 농도',1e20,1e17,1e21,'cm⁻³',1e19,{'method':['Pre-deposition']}),
  n('diffusion_time','확산 시간',600,60,3600,'s',60,{'method':['Pre-deposition','Drive-in']}),
  n('oxidation_time','산화 시간',.03,.01,1.5,'h',.01,{'method':['Wet oxidation','Dry oxidation']})],
  note='이온 주입은 B/P dual-Pearson IV, 입사각 7°. Pre-deposition은 외부 공기에 연결된 Si 표면에서 고용도로 제한한 농도를 공급합니다. Drive-in은 공급 없이 총량을 보존합니다. FiPy 2D 확산·평형 활성화이며 다른 재료는 완전 차단합니다. Anneal과 열산화는 기존 native 모델입니다. 결함/TED·전기 특성은 제외합니다.'),
 dict(id='cmp',title='C&C',model='Timed Planarize',fields=[
  n('rate','제거율',.01,.0001,.05,'µm/s',.0001),
  n('time','제거 시간',120,1,300,'s',1),
  choice('slurry','Slurry',['Unspecified','Ceria oxide','Silica oxide','Silica silicon','Silica polysilicon','Silica nitride','Silica SiGe','Silica tungsten','Cobalt formulated','Silica molybdenum','Silica TiN','Silica hafnia','Unverified alumina','Unverified HZO'],'Unspecified')],note='제거 평면=max(마지막 증착 전 최고점, 현재 최고점−제거율×시간). Slurry는 기록용이며 계산에 반영하지 않습니다. 선택비·dishing·압력·패드 모델은 없습니다.')
]
from recipe_schema import extend
extend(OPS,n,choice)
BY_OP={o['id']:o for o in OPS}
def step(op,**params):return dict(op=op,params=params)
def dep(material,thickness,method='CVD'):
    return step('deposition',material=material,method=method,rate=.08,time=round(thickness/.08,12),sticking=1. if method=='PVD' else .15,exponent=30 if method=='PVD' else 1.)
def ald(material,thickness):return step('deposition',method='ALD',material=material,cycles=round(thickness/.001),gpc=.001,pulse=.1,ald_sticking=.00005)
def photo(width,tone='Negative',pattern='Central',pitch=.6):return step('photo',action='Pattern',width=width,tone=tone,pattern=pattern,pitch=pitch)
def etch(material,depth,ratio=0):return step('etch',material=material,rate=.1,time=round(depth/.1,4),isotropic=ratio)
strip=lambda:step('photo',action='Strip')
remove=lambda m:step('etch',material=m,method='Selective removal')
fin_base=[photo(.14),etch('Si',.35),strip(),dep('SiO2',.4),step('cmp'),etch('SiO2',.22)]
TARGETS=[
dict(id='mosfet',title='MOSFET',width=1.6,bounds=[-.8,.8,-.45,.48],roi=[-.72,.72,-.18,.42],section='채널 길이 방향 단면',recipe=[
 ald('SiO2',.025),dep('PolySi',.15,'PVD'),photo(.30),etch('PolySi',.18),strip(),etch('SiO2',.035),
 step('diffusion',method='Ion implantation',species='P',energy=30,dose=1e13),step('diffusion',method='Anneal',temperature=1000,time=30),
 ald('Si3N4',.04),etch('Si3N4',.045),dep('Dielectric',.23),step('cmp'),photo(.38,'Positive','Double',1.),etch('Dielectric',.3),strip(),dep('Metal',.3),step('cmp')]),
dict(id='finfet',title='FINFET',width=1.2,bounds=[-.6,.6,-.48,.2],roi=[-.36,.36,-.30,.16],section='게이트 중심 횡단면',recipe=fin_base+[ald('HfO2',.02),ald('TiN',.08)]),
dict(id='mbcfet',title='MBCFET',width=1.2,bounds=[-.6,.6,-.25,.5],roi=[-.35,.35,-.05,.45],section='Gate-all-around 중심 횡단면',recipe=[
 dep('SiGe',.05,'PVD'),dep('Si',.035,'PVD'),dep('SiGe',.05,'PVD'),dep('Si',.035,'PVD'),dep('SiGe',.05,'PVD'),dep('Si',.035,'PVD'),
 photo(.24),etch('Si',.04),etch('SiGe',.06),etch('Si',.04),etch('SiGe',.06),etch('Si',.04),etch('SiGe',.06),strip(),
 dep('SiO2',.25),step('cmp'),etch('SiO2',.27),remove('SiGe'),ald('HfO2',.015),ald('TiN',.04)]),
dict(id='sti',title='STI',width=1.6,bounds=[-.8,.8,-.55,.25],roi=[-.55,.55,-.45,.2],section='격리 트렌치 단면',recipe=[
 ald('SiO2',.025),ald('Si3N4',.07),photo(.6,'Positive'),etch('Si3N4',.09),etch('SiO2',.035),etch('Si',.22,.05),strip(),
 dep('SiO2',.5),step('cmp'),remove('Si3N4')]),
dict(id='fin',title='Fin',width=1.2,bounds=[-.6,.6,-.48,.15],roi=[-.4,.4,-.4,.1],section='Fin 횡단면',recipe=fin_base),
dict(id='locos',title='LOCOS',width=1.6,bounds=[-.8,.8,-.3,.35],roi=[-.72,.72,-.18,.3],section='선택 산화 단면',recipe=[
 ald('SiO2',.025),ald('Si3N4',.075),photo(.38,'Negative','Double',.8),etch('Si3N4',.09),strip(),step('diffusion',method='Wet oxidation',temperature=1000,oxidation_time=.8),remove('Si3N4')])
]
from advanced_devices import targets as advanced_targets
TARGETS.extend(advanced_targets())
from contact_modules import contacts
from longitudinal_devices import IDS as LONGITUDINAL_IDS, configure as configure_longitudinal
for t in TARGETS:
    if t['id']=='mosfet':
        t['recipe']=t['recipe'][:10]+contacts()
        t['recipe'][6]['label']='Source / drain implant · P'
        t['recipe'][7]['label']='Dopant activation'
    if t['id'] in LONGITUDINAL_IDS:
        configure_longitudinal(t)
DEVICE_ORDER=('pn-junction','mosfet','fdsoi','pdsoi','rcat','bcat','finfet','gaafet','mbcfet','charge-trap','cfet')
TARGETS.sort(key=lambda target: (target['id'] in DEVICE_ORDER, DEVICE_ORDER.index(target['id']) if target['id'] in DEVICE_ORDER else 0))
for target in TARGETS:
    species=sorted({s['params'].get('species','P') for s in target['recipe'] if s['op']=='diffusion' and s['params'].get('method')=='Ion implantation'})
    if species:
        # Educational similarity weights, not a device-performance prediction.
        target['assessment']=dict(version=2,species=species,requireAnneal=True,
            weights=dict(geometry=.2,total=.35,active=.35,process=.1) if target.get('grading')=='doping' else dict(geometry=.5,total=.2,active=.2,process=.1))
from process_presets import targets as process_targets
TARGETS.extend(process_targets())
from library_layout import organize
organize(TARGETS)
from structure_recipes import targets as extra_targets, modernize
import copy,json
from pathlib import Path
TARGETS.extend(extra_targets(json.loads((Path(__file__).parent/'catalog.json').read_text(encoding='utf-8'))['examples']))
SOURCE_RECIPES={t['id']:copy.deepcopy(t['recipe']) for t in TARGETS}
from process_timing import retime
for t in TARGETS:
    t['recipe']=retime(modernize(t['recipe']))
    for section in t.get('sections',{}).values():
        if 'recipe' in section:section['recipe']=retime(modernize(section['recipe']))
BY_TARGET={t['id']:t for t in TARGETS}

def validate(data):
    if not isinstance(data,dict) or data.get('target') not in BY_TARGET:raise ValueError('목표 예제를 선택하세요.')
    rows=data.get('steps',[])
    if not isinstance(rows,list) or len(rows)>96:raise ValueError('공정은 최대 96단계입니다.')
    clean=[]
    for row in rows:
        if not isinstance(row,dict) or row.get('op') not in BY_OP:raise ValueError('지원하지 않는 공정입니다.')
        op=BY_OP[row['op']];given=row.get('params',{})
        if row['op']=='photo' and isinstance(given,dict) and 'action' not in given:given={**given,'action':'Pattern'}
        if not isinstance(given,dict) or set(given)-{f['key'] for f in op['fields']}:raise ValueError('지원하지 않는 조건입니다.')
        params={}
        for f in op['fields']:
            preset=op.get('presets',{}).get(given.get('method','CVD'),{})
            v=given.get(f['key'],preset.get(f['key'],f['default']))
            if 'options' in f:
                if v not in f['options']:raise ValueError(f['label']+': 지원하지 않는 값입니다.')
            elif isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not f['min']<=v<=f['max']:raise ValueError(f['label']+': 범위를 확인하세요.')
            if f['key']=='cycles' and v!=int(v):raise ValueError('사이클은 정수여야 합니다.')
            params[f['key']]=v
        label=row.get('label','')
        if not isinstance(label,str) or len(label)>80:raise ValueError('공정 이름은 80자 이내입니다.')
        clean.append(dict(op=row['op'],params=params,**({'label':label} if label else {})))
    target=BY_TARGET[data['target']]
    view=data.get('view','gate')
    if view!='gate':
        if view not in target.get('sections',{}):raise ValueError('지원하지 않는 단면입니다.')
        target=dict(target,**target['sections'][view],view=view)
    if 'wafer' in data:
        w=data['wafer'];limits={'fdsoi':(.03,.06),'pdsoi':(.12,.22)}
        if target['id'] not in limits or not isinstance(w,dict) or set(w)!={'body','box'}:raise ValueError('지원하지 않는 웨이퍼입니다.')
        lo,hi=limits[target['id']]
        if isinstance(w['body'],bool) or not isinstance(w['body'],(int,float)) or not lo<=w['body']<=hi or w['box']!=.15:raise ValueError('SOI 두께 범위를 확인하세요.')
        target=dict(target,wafer=w)
    if 'substrateThickness' in data:
        depth=data['substrateThickness']
        minimum=max(.1,sum(target.get('wafer',{}).get(k,0) for k in ('body','box'))+.05)
        if isinstance(depth,bool) or not isinstance(depth,(int,float)) or not math.isfinite(depth) or not minimum<=depth<=1.2:
            raise ValueError(f'기판 두께: {minimum*1000:g}–1200 nm 범위를 확인하세요.')
        target=dict(target,substrateThickness=depth)
    if 'substrateRoughness' in data:
        rq=data['substrateRoughness']
        maximum=min(.02,target.get('wafer',{}).get('body',.08)/4)
        if isinstance(rq,bool) or not isinstance(rq,(int,float)) or not math.isfinite(rq) or not 0<=rq<=maximum:
            raise ValueError(f'표면 거칠기 Rq: 0–{maximum*1000:g} nm 범위를 확인하세요.')
        target=dict(target,substrateRoughness=rq)
    return target,clean
