# ProcessTrace

반도체 공정 관찰 및 역설계 교육 플랫폼. 29종 예제, 14종 역설계 목표를 제공합니다.

공개 서비스: [aie-makerthon2026.vercel.app](https://aie-makerthon2026.vercel.app/)

## 로컬 실행 (Windows x64)

1. Python 3.12 x64와 Node.js 22 이상을 설치합니다.
2. 저장소를 내려받아 `setup.cmd`를 한 번 실행합니다.
3. `start.cmd`를 실행하고 http://127.0.0.1:3001 에 접속합니다.

개발 중 서버를 직접 실행하려면 `SIMULATION_PYTHON`을 `.venv/Scripts/python.exe`의 절대 경로로 지정한 뒤 `node server.cjs`를 실행합니다. GPU는 필요하지 않습니다. 첫 예제 계산은 보통 수 초에서 수십 초이며 조건에 따라 달라집니다.

## 사용

- 왼쪽 테마에서 예제를 고르고 주요 조건을 바꾸어 관찰합니다.
- 구조·소자 예제에서 **역설계**를 선택하면 Si substrate부터 시작합니다. FD/PD-SOI는 준비된 Si / BOX / Si 웨이퍼로 시작합니다.
- flow의 **+**에서 Photo / Etch / Diffusion / Deposition / C&C를 추가합니다.
- 선택한 단계의 조건만 오른쪽에 표시됩니다. 공정 계산 후 각 단계를 클릭하여 중간 단면을 확인합니다.
- 정답 flow는 별도로 펼쳐 보고 적용할 수 있습니다. 변경한 flow는 브라우저에 자동 저장됩니다.
- 유사도는 같은 좌표의 주요 영역에서 재료별 IoU를 계산합니다. Si 기판 가중치는 0.25입니다. 주입이 포함된 소자 목표는 형상 50% + 총농도 20% + 활성농도 20% + 완료된 주입/열처리 이력 10%, PN Junction은 20/35/35/10%입니다. 농도는 순농도와 각 도펀트 분포를 함께 비교하고, 마지막 주입 뒤의 열처리가 필요합니다. 누락/불완전한 농도 필드는 0%입니다. 가중치는 교육용 기준이며 전기 동작이나 제조 가능성을 보증하지 않습니다. 도핑이 없는 게이트 횡단면 목표는 형상만 평가합니다.

## Gemini 이미지 추천·공정 분석

`.env.example`을 `.env`로 복사하고 `GEMINI_API_KEY`를 설정합니다. 기본 모델은 `gemini-3.5-flash-lite`이며 `GEMINI_MODEL`로 변경할 수 있습니다. 실제 사용 가능한 모델과 무료 한도는 Google AI Studio에서 확인합니다. Upstage는 사용하지 않습니다.

- 이미지: 첨부한 단면과 14개 실제 계산 예제 단면을 Gemini에 함께 전달합니다. 추천을 확인하고 목표를 선택하면 Si substrate부터 역설계를 시작합니다. 정보 부족·오류 시 직접 선택할 수 있습니다. 추천은 구조 식별의 확정 판정이 아니며, 도핑·재료 표기가 없는 작은 그림에서 오분류가 관측됐습니다.
- 유사도 평가: 형상·농도·공정 이력 점수는 수치 비교로 계산합니다. Gemini는 기준 flow 대비 누락·순서·조건 차이를 설명하는 팝업을 작성하며 점수를 바꾸지 않습니다. API가 실패해도 기본 비교 표는 유지됩니다.
- 업로드 이미지는 서버 디스크에 저장하지 않습니다. 자동 추천 시 Google API로 전송됩니다. 무료 API의 데이터 처리 조건은 [공식 가격·데이터 정책](https://ai.google.dev/gemini-api/docs/pricing)을 확인하세요.
- 키는 서버 환경변수에만 저장하며 Git·프런트엔드에 포함하지 않습니다. 유형별 IP당 시간당 5회, 프로세스당 하루 20회 제한(`LLM_DAILY_LIMIT`)이 있습니다. 메모리 기반 제한은 서버 재시작·다중 인스턴스에서 초기화되므로 공급자 측 과금 한도를 대체하지 않습니다.

## 계산 범위

- 형상/입자 수송: ViennaPS 4.6.2 / ViennaLS 5.8.5 공식 wheel.
- 주입/열처리: ViennaPS 4.7.0 공식 CI 빌드의 별도 프로세스. 공개 B/P Pearson-IV 분포와 Arrhenius 확산 계수 사용.
- PVD/CVD: 공통 유효 입자 모델의 입사 방향성·부착 확률 프리셋. 모든 수치가 같으면 결과도 같습니다. 화면·API·Python에서 같은 기본 조건을 사용합니다. ALD: 표면 반응·coverage 모델, 공식 예제와 같은 macro-cycle 가속.
- Photo: 기하학적 PR 패턴. C&C: 이상적인 global planarization. 선택 재료 전체 제거도 이상적 기하 연산입니다.
- 산화·도핑의 재분배 연계와 LOCOS 대칭 셀의 주입·확산은 지원하지 않으며, 해당 조합은 단계 오류로 안내합니다. PR이 남아 있으면 고온 열처리를 진행하지 않습니다.
- 산화: native Oxidation. LOCOS는 안정적인 대칭 반주기 계산을 사용하고, Double 마스크 pitch 0.8 µm / offset 0으로 제한합니다.
- 격자는 10 nm이며 선단 공정의 원자 수준 정밀도, 장비 calibration, I–V 전기 특성을 제공하지 않습니다. 2.5D는 2D 단면의 표시용 돌출입니다.
- 역설계의 14개 목표와 해당 관찰 예제는 동일한 순차 native recipe를 사용합니다. 나머지 관찰 예제 중 교육용 기하/유효 속도 모델은 tutorial에 구분해 두었습니다.

## 배포

`Dockerfile` / `Dockerfile.vercel`은 CPU 계산 엔진과 Node 서버를 함께 실행합니다. 컨테이너에서 `PORT`를 사용하며 `/api/health`로 점검할 수 있습니다. 서버리스 환경에서는 계산 요청이 끝날 때까지 같은 HTTP 요청을 유지하므로 다른 인스턴스로 이동하며 작업 상태가 사라지는 문제가 없습니다.

- Vercel: 저장소를 연결하고 **Container** preset, root `.`로 배포합니다. Hobby 범위에서 사용하며 유료 전환 없이 한도 도달 시 중단합니다.
- 운영 배포는 Vercel만 사용합니다. 프로젝트의 Production Secret에 `GEMINI_API_KEY`를 추가한 뒤 재배포합니다. 기존 다른 프로젝트는 변경하지 않습니다.
- 컨테이너는 비 root 사용자, 한 번에 한 native 계산, 150초 계산 제한, 입력 범위 제한을 적용합니다. 사진 업로드와 API 키는 Git에 올리지 않습니다.

## 검증

[2026-10-28 엄격 시나리오 검증 기록](docs/QA-2026-10-28.md): 기존 16개 예제, 경계값·조합·실패 복구·공정 편집과 채점.

`npm test`: 재료별 채점, 정답 100점, 기판만/누락 재료/위치 이동 감점.

`.venv/Scripts/python tests/native_flows.py`: 14개 순차 recipe, 닫힌 재료 경계, 증착→도핑→열처리의 연결 확인.

Linux의 native 4.7 패키지는 공식 CI artifact를 checksum 검증 후 추출했습니다. 원본 commit, workflow, artifact, 재포장 checksum은 `vendor/manifest.json`에 기록되어 있습니다. 상용 TCAD 정확도 검증을 통과했다는 의미는 아닙니다.

## 출처

- [ViennaPS](https://github.com/ViennaTools/ViennaPS) · [공식 예제](https://viennatools.github.io/ViennaPS/examples/)
- [Native 4.7 source](https://github.com/ViennaTools/ViennaPS/tree/7a8b17fba8f11f907cac96ae6e03ee0aa3c68948)
- [공식 CI artifact](https://github.com/ViennaTools/ViennaPS/actions/runs/35322918342)
- [Arpelier](https://arpelier.com/): 단계와 단면을 연결하는 상호작용 참고. 코드·디자인 자산 복제 없음.

엔진의 라이선스는 `LICENSE-ViennaPS.txt` 및 runtime 내부의 원본 라이선스를 확인하세요. 기존 Git history는 보존합니다.

## 증착·확산 라이브러리 확장

2026-10-28 1차 확장 당시 22개 관찰 예제. Deposition: PVD Trench Deposition, CVD Trench Fill, Atomic Layer Deposition. Diffusion: Masked Ion Implantation, Thermal Anneal, PN Junction. 이번 소자 확장으로 PN Junction은 소자 테마와 역설계 목표에 포함됩니다.

새 예제는 `learning_examples.py`에서 순차 native 공정을 실행합니다. PVD/CVD는 SingleParticleProcess의 유효 조건 프리셋, ALD는 SingleParticleALD, 주입·열처리는 native 4.7 worker입니다. PN Junction은 농도 분포 예제로 전류·전압 계산을 포함하지 않습니다. 계산 가정과 조절 변수는 tutorial에 있습니다.

[확장·스크롤·반응형 검증 기록](docs/QA-library-2026-10-28.md). `python tests/learning_examples.py`로 77개 신규 계산 시나리오를 재실행할 수 있습니다. `--failed-only`는 이전 결과에서 실패한 조건만 다시 실행합니다.

## 소자 라이브러리 확장

RCAT, BCAT, FD-SOI FET, PD-SOI FET, GAAFET, CFET, Charge Trap Flash (평면 SONOS), PN Junction을 관찰 및 역설계로 제공합니다. 각 예제는 7–24개 공정과 중간 단면을 포함합니다. 상용 제조 레시피나 전기 TCAD는 아닙니다.

- 제조사 공개 도면, 구현 범위, 레시피 대응: [소자 설계 근거](docs/DEVICE-SOURCES.md).
- 검증 결과: [소자 확장 QA](docs/QA-devices-2026-10-28.md).
- `python tests/advanced_devices.py`: 기본값·각 경계값·복합 최소/최대, BOX 차폐, CFET 게이트 분리, ONO 순서 등을 검사합니다.

## 소자 상세 단면

재료 색상은 `web/materials.js` 하나로 관리합니다. HfO₂, TiN, SiO₂, Si₃N₄, Si, Poly-Si, SiGe, W, Co, Mo를 표시하며 역할명은 재료명에 붙이지 않습니다.

MOSFET·SOI·RCAT·BCAT·CTF·PN 목표에 주입, 활성화, 절연막, 콘택 개구, 금속 충전, CMP를 포함합니다. BCAT는 캡으로 주입이 차단되지 않도록 노출 Si에서 S/D를 먼저 형성합니다. FINFET·GAAFET·MBCFET·CFET의 게이트 횡단면과 S/D·콘택 단면은 **독립된 2D 교육 모듈**입니다. 두 단면이 결합된 3D 소자 해석이 아닙니다.

콘택 예제는 W(평면·SOI·RCAT·BCAT·CTF·PN), Co(FINFET S/D), Mo(GAA·MBCFET·CFET S/D)를 사용합니다. 이는 공개된 재료 동향을 반영한 교육용 선택이며 특정 제조사의 양산 레시피를 재현했다는 의미가 아닙니다. 재료별 고유 반응식, 장벽층, 실리사이드 접촉저항, I–V는 계산하지 않습니다. [Applied Materials의 Mo 콘택 공개 설명](https://www.appliedmaterials.com/us/en/newsroom/blogs/powering-the-next-era-of-contact-scaling-with-ald-molybdenum.html).

추가 검증: `python tests/device-details.py`(12개 단면의 금속·양쪽 활성 도핑·감점), `npm test`(채점·상태·표시·분석 계약). 상세 기록은 [Gemini·콘택 QA](docs/QA-gemini-contacts-2026-10-28.md)를 참고하세요.
