"""Bounded, sequential ViennaPS learning recipes. No uploaded image is executed."""
import json, sys, time, math
from pathlib import Path
import viennaps as ps
import viennals as ls
from engine import contour_mesh

MATERIALS={k:k for k in ['Si','SiO2','Si3N4','PolySi','HfO2','TiN','Dielectric','Metal','Mask']}
def num(key,label,default,low,high,unit='µm',step=.01):
    return dict(key=key,label=label,default=default,min=low,max=high,unit=unit,step=step)
def choice(key,label,values,default):return dict(key=key,label=label,options=values,default=default)
mat=lambda default='SiO2':choice('material','재료',list(MATERIALS),default)
OPS=[
 dict(id='coat',title='증착 · 지정 두께',group='Deposition',note='ViennaPS SphereDistribution · 이상적인 conformal 기하 증착. 실제 CVD/ALD 반응을 뜻하지 않습니다.',fields=[mat(),num('thickness','막 두께',.03,.02,.3)]),
 dict(id='cvd',title='CVD · 단일 입자',group='Deposition',note='SingleParticleProcess · 부착 확률과 입자 도달량으로 계산합니다. 특정 전구체의 보정 모델은 아닙니다.',fields=[mat(),num('rate','증착률',.05,.01,.15,'µm/s'),num('time','시간',1,.1,3,'s',.1),num('sticking','부착 확률',.2,.05,1,'',.05)]),
 dict(id='fill',title='증착 · 평면 충전',group='Deposition',note='MakePlane · 지정 높이까지 채우는 기하 근사입니다.',fields=[mat('Dielectric'),num('height','충전 높이',.38,-.3,.8)]),
 dict(id='mask',title='포토 · 마스크 형성',group='Photo',note='지정 위치에 마스크를 만드는 기하 근사. 광학 노광·PR 화학 반응은 생략합니다.',fields=[choice('shape','패턴',['island','opening'],'island'),num('width','패턴 폭',.3,.08,.8),num('bottom','마스크 바닥 높이',0,-.5,.5),num('thickness','마스크 두께',.06,.03,.2)]),
 dict(id='pattern',title='포토/식각 · 상부막 패터닝',group='Photo',note='노광·현상을 풀지 않고 지정 재료를 중앙 패턴으로 남기는 Boolean 근사입니다.',fields=[mat('PolySi'),num('width','남길 폭',.3,.08,.8)]),
 dict(id='etch',title='식각 · 방향성/등방성',group='Etch',note='DirectionalProcess · 선택한 재료에 유효 속도를 적용하고 다른 재료는 보호합니다.',fields=[mat('Si'),num('time','식각 시간',.35,.01,3,'s'),num('rate','방향성 식각률',1,0,1,'µm/s',.05),num('iso','등방성 식각률',0,0,.3,'µm/s')]),
 dict(id='wet',title='습식 식각 · 결정 의존',group='Etch',note='WetEtching · Si(100) 좌표계와 면별 식각률을 사용합니다. 약액 농도·온도를 속도로 자동 환산하지 않습니다.',fields=[num('time','식각 시간',10,1,30,'s',1),num('r100','(100) 식각률',.013,.001,.05,'µm/s',.001),num('r110','(110) 식각률',.024,.001,.05,'µm/s',.001),num('r111','(111) 식각률',.001,.0001,.01,'µm/s',.0001),num('r311','(311) 식각률',.024,.001,.05,'µm/s',.001)]),
 dict(id='oxidation',title='산화 · Wet / Dry',group='Oxidation',note='Oxidation · Si + SiO2가 필요합니다. 미리 얇은 SiO2 seed를 형성하세요. 다른 상부 재료가 있는 복잡한 조합은 이 데모에서 제한합니다.',fields=[choice('oxidant','산화종',['Wet','Dry'],'Wet'),num('temperature','온도',1000,950,1100,'°C',25),num('time','산화 시간',.03,.01,.06,'h'),num('pressure','압력',1,.5,2,'atm',.1)]),
 dict(id='strip',title='클리닝 · 재료 제거',group='Cleaning',note='지정 재료를 완전히 제거하는 기하 근사. 세정 화학·오염 제거율은 계산하지 않습니다.',fields=[choice('material','제거 재료',[k for k in MATERIALS if k!='Si'],'Mask')]),
 dict(id='cmp',title='CMP · 목표 높이',group='CMP',note='Planarize · 목표 높이 위를 제거합니다. 슬러리·압력·dishing 해석은 아닙니다.',fields=[num('height','평탄화 높이',0,-.3,.8)]),
 dict(id='cut',title='접촉 개구 · 두 개의 창',group='Photo',note='지정한 두 창에서 Si 위의 재료를 제거합니다. Boolean 형상 근사입니다.',fields=[num('center','중심에서의 거리',.515,.2,.65),num('width','개구 폭',.09,.04,.15)]),
 dict(id='contact',title='접촉부 · 금속 채움',group='Deposition',note='두 지정 위치에 금속 형상을 삽입합니다. 빈 개구가 필요하며 도핑은 포함하지 않습니다.',fields=[num('center','중심에서의 거리',.515,.2,.65),num('width','접촉 폭',.09,.04,.15),num('height','접촉 높이',.33,.1,.6)]),
]
BY_OP={o['id']:o for o in OPS}
def step(op,**p):return dict(op=op,params=p)
TARGETS=[
 dict(id='mosfet',title='MOSFET · 게이트와 접촉',width=1.6,bounds=[-.8,.8,-.25,.5],note='평면 MOSFET 교육용 모듈. 도핑과 전기 성능은 생략합니다.',recipe=[step('coat',material='SiO2',thickness=.03),step('fill',material='PolySi',height=.28),step('pattern',material='PolySi',width=.3),step('coat',material='Si3N4',thickness=.06),step('etch',material='Si3N4',rate=1,iso=0,time=.075),step('fill',material='Dielectric',height=.38),step('cmp',height=.33),step('cut',center=.515,width=.09),step('contact',center=.515,width=.09,height=.33)]),
 dict(id='finfet',title='FinFET · 게이트 중앙 횡단면',width=.9,bounds=[-.45,.45,-.45,.25],note='S/D는 단면 밖에 있습니다. high-k와 게이트가 fin을 감싸는 형상을 비교하세요.',recipe=[step('mask',shape='island',width=.12,bottom=0,thickness=.06),step('etch',material='Si',rate=1,iso=0,time=.35),step('strip',material='Mask'),step('fill',material='SiO2',height=.05),step('cmp',height=0),step('etch',material='SiO2',rate=1,iso=0,time=.21),step('coat',material='HfO2',thickness=.02),step('coat',material='TiN',thickness=.1)]),
 dict(id='trench',title='Trench · 마스크와 선택 식각',width=1.6,bounds=[-.8,.8,-.6,.25],note='마스크 개구를 통해 Si를 식각하고 마스크를 제거하는 기초 챌린지입니다.',recipe=[step('mask',shape='opening',width=.3,bottom=0,thickness=.08),step('etch',material='Si',rate=.5,iso=.02,time=.8),step('strip',material='Mask')]),
]
BY_TARGET={t['id']:t for t in TARGETS}

def validate(data):
    if not isinstance(data,dict) or data.get('target') not in BY_TARGET:raise ValueError('지원하는 목표를 선택하세요.')
    rows=data.get('steps',[])
    if not isinstance(rows,list) or len(rows)>16:raise ValueError('공정은 최대 16개입니다.')
    clean=[]
    for i,row in enumerate(rows):
        if not isinstance(row,dict) or row.get('op') not in BY_OP:raise ValueError(f'{i+1}단계 공정이 올바르지 않습니다.')
        op=BY_OP[row['op']];given=row.get('params',{});p={}
        if not isinstance(given,dict) or set(given)-{f['key'] for f in op['fields']}:raise ValueError('지원하지 않는 파라미터입니다.')
        for f in op['fields']:
            v=given.get(f['key'],f['default'])
            if 'options' in f:
                if v not in f['options']:raise ValueError(f"{f['label']}: 지원하지 않는 값입니다.")
            elif isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not f['min']<=v<=f['max']:raise ValueError(f"{f['label']}: {f['min']}~{f['max']} 범위를 확인하세요.")
            p[f['key']]=v
        clean.append(dict(op=row['op'],params=p))
    return BY_TARGET[data['target']],clean

def run(data):
    target,steps=validate(data);started=time.perf_counter()
    ps.setDimension(2);ls.setDimension(2);ps.setNumThreads(2);ps.Length.setUnit('um');ps.Time.setUnit('s');ps.Logger.setLogLevel(ps.LogLevel.ERROR)
    d=ps.Domain(gridDelta=.01,xExtent=target['width'],yExtent=2.);ps.MakePlane(d,0.,ps.Material.Si).apply();frames=[]
    def box(x0,y0,x1,y1):
        v=ls.Domain(d.getGrid());ls.MakeGeometry(v,ls.Box([x0,y0],[x1,y1])).apply();return v
    def add(v,m):d.insertNextLevelSetAsMaterial(v,m,True)
    def advance(model,t,particles=False,stencil=False):
        proc=ps.Process(d,model,t)
        if particles:
            rp=ps.RayTracingParameters();rp.raysPerPoint=80;proc.setParameters(rp)
        if stencil:
            ap=ps.AdvectionParameters();ap.spatialScheme=ps.SpatialScheme.STENCIL_LOCAL_LAX_FRIEDRICHS_1ST_ORDER;proc.setParameters(ap)
        proc.apply()
    def snap(label):
        polygons=[]
        for m in sorted(d.getMaterialsInDomain(),key=int):
            level=d.getMaterialLevelSet(m);mesh=ls.Mesh();convert=ls.ToHullMesh(mesh,level);convert.setBottomExtension(3);convert.apply();polygons+=contour_mesh(mesh,int(m),True)
        if not polygons or any(not p['closed'] for p in polygons):raise ValueError('이 조건에서 안정적인 닫힌 경계를 얻지 못했습니다. 조건을 줄여 주세요.')
        pts=d.getSurfaceMesh(False).getNodes()
        frames.append(dict(label=label,polygons=polygons,lowest=min((p[1] for p in pts),default=0),highest=max((p[1] for p in pts),default=0)))
    snap('Si 초기 기판');failure=None
    for idx,row in enumerate(steps):
        try:
            op=row['op'];p=row['params'];materials=d.getMaterialsInDomain();m=getattr(ps.Material,p['material']) if 'material' in p else None
            if op in ('etch','pattern','strip') and m not in materials:raise ValueError(f"{p['material']} 재료가 구조에 없습니다.")
            if op in ('coat','cvd'):
                if m in materials:raise ValueError('같은 재료의 추가 증착은 앞선 증착 두께/시간을 수정하세요. 이 데모는 중복 재료층을 제한합니다.')
                d.duplicateTopLevelSet(m)
                if op=='coat':advance(ps.SphereDistribution(radius=p['thickness']),0)
                else:advance(ps.SingleParticleProcess(rate=p['rate'],stickingProbability=p['sticking'],sourceExponent=1.),p['time'],True)
            elif op=='fill':
                if m in materials:raise ValueError('이미 존재하는 재료의 충전은 앞선 단계를 수정하세요.')
                ps.MakePlane(d,p['height'],m,True).apply()
            elif op=='mask':
                if ps.Material.Mask in materials:raise ValueError('기존 마스크를 먼저 제거하세요.')
                w=p['width']/2;bottom=p['bottom']-.001;top=p['bottom']+p['thickness'];half=target['width']/2
                if p['shape']=='island':add(box(-w,bottom,w,top),ps.Material.Mask)
                else:
                    add(box(-half,bottom,-w,top),ps.Material.Mask);add(box(w,bottom,half,top),ps.Material.Mask)
            elif op=='pattern':
                if m==ps.Material.Si:raise ValueError('Si 패터닝은 마스크 + 식각을 사용하세요.')
                if d.getMaterialMap().getMaterialAtIdx(d.getNumberOfLevelSets()-1)!=m:raise ValueError('상부에 노출된 막만 직접 패터닝할 수 있습니다.')
                v=d.getMaterialLevelSet(m);ls.BooleanOperation(v,box(-p['width']/2,-2,p['width']/2,2),ls.BooleanOperationEnum.INTERSECT).apply();d.removeMaterial(m);add(v,m)
            elif op=='etch':
                masks=[a for a in materials if a!=m]
                advance(ps.DirectionalProcess(direction=[0.,-1.,0.],directionalVelocity=-p['rate'],isotropicVelocity=-p['iso'],maskMaterial=masks),p['time'])
            elif op=='wet':advance(ps.WetEtching(direction100=[1.,0.,0.],direction010=[0.,1.,0.],rate100=p['r100'],rate110=p['r110'],rate111=p['r111'],rate311=p['r311'],materialRates=[(ps.Material.Si,-1.)]),p['time'],stencil=True)
            elif op=='oxidation':
                if ps.Material.SiO2 not in materials or any(a not in (ps.Material.Si,ps.Material.SiO2) for a in materials):raise ValueError('이 모드는 Si + SiO2 구조에서 실행하세요. 얇은 SiO2 seed를 먼저 추가하세요.')
                model=ps.Oxidation();model.setTemperature(p['temperature']);model.setPressure(p['pressure']);model.setTime(p['time']);model.setTimeStep(p['time']/3);model.setOxidant(getattr(ps.OxidantType,p['oxidant']));model.setOrientation(ps.SiliconOrientation.Si100);model.setMaxGridPoints(150000);advance(model,0)
            elif op=='strip':d.removeMaterial(m)
            elif op=='cmp':ps.Planarize(d,p['height']).apply()
            elif op=='cut':
                for center in (-p['center'],p['center']):
                    window=box(center-p['width']/2,0.,center+p['width']/2,2.)
                    for i,v in enumerate(d.getLevelSets()):
                        if d.getMaterialMap().getMaterialAtIdx(i)!=ps.Material.Si:ls.BooleanOperation(v,window,ls.BooleanOperationEnum.RELATIVE_COMPLEMENT).apply()
            elif op=='contact':
                for center in (-p['center'],p['center']):add(box(center-p['width']/2,0.,center+p['width']/2,p['height']),ps.Material.Metal)
            snap(BY_OP[op]['title'])
        except (ValueError,RuntimeError) as e:
            failure=dict(step=idx+1,message=str(e));break
    return dict(target=target['id'],frames=frames,steps=steps,bounds=target['bounds'],unit='µm',elapsed=round(time.perf_counter()-started,3),failure=failure,engine='ViennaPS 4.6.2',note='목표 예제 대비 기하 비교입니다. SEM 재료 판독·도핑·전기 특성은 포함하지 않습니다.')

if __name__=='__main__':
    data=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'));result=run(data);Path(sys.argv[2]).write_text(json.dumps(result,ensure_ascii=False,allow_nan=False),encoding='utf-8')
