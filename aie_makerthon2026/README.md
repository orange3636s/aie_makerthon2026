# simulation · 메이커톤 공정 학습 데모

팀원이 각자 PC에서 실행하는 ViennaPS 4.6.2 기반 웹 도구입니다. GPU나 유료 API 키 없이 CPU에서 계산합니다. 외부 서버에 배포하지 않습니다.

## Windows 실행 방법

1. **Python 3.12 64비트**와 **Node.js LTS**를 설치합니다.
2. 초대받은 GitHub 계정으로 이 저장소의 `Code → Download ZIP`을 선택하고 압축을 풉니다. Git 사용자라면 `git clone https://github.com/orange3636s/aie_makerthon2026.git`을 실행합니다.
3. 처음 한 번 `setup.cmd`를 실행합니다. ViennaPS/ViennaLS를 다운로드합니다.
4. `start.cmd`를 실행합니다. 터미널을 열어 둔 상태에서 http://127.0.0.1:3001/challenge 로 접속합니다. 페이지가 바로 열리지 않으면 서버 준비 후 새로고침하세요.
5. 종료는 서버 터미널에서 Ctrl+C. 포트 충돌 시 이전 simulation 서버를 종료합니다.

PowerShell에서 직접 실행할 수도 있습니다.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
node server.cjs
```

macOS/Linux에서는 해당 플랫폼의 ViennaPS wheel이 지원되는 환경에 Python 3.12와 Node.js를 설치한 뒤 `python3.12 -m venv .venv`, `.venv/bin/python -m pip install -r requirements.txt`, `node server.cjs`를 실행합니다. 이번 검증 환경은 Windows x64입니다.

## 챌린지 사용법

- MOSFET / FinFET / Trench 중 목표를 고르고 확정합니다.
- SEM·단면 이미지는 참고용으로 첨부할 수 있습니다. 브라우저 내부에서만 표시하며 서버에 보내지 않습니다. 드래그 사각형은 관심 영역 표시용이며 자동 분석·정렬을 수행하지 않습니다.
- Si 기판에서 공정을 추가하고 재료·파라미터를 지정합니다. 수정·삭제·순서 이동 후 **전체 공정 계산**을 누릅니다.
- 왼쪽은 목표 최종 단면, 오른쪽은 내 공정 결과입니다. 나란히 / 목표 경계 겹치기 / 차이 보기와 동기화된 확대·이동을 지원합니다.
- 아래 공정 카드를 클릭하거나 과정 재생으로 중간 결과를 봅니다. **학습용 예시 흐름 불러오기**로 기준 레시피를 확인할 수 있습니다.
- 실험 JSON과 비교 PNG를 저장합니다. JSON 재가져오기는 아직 지원하지 않습니다.

## 범위와 한계

공정 실험실(`/`)에는 9개 기본 예제와 MOSFET/FinFET 모듈이 있습니다. 챌린지(`/challenge`)에는 지정 두께 증착, 단일 입자 CVD, 평면 충전, 마스크, 상부막 패터닝, 방향성/등방성 식각, 결정 의존 wet etch, wet/dry oxidation, 재료 제거, 기하 CMP, 접촉 개구와 금속 삽입을 연결했습니다. 각 모델의 가정과 조절 조건은 `/parameters.html`에서 확인합니다.

- 포토·충전·CMP·접촉부는 기하 근사입니다. 노광 화학, 슬러리, 도핑과 전기 특성은 계산하지 않습니다.
- 2.5D는 2D 단면에 표시용 깊이를 더한 화면이며 실제 3D 해석은 아닙니다.
- SEM 자동 분류/역공정 추론, 보정된 PVD/ALD/Cryo 모델, 확산은 미구현입니다.
- 점수는 고정 영역의 재료별 평균 IoU(240×180 래스터)입니다. 실제 SEM 사진 유사도나 공정 정답, 소자 성능 점수가 아닙니다. 수정 후 재계산 전 점수는 숨깁니다.
- 같은 재료의 추가 증착은 앞선 단계 두께를 수정합니다. 산화는 Si+SiO2 조합만 지원합니다. 실패 시 마지막 정상 단면과 실패 단계를 표시합니다.
- 최대 16단계, 동시 계산 1개, CPU 스레드 2개, 계산 제한 70초입니다. 복잡한 조합·극단 조건은 계산에 실패할 수 있습니다.

## 파일과 공동 작업

`server.cjs`: 로컬 서버와 입력 검증. `engine.py`: 기본 예제. `flow_engine.py`: 순차 공정 계산. `challenge.html/css/js`: 학습 화면. `index.html`, `style.css`, `app.js`: 실험실. `targets.json`: 같은 엔진으로 미리 계산한 기준 단면. 개발본에서는 화면 파일을 `web/` 폴더에 넣어도 동작합니다.

브랜치를 만들어 수정하고 PR로 팀원과 검토하세요. `.venv`, `.runtime`, 개인 SEM 이미지, 인증 정보는 커밋하지 않습니다. 임의 Python 입력은 실행하지 않으며 사전 정의한 공정과 범위만 허용합니다.

## 출처

- [ViennaPS](https://github.com/ViennaTools/ViennaPS): 동봉 `LICENSE-ViennaPS.txt` 참고
- [ViennaLS](https://github.com/ViennaTools/ViennaLS)

공식 ViennaPS 제품이 아닌 교육용 래퍼입니다. 데모 치수와 레시피는 실제 제조 레시피가 아닙니다.
