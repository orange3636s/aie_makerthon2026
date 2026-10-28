# ProcessTrace — Gemini·도핑·콘택 검증 (2026-10-28)

## 변경

- Gemini REST generateContent, 서버 전용 키, 이미지 추천·공정 분석 팝업. Upstage 연동 제거.
- 실제 native 예제 단면 14개를 이미지 추천의 시각적 기준으로 제공. 추천 확인 후 목표 선택; 기존 흐름을 바로 지우지 않음.
- 물질 팔레트 통일, HfO₂/TiN/W/Co/Mo 명시, ProcessTrace 브랜드.
- MOSFET·FD/PD SOI·RCAT·BCAT·CTF·PN의 도핑·활성화·콘택. Fin/GAA/MBC/CFET은 독립 S/D 국소 단면 제공.
- 공정 재계산 시 선택 단계를 유지. 분석 결과는 최종 계산으로 평가하되 현재 표시 단계는 변경하지 않음.

## 실제 계산 검증

`tests/device-details.py`: 7개 기본 도핑 소자 + 5개 독립 S/D 단면에서 콘택 금속 존재, 양쪽 활성 도핑, 기준 100점, 금속 제거 감점 확인. 모든 항목 통과.

| 모든 diffusion 제거 후 native 재계산 | 점수 |
|---|---:|
| MOSFET | 50 |
| RCAT | 50 |
| Charge Trap Flash | 50 |
| FINFET S/D | 50 |
| MBCFET S/D | 50 |
| CFET n형 S/D | 50 |
| CFET p형 S/D | 50 |

BCAT 한쪽 주입이 캡에 차단되는 문제를 발견하여 노출된 Si에서 S/D를 먼저 주입·활성화하도록 수정. 최종 양쪽 활성농도 최대 약 2.96e18 cm⁻³. BCAT 깊이 0.24/0.38 µm, FINFET S/D dose 1e12, MBCFET dose 1e14/anneal 120 s, CFET p형 anneal 1 s, FD-SOI body 0.03 µm, PD-SOI body 0.22 µm의 7조건 모두 failure=null, 활성 농도 필드 존재. 허용 범위 밖 BCAT 깊이 0.65 µm는 입력 검증에서 거부됨.

`npm test`: 14개 목표 채점, 농도·활성화·공정 이력 누락, compensation 및 polarity, draft 복원, 단계 삭제, PVD/CVD 조건 복원, 숫자 표시, 2.5D 가림, flow 비교, Gemini 결과 검증을 통과.

## Gemini 실호출

- 키 인증 성공. `gemini-3.8-flash`는 당시 503 혼잡 응답. 검증 가능한 `gemini-3.5-flash-lite`를 기본값으로 선택.
- 기준과 동일한 MOSFET: 차이 0, AI suggestions 없음.
- 도핑/열처리 제거: 정확히 2개 누락 후보와 활성화 설명. 초기 응답에서 원소 P를 p형으로 오해하여 원소·도너 정보 및 전체 공정 조건을 프롬프트에 명시하고 재검증. 최종 테스트는 P를 n형 donor로 설명.
- 기판만: 17개 누락을 기본 표에서 식별, AI는 주요 5개 이하만 설명.
- 수치 점수는 AI와 별도 계산. 잘못된 finding ID, 중복, 빈 응답, 형식 오류, 인증 실패, timeout은 기본 분석 표로 복구.

| 이미지 시험 | 결과 |
|---|---|
| native MOSFET 단면 | MOSFET 추천 |
| native FINFET 단면 | FINFET 추천 |
| native MBCFET 단면 | MBCFET 추천 |
| native STI 단면 | STI 추천 |
| 빈 이미지 | unknown |
| 사용자의 작은 무표기 MOSFET 도면 | RCAT 오분류 (미해결 인식 한계) |

이 결과는 학습 예제 매칭의 기능 시험이지 SEM 벤치마크 정확도가 아니다. 무표기 도면 오분류가 있어 추천을 확정 판정으로 표시하지 않고 사용자 선택을 받는다. 실제 SEM/TEM에 대한 일반화 성능은 검증되지 않았다.

## 브라우저

- MOSFET 정답 적용 → diffusion 2단계 개별 삭제 → STEP 3 선택 → native 재계산 → STEP 3 유지 → 50점 팝업 → Gemini 누락 두 행 확인.
- MBCFET 이미지의 브라우저 File 이벤트 테스트 → Gemini MBCFET 추천 → 추천 클릭 → Si substrate와 0공정으로 시작.
- 관찰 모드에서 이미지 팝업이 숨겨지는 버그 수정: 숨겨진 역설계 영역 밖으로 dialog 이동.
- MBCFET n형 S/D 단면 정답 → 100점 및 차이 없음 Gemini 분석.
- 실제 iframe 폭 375/768/1024 px에서 버튼·라벨·select와 페이지의 가로 overflow 없음. 분석 팝업을 하나의 스크롤 영역으로 정리하여 확인 버튼 유지.
- Chrome 확장 파일 URL 권한 제한으로 OS 파일 선택기부터의 자동 업로드는 완료하지 못함. 대신 로컬 전용 QA fixture의 File 객체로 선택 이후 처리·API·추천·초기화를 검증. QA 페이지는 Git/Docker에서 제외.

## 해석 범위

S/D 국소 단면은 게이트 횡단면과 독립된 2D 교육 모듈이며 실제 3D Fin/GAA를 연결하여 해석하지 않는다. W/Co/Mo는 공개 동향을 참고한 교육 예제 선택으로 재료별 접촉저항·실리사이드·장벽층·전기 동작은 미계산. AI는 기준 flow의 편집 차이를 설명하며 대체 공정의 타당성이나 양산 가능성을 증명하지 않는다.
