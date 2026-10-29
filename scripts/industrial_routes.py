"""Public process-module adaptations; never vendor-qualified recipes."""
import copy,json,hashlib
from difflib import SequenceMatcher
from pathlib import Path
from reverse_catalog import step,validate
ROOT=Path(__file__).resolve().parents[1]
SOURCES={
'mask':('Michigan LNF: oxide hardmask pattern transfer','https://lnf-wiki.eecs.umich.edu/wiki/LAM_9400/Processes'),
'gap':('Applied Materials: deposition/etch gapfill disclosure','https://uspto.report/patent/app/20060292894'),
'contact':('Lam Research: ALD nucleation + CVD tungsten fill','https://www.lamresearch.com/product/altus-product-family/'),
'liner':('Applied Materials: integrated liner/barrier','https://www.appliedmaterials.com/us/en/product-library/endura-ilb-pvd-ald.html'),
'ale':('Oxford Instruments: atomic-scale processing','https://plasma.oxinst.com/technologies/atomic-scale-processing'),
'drie':('Oxford Instruments: DRIE processes','https://plasma.oxinst.com/products/dsie/'),
'locos':('TU Wien: LOCOS oxidation','https://www.iue.tuwien.ac.at/phd/filipovic/node77.html'),
'diff':('TU Wien: diffusion and dopant introduction','https://iue.tuwien.ac.at/phd/radi/node11.html'),
'spacer':('Applied Materials: conformal CVD spacer','https://ir.appliedmaterials.com/news-releases/news-release-details/applied-materials-releases-ace-oxide-spacer-system-enable/'),
'gaa':('Applied Materials: GAA integration','https://www.appliedmaterials.com/us/en/semiconductor/markets-and-inflections/advanced-logic/gaa.html'),
'cmp':('Applied Materials: etchback + buff CMP','https://ir.appliedmaterials.com/static-files/0b3c41c5-566d-4460-9e34-a01f09405c9c'),
'gate':('Intel: gate-first and replacement gate','https://www.intel.com/pressroom/kits/advancedtech/doodle/ref_strain/strain.htm'),
'depo':('Lam Research: deposition technologies','https://www.lamresearch.com/products/our-processes/deposition/')}
C=copy.deepcopy
def named(s,text):s['label']=text;return s
def thick(s):
 p=s['params'];return p['cycles']*p['gpc'] if p['method']=='ALD' else p['rate']*p['time']
def film(m,h,method='CVD'):
 if method=='ALD':
  n=max(5,min(120,round(h/.001)));return step('deposition',method=method,material=m,cycles=n,gpc=h/n,pulse=.1,ald_sticking=.00005)
 return step('deposition',method=method,material=m,rate=.08,time=h/.08,sticking=.15 if method=='CVD' else 1.,exponent=1. if method=='CVD' else 30.)
def cut(m,h,iso=0):return step('etch',method='Directional',material=m,rate=.1,time=h/.1,isotropic=iso)
def hardmask(base):
 a=C(base);i=next(i for i,s in enumerate(a) if s['op']=='photo' and s['params']['action']=='Coat');j=next(j for j in range(i,len(a)) if a[j]['op']=='photo' and a[j]['params']['action']=='Strip');d=next(k for k in range(i,j) if a[k]['op']=='photo' and a[k]['params']['action']=='Develop');target=next(s['params']['material'] for s in a[d+1:j] if s['op']=='etch');m='Si3N4' if target=='SiO2' else 'SiO2'
 a[i:j+1]=[named(film(m,.06),'Hardmask deposition · '+m),*a[i:d+1],named(cut(m,.075),'Hardmask opening'),a[j],*a[d+1:j],named(step('etch',method='Isotropic',material=m,rate=.1,time=.85),'Hardmask strip')];return a
def ded(base):
 a=C(base);i=next(i for i,s in enumerate(a) if s['op']=='deposition' and s['params']['material']=='SiO2' and thick(s)>.2);h=thick(a[i]);a[i:i+1]=[named(film('SiO2',h*.55),'Partial gap fill'),named(cut('SiO2',.04,.6),'Gap-mouth etchback'),named(film('SiO2',h*.45+.04),'Gap refill')];return a
def soft(base,materials=None):
 a=[]
 for s in C(base):
  p=s['params']
  if s['op']=='etch' and p['method']=='Directional' and (materials is None or p['material'] in materials) and p['rate']*p['time']>=.04:
   h=p['rate']*p['time'];f=min(.04,h*.25);p['time']=(h-f)/p['rate'];a.extend([named(s,'Bulk etch · '+p['material']),named(step('etch',method='ALE',material=p['material'],cycles=round(f/.0002),epc=.0002),'ALE finish · '+p['material'])])
  else:a.append(s)
 return a
def contacts(base,light=False):
 a=[]
 for s in C(base):
  if s['op']=='deposition' and 'contact fill' in s.get('label','').lower():
   a.extend(([named(film('TiN',.01,'PVD'),'Contact TiN barrier · PVD')] if light else [named(film('TiN',.01,'ALD'),'Contact TiN barrier · ALD'),named(film('W',.01,'ALD'),'W nucleation · ALD')])+[named(film('W',max(.03,thick(s)-(.01 if light else .02))),'W bulk fill · CVD')])
  else:a.append(s)
 return a
def thermal(base):
 a=C(base);i=next(i for i,s in enumerate(a) if s['op']=='deposition' and s['params']['material']=='SiO2');a[i]['label']='Initial oxide · seed';a.insert(i+1,named(step('diffusion',method='Dry oxidation',temperature=1000,oxidation_time=.08),'Thermal oxide · dry O2'))
 for s in a:
  if s['op']=='deposition' and s['params']['material']=='PolySi':s['params'].update(method='CVD',sticking=.15,exponent=1.);s['label']='Poly Si · CVD'
 return a
def furnace(base):
 a=[];i=0
 while i<len(base):
  s=base[i]
  if s['op']=='photo' and s['params']['action']=='Coat' and i+3<len(base) and base[i+3]['op']=='diffusion':
   p=base[i+3]['params'];a.extend([named(film('SiO2',.12),'Diffusion oxide mask'),*C(base[i:i+3]),named(cut('SiO2',.14),'Diffusion window'),named(step('photo',action='Strip'),'PR strip before furnace'),named(step('diffusion',method='Pre-deposition',species=p['species'],temperature=1000,diffusion_time=300,surface_concentration=1e19),'Constant-source diffusion · '+p['species']),named(step('diffusion',method='Drive-in',temperature=1000,diffusion_time=300),'Finite-source drive-in'),named(step('etch',material='SiO2',method='Isotropic',rate=.1,time=1.5),'Diffusion mask removal')]);i+=5
  elif s['op']=='diffusion' and s['params']['method']=='Anneal':i+=1
  else:a.append(C(s));i+=1
 return a
def generate(t):
 tid=t['id'];path=ROOT/'references'/(tid+'.json');base=json.loads(path.read_text(encoding='utf8'))['steps'];rows=[]
 def add(cid,name,steps,why,benefit,tradeoff,observe,refs,scope='공개 공정 모듈의 단면 근사이며 제조사 양산 레시피가 아닙니다.'):
  _,steps=validate(dict(target=tid,steps=steps));sig=lambda seq:[json.dumps([s['op'],s['params']],sort_keys=True) for s in seq]
  changes=[dict(kind=k,before=[i+1,j],after=[a+1,b]) for k,i,j,a,b in SequenceMatcher(a=sig(base),b=sig(steps),autojunk=False).get_opcodes() if k!='equal']
  rows.append(dict(id=cid,name=name,steps=steps,description=why,benefit=benefit,tradeoff=tradeoff,observe=observe,scope=scope+' 입력 수치는 교육용이며 출처의 장비 조건이 아닙니다.',sources=[dict(title=SOURCES[k][0],url=SOURCES[k][1]) for k in refs],changes=changes))
 add('reference','기존 교육 기준',C(base),'현재 목표 단면을 만드는 기준 조건입니다.','동일 목표의 비교 기준','일부 공정은 단면 수준으로 단순화','기준 재료·공정 순서',[])
 if tid=='mosfet':
  a=C(base);i=next(i for i,s in enumerate(a) if s['op']=='diffusion');implant=a.pop(i);anneal=a.pop(i);j=next(j for j,s in enumerate(a) if s['op']=='deposition' and s['params']['material']=='Si3N4');extension=C(implant);extension['params'].update(energy=10,dose=implant['params']['dose']*.2);extension['label']='Shallow extension implant';implant['params']['dose']*=.8;a[j:j]=[extension];a[j+3:j+3]=[implant,anneal]
  add('extension','Extension → spacer → S/D',a,'단일 S/D 주입을 spacer 전후의 얕은 extension과 외측 접합으로 분리','게이트 가까운 영역과 외측 접합을 별도 제어','추가 주입·횡방향 겹침; 전기장·이동도 미계산','채널 근처 농도·접합 깊이',['gate','diff'])
 elif tid=='rcat':add('recess','Bulk recess + ALE finish',soft(base,['Si']),'Recess 마지막 제거량을 ALE로 분리한 뒤 gate fill','recess 벌크 식각과 끝점 제어 분리','ALE 전환·사이클 증가; 손상 감소는 미계산','recess 깊이·게이트 하부 형상',['ale'])
 elif tid=='charge-trap':add('layer-finish','ONO layer-by-layer ALE finish',soft(base,['SiO2','Si3N4']),'ONO의 각 식각층에 bulk 제거와 ALE 마무리를 배치','층별 잔류량·계면 보존 비교','단계 증가; 포획 전하·저장 특성 미계산','ONO 경계·주변 잔류막',['ale'])
 elif tid in ['fdsoi','pdsoi']:
  a=C(base);i=next(i for i,s in enumerate(a) if s['op']=='diffusion' and s['params']['method']=='Ion implantation');s=C(a[i]);s['params'].update(energy=10,dose=s['params']['dose']*.2);s['label']='Shallow extension implant';a[i]['params']['dose']*=.8;j=next(j for j,s0 in enumerate(a) if s0['op']=='deposition' and s0['params']['material']=='Si3N4');a.insert(j,s)
  add('extension','Extension → spacer → S/D',a,'Spacer 전에 얕은 extension 주입, 이후 주입으로 접합을 분리','게이트 가까운 영역과 외측 접합을 다르게 제어','추가 주입·횡방향 겹침; 이동도·전기장 미계산','채널 근처 농도·접합 깊이',['gate','diff'])
 elif tid=='pn-junction':add('furnace','마스크 확산 접합',furnace(base),'산화막 개구 → pre-deposition → drive-in으로 N/P 접합 형성','표면 공급형 확산과 주입형 분포 비교','추가 마스크·열처리; 앞서 형성한 접합도 재확산','접합 깊이·표면 농도·횡방향 확산',['diff'])
 elif tid=='bcat':add('recess','Bulk recess + ALE finish',soft(base,['Si']),'Si recess의 마지막 제거량을 ALE로 마무리','벌크 처리와 마무리 제어 분리','ALE 전환과 사이클 증가','recess 깊이·바닥 폭',['ale'],'ALE는 EPC 적분 근사입니다. DRAM 장비 화학·손상은 미계산입니다.')
 elif tid in ['finfet','gaafet','mbcfet','cfet']:
  a=C(base)
  for i,s in enumerate(a):
   if s['op']=='deposition' and ('wrap gate' in s.get('label','') or s['params']['material']=='HfO2'):a[i]=named(film(s['params']['material'],thick(s),'ALD'),'ALD wrap · '+s['params']['material'])
  add('wrap','ALD dielectric + wrap gate',a,'절연막과 게이트 전극을 모두 ALD로 피복','채널 측면·하부 피복 비교','개구 축소·핀치오프 및 사이클 증가','채널 사이 잔류 공간·막 두께',['gaa','depo'],'GAA/Fin 모듈의 교육용 근사입니다. 에피택시·일함수·CFET 본딩/저온 통합은 미계산입니다.')
 if tid in ['pn-junction','mosfet','fdsoi','pdsoi','rcat','bcat','finfet','gaafet','mbcfet','charge-trap','cfet']:
  light=tid in ['mbcfet','cfet']
  add('barrier','PVD TiN → CVD W' if light else 'TiN → ALD W → CVD W',contacts(base,light),'단일 충진을 barrier와 W 충진 모듈로 변경','라이너 공간 점유와 단계별 피복 비교','단계 증가·컨택 개구 축소','TiN/W 배치·컨택 중앙 빈 공간',['contact','liner'],'W contact 모듈의 교육용 재구성입니다. Co/Mo 기준은 W로 재설계하므로 재료 IoU가 낮아질 수 있습니다. 저항·핵생성 반응은 미계산입니다.')
 elif tid in ['sti','fin']:
  add('hardmask','Hardmask transfer',hardmask(base),'PR → 무기막 전사 → PR 제거 → 본체 식각','패턴 정의와 본체 식각 분리','추가 막·식각·제거','마스크 잔류·공정 순서',['mask'])
  add('gapfill','Dep–Etch–Dep gapfill',ded(base),'부분 충진 → 입구 etchback → 재충진 → CMP','입구 폐쇄 전 형상 재조정','추가 처리·주변 산화막 손실','갭 내부 공간·표면 높이',['gap'],'HDP gapfill 순서의 유효 수송 근사입니다. HDP 플라즈마는 미계산입니다.')
 elif tid=='locos':
  a=C(base);i=next(i for i,s in enumerate(a) if s['op']=='diffusion');a[i:i]=[named(cut('SiO2',.035),'Field pad oxide opening'),named(cut('Si',.08),'Field recess')]
  add('recess','Recessed field oxidation',a,'필드 영역의 pad oxide와 Si를 recess한 뒤 선택 산화','필드 산화막 돌출 완화 비교','추가 식각·활성영역 침범 가능성','산화막 상부 높이·Si 소비',['locos'],'Recess + LOCOS의 교육용 조합입니다. 응력·결정 결함은 미계산입니다.')
  b=C(base);i=next(i for i,s in enumerate(b) if s['op']=='diffusion');w=C(b[i]);w['params']['oxidation_time']*=.8;b[i:i+1]=[named(step('diffusion',method='Dry oxidation',temperature=1000,oxidation_time=.08),'Dry initial oxide'),w,named(step('diffusion',method='Dry oxidation',temperature=1000,oxidation_time=.08),'Dry finish')]
  add('dwd','Dry–Wet–Dry oxidation',b,'초기 건식 → 습식 bulk → 건식 마무리','건식·습식 성장 단계 비교','추가 열 노출; 산화막 품질은 미계산','총 두께·측면 침투',['locos','diff'])
 elif tid=='pvd':
  for method in ['CVD','ALD']:
   a=C(base)
   for i,s in enumerate(a):
    if s['op']=='deposition':a[i]=named(film(s['params']['material'],thick(s),method),method+' trench coating')
   add(method.lower(),method+' trench coating',a,'전체 트렌치 코팅을 '+method+' 수송 조건으로 변경','흡착·포화·입사 방향의 피복 차이','동일 평면 두께라도 측벽·바닥 두께가 달라짐','측벽/상부 두께·입구 폐쇄',['depo'])
 elif tid=='planarization':
  a=C(base);a.insert(len(a)-1,named(cut('SiO2',.10),'Oxide etchback'));a[-1]['params']['time']=max(1,a[-1]['params']['time']-10)
  add('etchback','Etchback + buff CMP',a,'산화막 bulk를 식각한 뒤 잔여 단차 연마','제거 공정을 식각/연마로 분리','공정 전환·주변막 소모','연마 직전/직후 높이',['cmp'])
  add('gapfill','DED fill + CMP',ded(base),'부분 충진 → 입구 etchback → 재충진 후 평탄화','충진 형상부터 조절','추가 증착·식각','연마 전 빈 공간·잔류막',['gap'])
 elif tid=='wet':
  a=C(base);a[-1]['params'].update(method='Directional',isotropic=0,time=1.0);a.append(named(step('etch',material='Si',method='Isotropic',rate=.05,time=1.),'Isotropic cavity finish'))
  add('hybrid','Dry recess → isotropic finish',a,'수직 recess 후 측면을 등방성으로 확장','깊이와 측면 제거를 분리','추가 처리·다른 바닥 형상','undercut·바닥 깊이',['drie'])
  b=C(base)
  for s in b:
   if s['params'].get('material')=='Si3N4':s['params']['material']='SiO2';s['label']='Oxide hardmask · '+s['op']
  add('oxide-mask','Oxide-mask cavity',b,'질화막 대신 산화막 하드마스크를 전사','마스크 재료와 제거 호환성 비교','실제 식각액 선택비·마스크 소모는 미계산','산화막 잔류·개구 형상',['mask','drie'])
 elif tid in ['sf6','ale-har','bosch']:
  p=C(base[:6]);h=sum(s['params']['cycles']*s['params']['epc'] if s['params']['method']=='ALE' else s['params']['rate']*s['params']['time'] for s in base[6:] if s['op']=='etch' and s['params']['material']=='Si')
  add('continuous','Continuous Dry Etch',p+[named(cut('Si',h,.02),'Continuous Si etch')],'반복 보호막 없이 연속 방향성 식각','단순한 연속 처리','측벽 보호 단계 없음; 플라즈마 손상 미계산','측벽 형상·보호막 잔류',['drie'])
  add('hybrid','Bulk Dry Etch + ALE',p+[named(cut('Si',max(.01,h-.06)),'Bulk Si etch'),named(step('etch',material='Si',method='ALE',cycles=300,epc=.0002),'ALE bottom finish')],'벌크 식각 후 마지막 60 nm를 ALE 처리량으로 제어','벌크 처리와 끝점 제어 분리','ALE 사이클 증가; 원자층 해상도는 아님','마지막 제거량·바닥 폭',['ale'])
 elif tid in ['photo-lithography','sadp','stack','regrowth']:
  add('hardmask','Hardmask transfer route',hardmask(base),'무기막 전사와 본 식각 전 PR 제거 추가','마스크 역할과 본체 식각 분리','추가 증착·개구·제거','PR strip 순서·잔류막',['mask'])
  if tid=='sadp':
   a=C(base);i=next(i for i,s in enumerate(a) if s['op']=='deposition' and s['params']['material']=='SiO2');a[i]=named(film('SiO2',thick(a[i]),'CVD'),'CVD oxide spacer')
   add('cvd-spacer','CVD spacer + ALE etchback',soft(a,['SiO2']),'CVD 피복 후 bulk/ALE etchback으로 spacer 형성','증착 피복과 수평막 제거 비교','피복 편차·사이클 증가','spacer 폭·상부 잔류',['spacer','ale'])
  else:add('soft-landing','Bulk etch + ALE finish',soft(base),'식각층마다 bulk 제거 후 ALE 마무리','층별 끝점 처리 분리','사이클 증가; 손상 감소는 미계산','층 경계 잔류·개구 깊이',['ale'])
 assert len(rows)==3,tid
 return dict(target=tid,title=t['title'],referenceHash=hashlib.sha256(path.read_bytes()).hexdigest(),candidates=rows)
