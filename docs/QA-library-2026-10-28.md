# 라이브러리 확장 및 스크롤·반응형 검증

2026-10-28. 기존 16종에 6종을 추가하여 22종. 이번 검증에서 외부 LLM API는 호출하지 않았다. 이전 QA 기록의 182건과 아래 신규 검증은 별도로 보존한다.

## 추가 예제

| 테마 | 예제 | 실행 모델 · 주요 변수 |
|---|---|---|
| Deposition | PVD Trench Deposition | native SingleParticleProcess · 폭, 깊이, 시간, 부착 확률, 입사 방향성 |
| Deposition | CVD Trench Fill | 같은 native 유효 입자 모델의 CVD 조건 · 3개 증착 구간 |
| Deposition | Atomic Layer Deposition | native SingleParticleALD · 폭, 깊이, 사이클, 펄스, 초기 부착 확률 |
| Diffusion | Masked Ion Implantation | native IonImplantation · B/P, 공개 데이터 7개 에너지, dose, 창 폭 |
| Diffusion | Thermal Anneal | native Anneal · B/P, dose, 온도, 시간; 25/50/100% 시간 비교 |
| Diffusion | PN Junction | 왼쪽 P 30 keV / 오른쪽 B 10 keV 순차 주입 후 열처리 · 각 dose, 온도, 시간 |

공식 모델·예제를 플랫폼의 격자와 지원 조건에 맞춰 구성했다. PVD/CVD는 장비별 반응 화학이 아닌 유효 입자 수송 모델이며 PN 접합은 농도 분포만 계산한다. 가정·고정값은 catalog의 note와 tutorial에 기록했다. 기존의 6개 역설계 목표와 정답 recipe는 변경하지 않았다.

## 검증 결과

- 신규 예제 77건: 기본값, 각 숫자 조건의 최소/최대, 모든 선택값, 전체 최소/최대 조합. 모두 통과.
- 검사: 유한 좌표·닫힌 경계·유효 프레임, 증착막 성장, Si 밖 도핑 없음, 열처리 총량 상대 오차 0.5% 미만, 열처리 후 피크 비증가, PN 양/음 농도 동시 존재.
- 물리 경향 5건 재검증: 반복 dose 누적, 에너지 증가 시 평균 깊이 증가, B/P 보상, ALD 사이클 성장, CVD/PVD 측벽 피복. 모두 통과.
- npm test: 6종 목표 채점, 빈 기판/누락/위치 이동, 저장 flow 복구, 개별 단계 삭제 후 채점 무효화 통과.
- 실제 HTTP 24건: 입력 범위·잘못된 도펀트/에너지·부분 사이클 거절, cache, 실패와 복구, 출처 검증. 외부 LLM 요청 제외.
- 브라우저: B 및 100 keV 선택 → 실제 계산, 열처리 전 활성 농도 미계산 표시, PN 결과의 p/n 분포, tutorial 선택형 변수, console error 없음 확인.
- 반응형: 실제 375/768/1024px iframe viewport에서 문서 가로 넘침 0, 버튼·label·단위·select 내부 가림 0. 데스크톱 1280px도 확인.
- 자동 재생: CVD 1→7단계 재생 중 사용자가 위로 이동. scrollY=0 유지, timeline 가로 위치만 0→248.8px 이동.

개별 실행 결과는 `qa-library-results.json`에 보존했다. 새 예제의 로컬 계산 시간 최대 8.01초는 이 PC에서의 측정이며 배포 서버의 속도 보장이 아니다.

## 발견·수정한 결함

1. autoplay의 scrollIntoView가 문서까지 아래로 이동 → timeline.scrollLeft만 변경. 역설계 공정 추가도 동일하게 수직 이동 제거.
2. 0.3초를 세 구간으로 나누면 0.099999…가 되어 최소 0.1초 검증 실패 → 구간 시간 반올림. 실패 4개 조건 재검증 통과.
3. 651~850px에서 옛 block 레이아웃과 sticky sidebar 규칙 충돌 → 일관된 grid, sidebar 독립 스크롤.
4. 긴 예제명·농도 수치·단위 → 줄바꿈, 글자 크기·대비 개선, e 표기, tutorial 표 내부 가로 스크롤.
5. 최초 계산 요청 실패 뒤 flow에 계산 중 문구가 남음 → 재실행 안내로 변경, 버튼 복구 확인.
6. 농도 셀의 alpha 중첩으로 격자선처럼 보임 → 불투명 합성색으로 표시. 총/활성 농도 선택, 공정 썸네일에 총 농도 표시.

## 출처

- https://viennatools.github.io/ViennaPS/models/prebuilt/singleParticle.html
- https://github.com/ViennaTools/ViennaPS/tree/master/examples/atomicLayerDeposition
- https://github.com/ViennaTools/ViennaPS/tree/master/examples/ionImplantation
- https://viennatools.github.io/ViennaPS/models/prebuilt/anneal.html
- https://github.com/ViennaTools/ViennaPS/tree/master/examples/pnJunction

실험 데이터나 상용 TCAD와의 정확도 검증은 이 테스트에 포함되지 않는다.
