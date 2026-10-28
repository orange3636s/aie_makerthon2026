# Local diffusion extension — 2026-10-28

로컬 변경만 적용. GitHub push 및 배포 없음.

## 구현

- 기존 native 산화, CMP, 주입, Anneal 유지.
- FiPy 4.0.3을 프로젝트 `.venv`에 설치하고 requirements에 고정.
- Pre-deposition: 외부 공기와 연결된 실제 Si 경계에 고정 농도 조건. 입력 농도는 온도별 고용도로 제한.
- Drive-in: Si 경계 무유속. 기존 B/P를 각각 확산하며 종별 총량 보존 검사.
- 실제 native Si 셀로 2D 유한체적 격자를 구성. 10 nm 공간 간격, 48개 backward-Euler 시간 간격, SciPy LU solver.
- `annealing.csv`의 B/P Arrhenius 계수와 평형 활성화 사용. 비 Si 막 완전 차단. 등온 고유 확산 근사이며 TED·계면 편석·가스 화학 미포함. 고용도 계수는 1000 °C 이상 문헌 피팅이며 950 °C 입력은 외삽.
- Diffusion에 Pre-deposition / Drive-in 관찰 예제와 역설계 목표 추가. 연속 단계 편집, 농도 표시, 저장·복구, 채점 이력에 연결.

## 확인 결과

| 검증 | 결과 |
|---|---|
| `tests/diffusion-physics.py` 7개 | 통과 |
| 평면 erfc 농도 및 적분 dose 비교 | 각 상대 기준 오차 0.8% 미만 |
| Drive-in B/P 종별 보존, peak 감소, 깊이 확장 | 통과 |
| 반복 300+300 s / 단일 600 s | 최대 농도 차이 / Cs 0.4% 미만 |
| 마스크 아래 측방 확산 / 비 Si 차단 / 밀폐 void | 통과 |
| B/P 계수 차이, 고용도 상한 | 통과 |
| `tests/diffusion-native.py` 6개 | 통과 |
| 도펀트 없는 Drive-in / PR 잔존 / 완전 산화막 차폐 | 예상한 단계 오류로 차단 |
| 1100 °C·3600 s·B 고농도 / 반복 확산 | 정상 계산 |
| Implant → Drive-in → native Anneal → 증착 | 농도 보존·형상 연결 정상 |
| 기존 MOSFET 전체 18공정 / 19프레임 | 정상, 측정 24.31초(프로세스 시작 포함) |
| Pre-deposition 기본 예제 | 6프레임, 측정 9.63초(프로세스 시작 포함) |
| Drive-in 기본 예제 | 7프레임, 측정 17.67초(프로세스 시작 포함) |
| Drive-in 기본 예제 내부 총량 상대 오차 | 1.11×10⁻¹⁴ |
| `npm test` | 채점·농도 누락 감점·저장 복구·렌더링·UI 계약·미리보기 전체 통과 |
| `npm run build`, JS syntax, `git diff --check` | 통과 |
| 실제 localhost 브라우저 | Pre-deposition 계산 4.03초, 사용자 추가 Drive-in 전체 flow 8.1초 |
| 브라우저 역설계 | 예시 적용 → Diffusion 추가 → Drive-in 선택 → 온도·시간 수정 → 계산 완료 |
| 브라우저 중간 단계 | STEP 5 선택 후 재계산해도 선택 유지 |

측정 시간은 캐시 여부, 실행 환경과 형상에 따라 달라지므로 성능 보증이 아니다. 새 예제 기준 결과만 생성했고 기존 소자 기준 결과는 덮어쓰지 않았다. 외부 AI API 호출 없이 로컬 계산을 검증했다.

## 재실행

```powershell
.venv/Scripts/python.exe tests/diffusion-physics.py
.venv/Scripts/python.exe tests/diffusion-native.py
npm test
npm run build
```

FiPy 수치 방법: https://pages.nist.gov/fipy/en/stable/generated/examples.diffusion.mesh1D.html
