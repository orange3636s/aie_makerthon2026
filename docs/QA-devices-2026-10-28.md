# 소자 확장 검증 · 2026-10-28

범위: 관찰 29종, 역설계 14종. 외부 LLM API 호출·분류 정확도는 제외했다. 제조사 구조 근거와 모델 한계는 [DEVICE-SOURCES.md](DEVICE-SOURCES.md)에 기록했다.

## 자동 검사

| 검사 | 결과 | 주요 확인 내용 |
|---|---:|---|
| `tests/advanced_devices.py` | 75/75 PASS | 8개 소자의 기본값, 각 수치 최소·최대, 전체 최소·최대 조합, 닫힌 경계·유한 좌표, 레퍼런스/카탈로그 일치 |
| `tests/scenarios.py` | 48/48 PASS | 29개 관찰 예제 전체 실행, PR 극성·패턴, 식각 방향성, PVD/CVD/ALD, 농도 보존, 잘못된 공정의 실패와 복구 |
| `tests/native_flows.py` | 14개 flow PASS | 정답 recipe를 역설계 엔진으로 다시 계산, 단계 수·재료 경계·주입 데이터 확인 |
| `tests/api.cjs` | 32/32 PASS | 8개 새 reference 경로, 하이픈 ID, 입력·횟수 범위, 캐시, 원점 검증, 실패 후 복구 |
| `npm test` | PASS | 14개 정답 자기 비교 100점, 초기 기판/재료 누락/좌표 이동 감점, PN 극성·주입량 감점, draft 복원·라벨 보존, 7개 수치 표시 왕복 |
| `npm run build`, `git diff --check` | PASS | 정적 자산 빌드와 공백 오류 |

원시 결과: [qa-device-results.json](qa-device-results.json). 75개 중 1개는 카탈로그 정합 검사이고 나머지는 native 계산이다. 경계값을 통과했다고 모든 임의 사용자 flow나 상용 공정 정확도가 검증된 것은 아니다.

## 계산에서 발견해 수정한 오류

- **BCAT 주입 차단**: pad nitride 위 oxide가 남은 상태에서 nitride를 먼저 식각하면 Si가 노출되지 않았다. Exposed oxide 제거 후 cap/pad etchback으로 순서를 고쳤다. 최종 buried metal과 cap, S/D 농도 존재를 확인했다.
- **SOI handle 오염**: 동일한 Si 재료로 취급한 BOX 아래 기판에서 Pearson 분포가 다시 나타났다. Native `BulkSi`로 수동 handle을 분리하고 표시만 Si로 통일했다. BOX와 handle의 주입 농도가 0이며 top body에 농도가 남는지 검사했다.
- **PN 형상만으로 고득점**: bare Si와 PN 단면 형상이 같아지는 문제를 총 순 도핑 분포 채점으로 수정했다. 무도핑/반대 극성/주입량·위치 변경을 검사했다.
- **새 목표 경로**: `pn-junction`, `charge-trap`처럼 하이픈이 있는 ID를 reference 라우트에서 허용하고 카탈로그에 없는 ID는 계속 거부한다.
- **flow 이름 소실**: 서버 검증·draft 저장/복원·정답 적용에서 공정별 역할 이름을 보존한다. 이름 타입과 길이를 검증하고 UI에서 HTML escape한다.

CFET는 상하 gate의 수직 분리 간격, GAAFET/CFET는 SiGe 제거 후 Si 채널의 잔존, SONOS는 tunnel / trap / blocking oxide 순서, RCAT는 Si 표면을 가로지르는 recess gate를 수치로 검사했다.

## 실제 브라우저 시나리오

- CFET 22프레임 자동 재생: 상단으로 스크롤한 뒤 12→22프레임 진행 동안 `scrollY=0` 유지. 가로 flow만 이동한다.
- CFET 정답 적용 → 100점. 마지막 gate ALD를 35→55 cycle로 변경하고 재계산 → 93점, 금속 IoU 71%.
- 마지막 flow 삭제 → 남은 완료 단계 사용. 중간 STEP 12 삭제 → 이후 단계 미계산, 19공정 중 11단계만 유효, 평가 버튼 비활성화.
- FD-SOI 역설계 진입 → 시작 단면과 START 라벨에 SOI wafer / BOX 표시.
- PN 정답 적용 → 100점. P 주입량만 10¹³→10¹¹ ions/cm²로 변경하고 재계산 → 86점, 순 도핑 유사도 82%.
- PN 목표와 내 구조 모두 같은 총 순 도핑 색 기준을 사용한다. 도핑 보기에서 무도핑 Si는 중립색으로 표시한다.
- 375 / 768 / 1024 px 실제 iframe viewport 검사: 가로 문서 넘침 및 버튼·수치·선택기 텍스트 넘침 없음. 375 px에서 역설계 ALD 편집기를 추가 확인했다.
- 예제가 많아진 모바일 메뉴는 높이 260 px 이내의 독립 스크롤 영역으로 조정했다. 긴 소자/flow 이름은 줄바꿈하며 14개 이미지 목표 선택 버튼은 2열로 배치한다.
- Charge Trap Flash tutorial의 Samsung / SK hynix 출처 링크와 평면 SONOS / 3D NAND 구분을 확인했다. 현재 단계에 존재하는 재료만 관찰 화면 범례에 표시한다.

로컬 Windows native runtime으로 수행한 검증 기록이다. 배포 환경의 실행 확인은 배포 후 별도로 진행한다. 전기 특성, 제조사 장비 보정, LLM 이미지 분류 정확도에 대한 검증 결과로 사용하면 안 된다.
