# 소자 예제의 설계 근거

공개 제조사 자료의 구조를 참고하고, 현재 엔진에서 실행 가능한 공정으로 재구성했다. 제조사 이미지 파일을 앱에 복제하지 않으며 모든 표시 단면은 native 계산 결과다. 제조사 공개 구조와 아래 교육용 공정 조건을 구분해야 한다. 치수는 10 nm 격자에서 관찰하도록 확대한 값이고, 공개 도면으로 비공개 양산 레시피를 추정하지 않았다.

| 예제 | 공개 1차 자료 | 반영한 구조 | 구현한 flow |
|---|---|---|---|
| RCAT | [Samsung US7361537B2](https://patents.google.com/patent/US7361537B2/en) | recessed channel, 절연막, recess 안팎의 게이트 | 17공정: hardmask → 개구 → Si recess → gate dielectric → fill / etchback / pattern → spacer → S/D 주입·열처리 |
| BCAT | [Samsung US20150221742A1, Fig. 1](https://patents.google.com/patent/US20150221742A1/en) | Si 표면 아래 gate와 nitride cap | 15공정: hardmask / recess → dielectric → gate fill / CMP / recess → cap / CMP / 표면막 제거 → S/D 주입·열처리 |
| FD-SOI FET | [STMicroelectronics FD-SOI](https://www.st.com/content/st_com/en/about/innovation-and-technology/fd-soi.html) | 얇은 top Si와 BOX, handle wafer | 준비된 SOI 기판 + 10공정: gate stack → 패턴 / etch → spacer → 주입·열처리 |
| PD-SOI FET | [IBM US7460422B2, Fig. 1](https://patents.google.com/patent/US7460422B2/en) | 두꺼운 Si body와 BOX | 준비된 SOI 기판 + 10공정. FD 예제와 body 두께를 비교 |
| GAAFET · Nanowire | [Samsung GAA DTCO, Fig. 4](https://semiconductor.samsung.com/news-events/tech-blog/gaa-dtco-for-ppa/) | nanowire 주위를 감싸는 high-k / gate | 9공정: SiGe / Si 층 → wire pattern / etch → SiGe release → high-k → wrap gate |
| CFET | [Intel IEDM 2023 공개 자료, p. 3](https://download.intel.com/newsroom/archive/2025/en-us-2023-12-09-intel-demonstrates-breakthroughs-in-nextgeneration-transistor-scaling-for-future-nodes.pdf) | 위아래로 쌓인 채널과 게이트 | 21공정: lower FET 모듈 → 층간 절연 / CMP / cap → upper FET 모듈 |
| Charge Trap Flash | [Samsung SONOS 공개 특허, Fig. 1](https://patents.google.com/patent/US20060043469A1/en) | 평면 SONOS의 tunnel oxide / charge-trap nitride / blocking oxide / control gate | 12공정: ONO 순차 증착 → control gate / cell pattern → 층별 etch → 주입·열처리 |
| PN Junction | [Toshiba 반도체 기초 자료](https://toshiba-semicon-storage.com/content/dam/toshiba-ss-v3/master/en/semiconductor/knowledge/e-learning/discrete/discrete-basic-chap1_en.pdf) | p형 / n형 영역과 접합 | 7공정: 좌측 개구 / P 주입 / PR 제거 → 우측 개구 / B 주입 / PR 제거 → 열처리 |

Charge Trap Flash의 ONO 재료 역할은 [SK hynix NAND cell-formation 도해](https://news.skhynix.com/en/research-inside-ep1/)와도 대조했다. 해당 도해는 수직 3D NAND이다. 앱의 현재 예제는 **평면 SONOS 단일 셀**이며 수직 NAND 전체 string, replacement gate, charge-trap isolation을 구현했다고 주장하지 않는다. Samsung 특허 Fig. 1도 일반적인 SONOS 구조를 설명하는 prior-art 도면이다.

## 계산과 가정

- RCAT/BCAT의 recess와 gate etchback은 `DirectionalProcess`, fill은 `SingleParticleProcess`, 절연막·spacer는 `SingleParticleALD`, CMP는 `Planarize`를 실행한다. Fill의 입사 방향성·부착 확률은 교육용 유효 조건이며 장비별 poly-Si / metal 증착 recipe가 아니다. BCAT의 다중 gate 금속·air gap 변형은 포함하지 않는다.
- FD/PD-SOI의 시작 웨이퍼는 native plane geometry로 정의한다. BOX 0.15 µm, FD body 0.03–0.06 µm, PD body 0.12–0.22 µm. `BulkSi`로 구분한 handle은 수동 차폐 영역이고 표시 색은 Si와 같다. 이 구분은 주입 분포가 BOX 아래 Si에서 다시 시작되는 오류를 막는다. SOI 제작의 bonding / layer transfer는 시뮬레이션하지 않는다.
- FD/PD는 얇은/두꺼운 body 학습 템플릿의 이름이다. 실제 공핍 상태는 농도, 바이어스, 전위 해석에 의존하므로 구조 그림만으로 검증하지 않는다. 시판 FD-SOI의 7 nm급 body를 이 격자에서 정밀하게 계산한다고 주장하지 않는다.
- GAAFET은 단일 nanowire 단면으로 기존 MBCFET nanosheet 예제와 구분한다. SiGe release는 전체 선택 재료 제거 연산이다. Si/SiGe 적층의 **형상 성장**을 계산하며 결정성·strain·선택 에피택시 화학은 계산하지 않는다. 화면 밖 source/drain이 채널을 지지한다고 가정한다.
- CFET은 Intel의 수직 complementary 구조 개념을 참고한 **순차 적층 교육 단면**이다. Intel의 monolithic 양산 공정 순서를 재현한 것이 아니다. 상부 결정층 형성은 준비된 층의 형상 근사이며, 상하 N/P 동작·일함수 조절·접촉·backside power는 포함하지 않는다. 상하 gate가 실제로 분리되는지는 단면 수치로 검사한다.
- SONOS의 ONO 층 순서와 gate 형상은 계산한다. 전하 포획·보존, 터널링, program/erase, endurance는 계산하지 않는다.
- 주입·열처리는 공개 B/P dual-Pearson IV 데이터와 native `IonImplantation` / `Anneal`을 사용한다. 농도는 형상 위에 겹쳐서 표시한다. PN은 lateral 학습 recipe이며 Toshiba의 특정 제품 제조 recipe가 아니다. I–V, 공핍층 폭, breakdown은 계산하지 않는다.
- 2.5D는 계산된 2D 단면에 표시용 깊이를 준 보기다. 3D 전기 해석으로 해석하면 안 된다.

## 채점

일반 소자는 동일한 물리 좌표의 ROI에서 재료별 IoU를 사용한다. Si 가중치는 0.25이고 나머지 재료는 1이다. SOI 시작 기판은 이미 올바른 BOX를 갖고 있으므로 그 부분에는 부분 점수가 생긴다.

PN Junction은 형상만 비교하면 모든 bare Si가 동일해지는 문제가 있다. 따라서 **형상 20% + 총 순 도펀트 분포 80%**로 평가한다. 총 순 농도의 부호(P−B)와 log 크기(10¹⁴–10²⁰ cm⁻³)를 고정 ROI의 160×160 표본에서 비교한다. 극성 반전, 위치 이동, 주입량 차이, 무도핑 기판이 감점되는지 테스트한다. 전기 성능, 수율, 제조 가능성을 인증하는 점수는 아니다.
