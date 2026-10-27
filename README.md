# simulation

반도체 공정 관찰 및 역설계 교육 플랫폼. 16종 예제, 6종 역설계 목표(MOSFET, FINFET, MBCFET, STI, Fin, LOCOS)를 제공합니다.

공개 서비스: [aie-makerthon2026.vercel.app](https://aie-makerthon2026.vercel.app/)

## 로컬 실행 (Windows x64)

1. Python 3.12 x64와 Node.js 22 이상을 설치합니다.
2. 저장소를 내려받아 `setup.cmd`를 한 번 실행합니다.
3. `start.cmd`를 실행하고 http://127.0.0.1:3001 에 접속합니다.

개발 중 서버를 직접 실행하려면 `SIMULATION_PYTHON`을 `.venv/Scripts/python.exe`의 절대 경로로 지정한 뒤 `node server.cjs`를 실행합니다. GPU는 필요하지 않습니다. 첫 예제 계산은 보통 수 초에서 수십 초이며 조건에 따라 달라집니다.

## 사용

- 왼쪽 테마에서 예제를 고르고 주요 조건을 바꾸어 관찰합니다.
- 구조·소자 예제에서 **역설계**를 선택하면 Si substrate부터 시작합니다.
- flow의 **+**에서 Photo / Etch / Diffusion / Deposition / C&C를 추가합니다.
- 선택한 단계의 조건만 오른쪽에 표시됩니다. 공정 계산 후 각 단계를 클릭하여 중간 단면을 확인합니다.
- 정답 flow는 별도로 펼쳐 보고 적용할 수 있습니다. 변경한 flow는 브라우저에 자동 저장됩니다.
- 유사도는 같은 좌표의 주요 영역에서 재료별 IoU를 계산합니다. Si 기판 가중치는 0.25이며, 도핑·전기 성능을 채점하지 않습니다.

## 이미지 분석

API 키가 없으면 이미지 미리보기 후 목표를 직접 선택합니다. 자동 분석인 것처럼 임의 결과를 만들지 않습니다.

`.env.example`을 `.env`로 복사하고 `OPENAI_API_KEY`를 설정하면 서버가 Responses API로 이미지를 분류합니다. `OPENAI_MODEL`, `OPENAI_BASE_URL`을 변경할 수 있습니다. 키는 서버 환경변수에만 보관합니다. 사용자 업로드 이미지는 디스크에 저장하지 않으며, API 연결 시에만 분류 요청에 전송됩니다. 자동 추천은 6개 목표 중 하나를 선택할 뿐 실제 제조 recipe나 공정 조건을 이미지로 추정하지 않습니다.

## 계산 범위

- 형상/입자 수송: ViennaPS 4.6.2 / ViennaLS 5.8.5 공식 wheel.
- 주입/열처리: ViennaPS 4.7.0 공식 CI 빌드의 별도 프로세스. 공개 B/P Pearson-IV 분포와 Arrhenius 확산 계수 사용.
- PVD/CVD: 입사 방향성·부착 확률 기반 유효 입자 모델. ALD: 표면 반응·coverage 모델, 공식 예제와 같은 macro-cycle 가속.
- Photo: 기하학적 PR 패턴. C&C: 이상적인 global planarization. 선택 재료 전체 제거도 이상적 기하 연산입니다.
- 산화·도핑의 재분배 연계와 LOCOS 대칭 셀의 주입·확산은 지원하지 않으며, 해당 조합은 단계 오류로 안내합니다. PR이 남아 있으면 고온 열처리를 진행하지 않습니다.
- 산화: native Oxidation. LOCOS는 안정적인 대칭 반주기 계산을 사용하고, Double 마스크 pitch 0.8 µm / offset 0으로 제한합니다.
- 격자는 10 nm이며 선단 공정의 원자 수준 정밀도, 장비 calibration, I–V 전기 특성을 제공하지 않습니다. 2.5D는 2D 단면의 표시용 돌출입니다.
- 역설계의 6개 목표와 해당 관찰 예제는 동일한 순차 native recipe를 사용합니다. 나머지 관찰 예제 중 교육용 기하/유효 속도 모델은 tutorial에 구분해 두었습니다.

## 배포

`Dockerfile` / `Dockerfile.vercel`은 CPU 계산 엔진과 Node 서버를 함께 실행합니다. 컨테이너에서 `PORT`를 사용하며 `/api/health`로 점검할 수 있습니다. 서버리스 환경에서는 계산 요청이 끝날 때까지 같은 HTTP 요청을 유지하므로 다른 인스턴스로 이동하며 작업 상태가 사라지는 문제가 없습니다.

- Vercel: 저장소를 연결하고 **Container** preset, root `.`로 배포합니다. Hobby 범위에서 사용하며 유료 전환 없이 한도 도달 시 중단합니다.
- Railway: 같은 저장소를 연결하면 Dockerfile / railway.json을 사용합니다. 현재 연결 계정은 무료 리소스 생성 한도에 도달하여 신규 프로젝트가 차단되었습니다. 기존 다른 프로젝트는 변경하지 않았습니다.
- 컨테이너는 비 root 사용자, 한 번에 한 native 계산, 150초 계산 제한, 입력 범위 제한을 적용합니다. 사진 업로드와 API 키는 Git에 올리지 않습니다.

## 검증

[2026-10-28 엄격 시나리오 검증 기록](docs/QA-2026-10-28.md): 22개 예제, 경계값·조합·실패 복구·공정 편집과 채점.

`npm test`: 재료별 채점, 정답 100점, 기판만/누락 재료/위치 이동 감점.

`.venv/Scripts/python tests/native_flows.py`: 6개 순차 recipe, 닫힌 재료 경계, 증착→도핑→열처리의 연결 확인.

Linux의 native 4.7 패키지는 공식 CI artifact를 checksum 검증 후 추출했습니다. 원본 commit, workflow, artifact, 재포장 checksum은 `vendor/manifest.json`에 기록되어 있습니다. 상용 TCAD 정확도 검증을 통과했다는 의미는 아닙니다.

## 출처

- [ViennaPS](https://github.com/ViennaTools/ViennaPS) · [공식 예제](https://viennatools.github.io/ViennaPS/examples/)
- [Native 4.7 source](https://github.com/ViennaTools/ViennaPS/tree/7a8b17fba8f11f907cac96ae6e03ee0aa3c68948)
- [공식 CI artifact](https://github.com/ViennaTools/ViennaPS/actions/runs/35322918342)
- [Arpelier](https://arpelier.com/): 단계와 단면을 연결하는 상호작용 참고. 코드·디자인 자산 복제 없음.

엔진의 라이선스는 `LICENSE-ViennaPS.txt` 및 runtime 내부의 원본 라이선스를 확인하세요. 기존 Git history는 보존합니다.

## 증착·확산 라이브러리 확장

총 22개 관찰 예제. Deposition: PVD Trench Deposition, CVD Trench Fill, Atomic Layer Deposition. Diffusion: Masked Ion Implantation, Thermal Anneal, PN Junction. 구조·소자 역설계 목표 6종은 유지합니다.

새 예제는 `learning_examples.py`에서 순차 native 공정을 실행합니다. PVD/CVD는 SingleParticleProcess의 유효 조건 프리셋, ALD는 SingleParticleALD, 주입·열처리는 native 4.7 worker입니다. PN Junction은 농도 분포 예제로 전류·전압 계산을 포함하지 않습니다. 계산 가정과 조절 변수는 tutorial에 있습니다.

[확장·스크롤·반응형 검증 기록](docs/QA-library-2026-10-28.md). `python tests/learning_examples.py`로 77개 신규 계산 시나리오를 재실행할 수 있습니다. `--failed-only`는 이전 결과에서 실패한 조건만 다시 실행합니다.
