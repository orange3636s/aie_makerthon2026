# ProcessTrace

반도체 공정 관찰 및 역설계 교육 플랫폼. 24종 예제와 역설계 목표를 제공합니다.

공개 서비스: [process-trace.vercel.app](https://process-trace.vercel.app/)

## 로컬 실행 (Windows x64)

1. Python 3.12 x64와 Node.js 22 이상을 설치합니다.
2. 저장소를 내려받아 `setup.cmd`를 한 번 실행합니다.
3. `start.cmd`를 실행하고 http://127.0.0.1:3001 에 접속합니다.

개발 중 서버를 직접 실행하려면 `SIMULATION_PYTHON`을 `.venv/Scripts/python.exe`의 절대 경로로 지정한 뒤 `node server.cjs`를 실행합니다. GPU는 필요하지 않습니다. 첫 예제 계산은 보통 수 초에서 수십 초이며 조건에 따라 달라집니다.

## 사용

- 초급 6개 / 중급 7개 / 고급 11개 예제를 실험실에서 관찰합니다.
- 구조·소자 예제에서 **역설계**를 선택하면 Si substrate부터 시작합니다. FD/PD-SOI는 준비된 Si / BOX / Si 웨이퍼로 시작합니다.
- flow의 **+**에서 Photo / Etch / Diffusion / Deposition / C&C를 추가합니다.
- 선택한 단계의 조건만 오른쪽에 표시됩니다. 공정 계산 후 각 단계를 클릭하여 중간 단면을 확인합니다.
- 예시 flow는 별도로 펼쳐 보고 적용할 수 있습니다. 변경한 flow는 브라우저에 자동 저장됩니다.
- **공정설계 평가**는 재료 형상, CD, 도핑과 공정 이력, 효율을 코드로 채점합니다. 도핑 목표의 가중치는 형상 40% / CD 20% / 도핑 25% / 효율 15%, 그 외에는 60% / 25% / 15%입니다. 필수 조건 누락 시 점수 상한이 적용됩니다. AI는 점수를 결정하지 않고 설명과 학습 질문을 제공합니다.

## Gemini 이미지 추천·공정 분석

`.env.example`을 `.env`로 복사하고 `GEMINI_API_KEY`를 설정합니다. 기본 모델은 `gemini-3.5-flash-lite`이며 `GEMINI_MODEL`로 변경할 수 있습니다. 실제 사용 가능한 모델과 무료 한도는 Google AI Studio에서 확인합니다. Upstage는 사용하지 않습니다.

- 이미지: 첨부한 단면과 21개 실제 계산 예제 단면을 Gemini에 함께 전달합니다. 초급 / 중급 / 고급 메뉴에서 직접 목표를 선택할 수도 있습니다. 추천은 구조 식별의 확정 판정이 아니며, 도핑·재료 표기가 없는 작은 그림에서 오분류가 관측됐습니다.
- 유사도 평가: 형상·농도·공정 이력 점수는 수치 비교로 계산합니다. Gemini는 기준 flow 대비 누락·순서·조건 차이를 설명하는 팝업을 작성하며 점수를 바꾸지 않습니다. API가 실패해도 기본 비교 표는 유지됩니다.
- 업로드 이미지는 서버 디스크에 저장하지 않습니다. 자동 추천 시 Google API로 전송됩니다. 무료 API의 데이터 처리 조건은 [공식 가격·데이터 정책](https://ai.google.dev/gemini-api/docs/pricing)을 확인하세요.
- 키는 서버 환경변수에만 저장하며 Git·프런트엔드에 포함하지 않습니다. 유형별 IP당 시간당 5회, 프로세스당 하루 20회 제한(`LLM_DAILY_LIMIT`)이 있습니다. 메모리 기반 제한은 서버 재시작·다중 인스턴스에서 초기화되므로 공급자 측 과금 한도를 대체하지 않습니다.

## 계산 범위

- Pre-deposition / Drive-in: FiPy 4.0.3 유한체적 확산. 노출된 Si에 고정 농도를 공급하는 모드와 외부 공급 없이 종별 총량을 보존하는 모드를 구분합니다. B/P 계수는 `annealing.csv`를 사용하며 고용도로 제한한 평형 활성 농도를 함께 표시합니다. 비 Si 막은 완전 차단, 등온·고유 확산 근사입니다. 도펀트 공급 가스 반응, TED, 계면 편석은 계산하지 않습니다.
- 형상/입자 수송: ViennaPS 4.6.2 / ViennaLS 5.8.5 공식 wheel.
- 주입/열처리: ViennaPS 4.7.0 공식 CI 빌드의 별도 프로세스. 공개 B/P Pearson-IV 분포와 Arrhenius 확산 계수 사용.
- PVD/CVD: 공통 유효 입자 모델의 입사 방향성·부착 확률 프리셋. 모든 수치가 같으면 결과도 같습니다. 화면·API·Python에서 같은 기본 조건을 사용합니다. ALD: 표면 반응·coverage 모델, 공식 예제와 같은 macro-cycle 가속.
- Photo: 기하학적 PR 패턴. C&C: 이상적인 global planarization. 선택 재료 전체 제거도 이상적 기하 연산입니다.
- 산화·도핑의 재분배 연계와 LOCOS 대칭 셀의 주입·확산은 지원하지 않으며, 해당 조합은 단계 오류로 안내합니다. PR이 남아 있으면 고온 열처리를 진행하지 않습니다.
- 산화: native Oxidation. LOCOS는 안정적인 대칭 반주기 계산을 사용하고, Double 마스크 pitch 0.8 µm / offset 0으로 제한합니다.
- 격자는 10 nm이며 선단 공정의 원자 수준 정밀도, 장비 calibration을 제공하지 않습니다. 제한된 평면 MOSFET의 I–V 학습 곡선은 해석 근사이며 전기 TCAD 결과가 아닙니다. 3D는 2D 계산 단면을 돌출한 표시 모델입니다. X/Y/Z 절단, 회전, 확대, 재료·층 분리를 지원하지만 3D 물리 해석은 아닙니다.
- 24개 목표를 공통 레시피로 편집합니다. Live 입자/빛 애니메이션은 개념 표현이며 계산 중 입자를 실측 추적하는 기능이 아닙니다. 계측 단계 UI는 제거되었고 도핑은 소자 위에 표시됩니다.

## 배포

`Dockerfile`은 CPU 계산 엔진과 Node 서버를 함께 실행합니다. 컨테이너에서 `PORT`를 사용하며 `/api/health`로 점검할 수 있습니다. 서버리스 환경에서는 계산 요청이 끝날 때까지 같은 HTTP 요청을 유지하므로 다른 인스턴스로 이동하며 작업 상태가 사라지는 문제가 없습니다.

- Vercel: 저장소를 연결하고 **Container** preset, root `.`로 배포합니다. Hobby 범위에서 사용하며 유료 전환 없이 한도 도달 시 중단합니다.
- 운영 배포는 Vercel만 사용합니다. 프로젝트의 Production Secret에 `GEMINI_API_KEY`를 추가한 뒤 재배포합니다. 기존 다른 프로젝트는 변경하지 않습니다.
- 컨테이너는 비 root 사용자, 한 번에 한 native 계산, 150초 계산 제한, 입력 범위 제한을 적용합니다. 사진 업로드와 API 키는 Git에 올리지 않습니다.

## 검증

로컬 확산 추가분: `.venv/Scripts/python tests/diffusion-physics.py`는 erfc 해석해·총량 보존·마스크·반복 확산을 검증합니다. `.venv/Scripts/python tests/diffusion-native.py`는 실제 native 형상과의 연결·차단·오류 복구를 검사합니다.

[2026-10-28 엄격 시나리오 검증 기록](docs/QA-2026-10-28.md): 기존 16개 예제, 경계값·조합·실패 복구·공정 편집과 채점.

`npm test`: 재료별 채점, 예시 100점, 기판만/누락 재료/위치 이동 감점.

`.venv/Scripts/python tests/native_flows.py`: 순차 recipe, 닫힌 재료 경계, 증착→도핑→열처리의 연결 확인.

`python tests/all-device-audit.py`: 11개 소자의 통합 단면의 실제 계산, 농도, 컨택 채움 검사. `python tests/process-targets.py`: 공정 목표 7종의 관찰/역설계 일치, Photo 6개 조합, 경계 조건 검사. 두 테스트는 설치된 native runtime이 필요합니다.

Linux의 native 4.7 패키지는 공식 CI artifact를 checksum 검증 후 추출했습니다. 원본 commit, workflow, artifact, 재포장 checksum은 `vendor/manifest.json`에 기록되어 있습니다. 상용 TCAD 정확도 검증을 통과했다는 의미는 아닙니다.

## 출처

- [FiPy](https://pages.nist.gov/fipy/en/stable/) · [확산 방정식 및 경계 조건](https://pages.nist.gov/fipy/en/stable/generated/examples.diffusion.mesh1D.html)
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

MOSFET·SOI·RCAT·BCAT·CTF·PN 목표에 주입, 활성화, 절연막, 콘택 개구, 금속 충전, CMP를 포함합니다. BCAT는 캡으로 주입이 차단되지 않도록 노출 Si에서 S/D를 먼저 형성합니다. FINFET·GAAFET·MBCFET·CFET은 S/D–채널 길이 방향의 하나의 2D 단면에서 게이트·도핑·컨택을 표시합니다. Si 채움은 S/D 에피택시 형상 근사, Conformal은 단면 밖 공급을 가정한 등방 성장, Pattern transfer는 PR 투영 Boolean 연산입니다. 3D 소자나 제조사 레시피의 재현이 아닙니다.

콘택 예제는 W(평면·SOI·RCAT·BCAT·CTF·PN), Co(FINFET S/D), Mo(GAA·MBCFET·CFET S/D)를 사용합니다. 이는 공개된 재료 동향을 반영한 교육용 선택이며 특정 제조사의 양산 레시피를 재현했다는 의미가 아닙니다. 재료별 고유 반응식, 장벽층, 실리사이드 접촉저항, I–V는 계산하지 않습니다. [Applied Materials의 Mo 콘택 공개 설명](https://www.appliedmaterials.com/us/en/newsroom/blogs/powering-the-next-era-of-contact-scaling-with-ald-molybdenum.html).

추가 검증: `python tests/device-details.py`(12개 단면의 금속·양쪽 활성 도핑·감점), `npm test`(채점·상태·표시·분석 계약). 상세 기록은 [Gemini·콘택 QA](docs/QA-gemini-contacts-2026-10-28.md)를 참고하세요.

## UI 일관성 및 오류 복구 기준

| 항목 | 공통 기준 |
| --- | --- |
| 예제 분류 | 초급 / 중급 / 고급. 13개 구조와 11개 소자 |
| 재료·선택값 | `materials.js`의 재료별 색상, `ui-contract.js`의 SiO₂·Si₃N₄·HfO₂ 및 마스크·PR 표기 사용. API enum은 변경하지 않음 |
| 농도·단위 | 도핑 프로파일을 구조에 겹쳐 표시합니다. 활성/총 농도 전환 UI는 제공하지 않습니다. 길이는 결과의 µm/nm, 농도는 cm⁻³, 주입량은 ions/cm² |
| 입력·계산 | 반복 횟수는 정수. 활성 입력의 오류는 차단. 숨겨진 잘못된 조건만 기본값으로 복구하며 다른 단면의 유효 조건은 유지 |
| 상태·결과 | 조건을 바꾸면 재계산 필요 표시 및 이전 평가 무효화. 계산 후 보고 있던 단계 유지. 계산/재생 중 문서 자동 스크롤 금지 |
| 편집·저장 | 추가·삭제·순서 변경·전체 초기화·예시 적용의 직전 변경을 한 번 되돌릴 수 있음. 그 후 파라미터를 편집하면 이전 복구 지점을 지워 새 편집의 손실 방지. 브라우저 저장 실패 시 파일 저장 안내 |
| 평가·내보내기 | ‘공정설계 평가’는 마지막 완료 구조를 평가. 관찰은 ‘결과 저장’, 역설계는 ‘레시피 저장’으로 구분 |
| 작은 화면·접근성 | 보조 설명 12px, 키보드 포커스 테두리, 선택 버튼의 pressed 상태, 모달의 이름 제공. 모바일 분석 표는 세로 항목으로 전환 |

`npm test`는 저장 상태·채점·표시·공정 분석·AI 응답 계약과 UI 규칙을 검사합니다. `node tests/api.cjs http://127.0.0.1:3012`는 실행 중인 QA 서버의 실제 계산 및 오류 복구를 검사합니다. `node tests/server-errors.cjs`는 3013 포트에 격리된 동기 서버를 실행해 잘못된 JSON 객체, 이미지 형식, AI 키 미설정, 동시 계산, 캐시를 검사하고 종료합니다.

브라우저 검사는 `node tests/prepare-browser.cjs` 후 로컬 `/qa.html`의 **Run strict scenarios**로 실행합니다. 실제 앱의 클릭·입력·삭제·복구·모달·스크롤 경로를 검사하며, 결정적인 UI 검증을 위해 이 페이지 안의 계산 및 AI 응답은 대체합니다. 이 검사를 실제 물리 계산 또는 AI 정확도 검증으로 간주하지 않습니다. 실제 CPU 검증은 `python tests/scenarios.py`로 분리합니다. 화면 크기를 바꾼 뒤 **Check this viewport**를 눌러 다시 검사할 수 있습니다. QA 페이지는 Git·Docker 빌드에서 제외되며 외부 배포에서 제공하지 않습니다.

역설계의 **설계 목표선**은 계산 윤곽을 직선·직각으로 정리한 표시용 가이드입니다. LOCOS는 버드비크를 유지하며 곡선을 단순화합니다. 예시 계산 결과와 농도·공정 이력, 유사도 점수의 입력은 원본을 사용합니다. 수치 격자·근사 모델에서 생긴 표면 굴곡을 실제 제조 공정의 통계적 산포로 해석하지 않습니다.


## 계산 결과 캐시

기본 실험실 예제는 검토된 `references/` 결과를 사용하고, 기본 역설계 레시피는 새 native 계산으로 만든 `baseline-results/` 결과를 사용합니다. 모델 해시, 파일 해시, 모든 조건이 일치할 때만 재사용합니다. 변경한 파라미터·단계·웨이퍼·단면에는 적용하지 않습니다. MOSFET 3개 시연 후보와 불량분석 캐시는 `demo-results/`에 있습니다.

모델/레시피 변경 후 캐시 재생성:

```powershell
node scripts/build-baseline-cache.cjs
node scripts/index-observation-cache.cjs
node scripts/build-demo-cache.cjs
node scripts/build-defect-cache.cjs
npm test
npm run build
```

캐시는 새 수치해석을 빠르게 만든다는 의미가 아닙니다. 사용자 변경 레시피의 소요 시간은 공정 수·농도 격자·서버 자원에 따라 달라집니다. 공급자 AI 호출 시간 역시 별도입니다.
