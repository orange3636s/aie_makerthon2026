"""Bounded, CPU-friendly adaptations of ViennaPS basic examples."""
def field(key, label, unit, default, low, high, step):
    return dict(key=key, label=label, unit=unit, default=default, min=low, max=high, step=step)

def item(id, title, subtitle, group, model, source, description, fields, note, unit="µm"):
    return dict(id=id, title=title, subtitle=subtitle, group=group, model=model,
                source="https://github.com/ViennaTools/ViennaPS/tree/v4.6.2/examples/"+source,
                description=description, fields=fields, note=note, unit=unit)

CATALOG = [
 item("bosch","Bosch Process","보호막과 식각의 반복", "ETCH", "DirectionalProcess + SphereDistribution", "boschProcess",
      "보호막을 쌓고 바닥을 연 뒤 식각합니다. 반복 횟수와 식각 시간을 바꾸며 측벽의 굴곡을 관찰하세요.",
      [field("width","개구 폭","µm",1.2,.6,2,.1),field("cycles","반복 횟수","cycle",5,2,8,1),field("etch_time","회당 식각 시간","s",.8,.3,1.5,.1),field("coating","보호막 두께","µm",.08,.05,.15,.01)],
      "공식 Bosch emulation을 2D·0.02 µm 격자로 축소했습니다. 초기 트렌치 식각 1회 후 지정 횟수만큼 반복합니다. 유효 식각 속도·비소모 마스크를 가정하며 플라즈마 반응을 직접 풀지는 않습니다."),
 item("trench","Trench Deposition","트렌치 내부의 입자 증착", "DEPOSITION", "SingleParticleProcess", "trenchDeposition",
      "입자가 표면에 붙을 확률을 바꿔 보세요. 트렌치 입구와 바닥의 증착 형태가 어떻게 달라지는지 비교합니다.",
      [field("width","트렌치 폭","µm",1.2,.8,2,.1),field("depth","초기 깊이","µm",1.5,.5,2.5,.1),field("sticking","부착 확률","",.2,.05,1,.05),field("duration","증착 시간","s",1.2,.3,2,.1)],
      "입자 기반 증착 모델입니다. 증착률 0.3 µm/s, 광선 수 100/표면점으로 제한한 빠른 미리보기입니다."),
 item("sf6","SF₆/O₂ Etching","이온·중성종에 의한 식각", "ETCH", "SF6O2Etching", "holeEtching",
      "산소 공급과 이온 에너지가 식각 단면에 주는 영향을 비교합니다. 원형 홀의 3D 해석 대신 2D 개구 단면을 계산합니다.",
      [field("width","개구 폭","µm",.35,.25,.7,.05),field("oxygen","산소 플럭스","×10¹⁵ cm⁻²s⁻¹",800,200,1400,100),field("energy","평균 이온 에너지","eV",100,50,180,10),field("duration","식각 시간","min",.05,.02,.15,.01)],
      "공식 SF₆/O₂ 반응 모델, 고정 이온 플럭스 10·식각종 플럭스 4500, 100 rays/point. 입자 추적으로 재실행 시 미세 차이가 날 수 있습니다."),
 item("wet","Wet Etching","결정 방향에 따른 식각", "ETCH", "WetEtching", "cantileverWetEtching",
      "결정 방향별 식각 속도 차이로 생기는 경사면을 살펴봅니다. 마스크 개구와 시간을 바꿔 단면을 비교하세요.",
      [field("width","마스크 개구 폭","µm",1.5,.8,2.5,.1),field("duration","식각 시간","s",45,15,90,5),field("anisotropy","(111) 상대 속도 배율","×",1,.5,4,.5)],
      "원본 cantilever 예제는 3D입니다. 여기서는 같은 결정 의존 WetEtching 모델을 단순한 2D 개구에 적용합니다. 온도·농도는 독립 변수로 다루지 않습니다."),
 item("epi","Selective Epitaxy","선택적 SiGe 성장", "DEPOSITION", "SelectiveEpitaxy", "selectiveEpitaxy",
      "노출된 Si 위에서 SiGe가 자라며 만드는 면을 관찰합니다. 성장 시간과 결정면 속도비를 비교하세요.",
      [field("width","Si fin 폭","µm",.6,.3,1,.1),field("duration","성장 시간","s",1.5,.5,3,.25),field("ratio","(111)/(100) 속도비","",.4,.2,.8,.1)],
      "공식 선택적 에피택시 모델의 2D 축소 예제입니다. fin 높이 0.8 µm, 산화막 높이 0.2 µm, 유효 성장률 0.25 µm/s."),
 item("regrowth","Oxide Regrowth","선택 식각 중 재증착", "STACK", "OxideRegrowth", "oxideRegrowth",
      "Si₃N₄/SiO₂ 적층의 선택 식각과 부산물 재증착을 함께 계산합니다. 재증착률과 시간을 비교하세요.",
      [field("layers","적층 수","layer",3,3,5,1),field("duration","공정 시간","s",60,20,100,20),field("redeposition","재증착 계수","",.01,0,.03,.005)],
      "공식 대류·확산/재증착 모델입니다. 4 nm 격자·작은 160 nm 폭으로 축소했으며, Si₃N₄ 식각률은 6.5 nm/min입니다.","nm"),
 item("gds","GDS Mask Import","마스크 평면과 경계 보정", "GEOMETRY", "GDSReader + GDSGeometry", "GDSReader",
      "함께 제공되는 GDS 예제의 평면 마스크를 읽습니다. 블러와 임계값에 따라 패턴 경계가 변하는 모습을 비교하세요.",
      [field("sigma","블러 길이","µm",.08,.02,.2,.02),field("threshold","노광 임계값","",.5,.3,.7,.05)],
      "공식 myTest.gds를 읽는 2D 평면도입니다. 공정 시간에 따른 단면이 아니며, 원본과 블러 결과 두 상태를 비교합니다."),
 item("fin","Fin Oxidation","Si fin의 열산화", "OXIDATION", "Oxidation", "finOxidation",
      "Si fin 표면의 산화막 성장과 실리콘 소모를 살펴봅니다. 온도와 산화 시간을 바꿔 결과를 비교하세요.",
      [field("width","fin 폭","µm",.2,.15,.4,.05),field("temperature","산화 온도","°C",1000,950,1100,25),field("duration","산화 시간","h",.05,.02,.1,.01)],
      "ViennaPS 열산화 모델의 CPU 미리보기입니다. 습식 산화·1 atm·(100), 0.025 µm 격자와 0.025 µm seed oxide를 사용합니다. 수렴 경고를 별도 표시합니다."),
 item("locos","LOCOS Oxidation","마스크 아래의 산화 확장", "OXIDATION", "Oxidation + Si₃N₄ mask", "locosOxidation",
      "질화막 마스크 옆의 열린 영역에서 시작되는 산화를 계산합니다. 마스크와 산화막 경계의 변화를 관찰하세요.",
      [field("mask","질화막 두께","µm",.075,.05,.15,.025),field("temperature","산화 온도","°C",1000,950,1100,25),field("duration","산화 시간","h",.04,.02,.08,.01)],
      "공식 LOCOS 형상의 저해상도 CPU 미리보기입니다. 0.025 µm 격자, 0.05 µm pad oxide. 얇은 bird’s-beak의 정량 정확도를 보장하지 않습니다."),
]

CATALOG += [
 item("mosfet","MOSFET","평면 게이트·스페이서·접촉 모듈", "DEVICE", "ViennaPS geometric emulation", "emulation",
      "평면 MOSFET의 게이트 모듈을 제작합니다. 게이트 길이, 절연막과 스페이서 두께를 바꾸고 증착·패터닝·평탄화 단계를 비교하세요.",
      [field("gate_length","게이트 길이","µm",.3,.15,.6,.05),field("oxide","게이트 산화막 두께","µm",.03,.02,.06,.01),field("spacer","스페이서 두께","µm",.06,.04,.12,.01)],
      "자체 구성한 교육용 평면 nMOS 게이트/접촉 모듈입니다. ViennaPS의 기하 증착·방향성 제거·Boolean 패터닝·Planarize를 사용합니다. 도핑·접합·확산·전류·문턱전압은 계산하지 않습니다. S/D 접촉 위치만 지정하며 완성 소자의 전기 성능을 뜻하지 않습니다."),
 item("finfet","FinFET","fin을 감싸는 게이트 적층", "DEVICE", "ViennaPS geometric emulation", "emulation/FinFET.py",
      "fin 패터닝부터 STI, high-k, 게이트 증착까지 단계를 살펴봅니다. 게이트 중앙을 가로지르는 횡단면으로 fin의 양쪽 측벽과 상부를 관찰합니다.",
      [field("width","fin 폭","µm",.12,.08,.24,.02),field("height","fin 식각 깊이","µm",.35,.2,.5,.05),field("oxide","high-k 두께","µm",.02,.02,.05,.01),field("gate","게이트 증착 두께","µm",.1,.06,.16,.02)],
      "공식 3D FinFET emulation을 참고한 2D 횡단면 공정 모듈입니다. 격자 0.01 µm의 기하 모델로, STI 높이는 식각 깊이의 40%입니다. S/D는 단면 밖에 있으며 이온주입·수송·I–V·실제 3D 소자 해석은 포함하지 않습니다.")
]
for entry in CATALOG:
    entry["mode"] = "geometry" if entry["id"] in ("bosch","mosfet","finfet") else "mask" if entry["id"]=="gds" else "physics"
    if entry["id"]=="fin": entry["note"]=entry["note"].replace("수렴 경고를 별도 표시합니다.","실제 장비 조건에 대한 정량 보정은 하지 않았습니다.")
BY_ID = {x["id"]: x for x in CATALOG}

def validate(data):
    import math
    if not isinstance(data, dict) or data.get("example") not in BY_ID:
        raise ValueError("지원하는 예제를 선택해 주세요.")
    spec = BY_ID[data["example"]]
    given = data.get("params", {})
    if not isinstance(given, dict):
        raise ValueError("조건은 숫자 형식이어야 합니다.")
    if set(given) - {f["key"] for f in spec["fields"]}:
        raise ValueError("지원하지 않는 조건이 포함되어 있습니다.")
    params = {}
    for f in spec["fields"]:
        raw = given.get(f["key"], f["default"])
        if isinstance(raw, bool):
            raise ValueError("숫자 조건을 입력해 주세요.")
        try: value = float(raw)
        except (TypeError, ValueError): raise ValueError(f'{f["label"]}: 숫자를 입력해 주세요.')
        if not math.isfinite(value) or not f["min"] <= value <= f["max"]:
            raise ValueError(f'{f["label"]}: {f["min"]}~{f["max"]} 범위로 입력해 주세요.')
        if f["key"] in ("cycles", "layers") and value != int(value):
            raise ValueError("횟수는 정수여야 합니다.")
        params[f["key"]] = value
    return spec, params
