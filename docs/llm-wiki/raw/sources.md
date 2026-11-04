# 프로젝트 근거 자료

## 저장소 근거

아래 링크는 같은 기준 버전의 소스와 데이터를 가리킨다.

- [MOSFET 기본 레시피](https://github.com/orange3636s/aie_makerthon2026/blob/7fb1108/references/mosfet.json) — 게이트 형성, S/D 주입·활성화 순서.
- [PVD 기본 단면](https://github.com/orange3636s/aie_makerthon2026/blob/7fb1108/references/pvd.json) — 마지막 프레임의 `metrics.topGrowthUm`, `sideGrowthUm`, `stepCoverage`. 길이는 µm에서 nm로 변환한다.
- [MBCFET 기본 단면](https://github.com/orange3636s/aie_makerthon2026/blob/7fb1108/references/mbcfet.json) — 45·46단계의 Mo 채움과 연마.
- [채널과 SOI 구조 검증](https://github.com/orange3636s/aie_makerthon2026/blob/7fb1108/tests/device-topology.cjs) — 시트 수, 게이트 피복, BOX 및 상부 Si.
- [소자 전류 모델](https://github.com/orange3636s/aie_makerthon2026/blob/7fb1108/web/learning-lab-models.js) — 장채널 MOSFET, PN 접합의 모델 가정.
- [공정 설계 배점](https://github.com/orange3636s/aie_makerthon2026/blob/7fb1108/web/learning-score.js) — 과제별 가중치와 필수 검사.

## 위키 설계

자료 목록, 연결된 해설, 운영 규칙을 분리하는 방식은 [Andrej Karpathy의 LLM Wiki 원문](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)을 참고했다.
