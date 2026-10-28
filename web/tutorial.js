'use strict';
const requestedGuide=location.hash==='#reverse';
const notes={
wet:['마스크 사이에서 식각이 시작되는 폭입니다.','결정면별 속도에서 식각되는 시간을 바꿉니다.','(110) 면의 상대 속도를 바꾸어 결정면 경사를 비교합니다.'],
rie:['두 개구의 폭입니다.','방향성 속도장에 적용할 시간입니다.','수직 깊이 변화의 유효 속도입니다.','0이면 수직 성분만 사용합니다. 커질수록 언더컷이 늘어납니다.'],
sf6:['2D 홀 단면의 마스크 개구 폭입니다.','측벽 보호 반응에 공급되는 산소종 플럭스입니다.','입사 이온의 평균 에너지입니다.','SF₆/O₂ 모델을 진행하는 총 시간입니다.'],
bosch:['트렌치 입구 폭입니다.','증착·바닥 개방·식각의 반복 횟수입니다. 화면에는 큰 단계만 표시합니다.','한 사이클의 식각 시간으로 scallop 크기와 깊이에 영향을 줍니다.','사이클마다 쌓는 이상적 보호막 두께입니다.'],
cryo:['식각 입구의 폭입니다.','깊이 = 시간 × 유효 식각률로 계산합니다.','실험 보정값이 아닌 사용자가 지정하는 유효 수직 속도입니다.','기판면 기준 측벽 각도입니다. 90°이면 수직입니다.'],
stack:['적층을 뚫는 입구 폭입니다.','0.25 µm 두께의 산화막·질화막 총 층수입니다.','재료별 속도로 각 층을 통과하는 시간입니다.','질화막 속도 / 고정 산화막 속도(0.5 µm/s) 비율입니다.'],
regrowth:['Si₃N₄/SiO₂ 적층 수입니다.','질화막 측방 식각과 부산물 수송이 진행되는 시간입니다.','부산물이 다시 붙는 양을 조절하는 모델 계수입니다.'],
lele:['첫 패턴 중심 간격입니다. 두 번째 패턴은 그 절반 위치에 놓입니다.','각 패턴의 선폭입니다.','두 번째 패턴의 이동량입니다. 최종 간격의 불균일성을 비교합니다.'],
sadp:['Mandrel 중심 간격입니다.','제거 전 희생 패턴의 폭입니다.','등각 증착 두께이며 최종 잔존 선폭입니다.'],
sti:['트렌치 상부 개구 폭입니다.','트렌치 바닥의 깊이입니다.','트렌치를 SiO₂로 채우는 CVD 시간입니다. 부족하면 CMP 후 빈 공간이 남을 수 있습니다.'],
locos:['좌우 Si₃N₄ 마스크의 두께입니다.','습식 산화 모델의 온도입니다.','선택 열산화의 총 시간입니다.'],
fin:['Fin 상부 폭입니다.','주변 Si를 제거하는 깊이입니다.','전체 식각 깊이 중 STI 위로 노출할 높이 비율입니다.'],
mosfet:['게이트의 수평 길이입니다.','게이트 아래 지정 산화막 두께입니다.','게이트 측벽 스페이서의 증착 두께입니다.'],
finfet:['게이트 중심 횡단면의 fin 폭입니다.','Si fin 전체 식각 깊이입니다.','fin을 감싸는 HfO₂ 두께입니다.','HfO₂ 위의 등각 게이트 두께입니다.'],
mbcfet:['분리해 남길 Si 채널 개수입니다.','각 nanosheet의 폭입니다.','각 Si 채널 두께입니다.','제거할 SiGe 층의 두께이며 최종 채널 사이 간격입니다.'],
planarization:['증착 전 패턴이 기판 위로 올라온 높이입니다.','단차를 따라 덮이는 박막 두께입니다.','Global CMP의 절단 높이입니다. 패턴보다 낮으면 패턴도 함께 잘립니다.']
};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
fetch('/api/catalog').then(r=>r.json()).then(({examples})=>{
const nav=document.getElementById('tutorial-nav');let selected,open;
function renderNav(){nav.innerHTML=['Photo','Etch','Deposition','Diffusion','C&C','구조','소자'].filter(g=>examples.some(e=>e.group===g)).map((group,i)=>`<section class="theme-group"><button class="theme-toggle" aria-expanded="${open===group}" aria-controls="tutorial-group-${i}" data-group="${esc(group)}"><span>${esc(group)}</span><span class="chevron">⌄</span></button><div id="tutorial-group-${i}" class="theme-items" ${open===group?'':'hidden'}>${examples.filter(e=>e.group===group).map(e=>`<button class="nav-item ${selected.id===e.id?'active':''}" data-id="${e.id}">${esc(e.title)}</button>`).join('')}</div></section>`).join('');nav.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{open=open===b.dataset.group?null:b.dataset.group;renderNav()});nav.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>choose(b.dataset.id));}
function choose(id,keepHash=false){selected=examples.find(e=>e.id===id)||examples[0];open=selected.group;if(!keepHash)history.replaceState(null,'','#'+selected.id);renderNav();document.getElementById('detail-title').textContent=selected.title;
document.getElementById('parameter-detail').innerHTML=`<div class="example-note"><strong>${selected.mode==='physics'?'공정 모델':selected.mode==='effective'?'유효 속도 모델':'교육용 형상 모델'}</strong><p>${esc(selected.note.replaceAll('ViennaPS','level-set'))}</p></div>${selected.sources?.length?`<details class="source-details"><summary>구조·공정 참고 자료</summary>${selected.sources.map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><small> · ${esc(s.figure)}</small></p>`).join('')}<p class="caption">공개 도면을 참고한 학습 단면입니다. 치수·시간은 계산 격자에 맞춘 교육 조건이며 제조사 레시피가 아닙니다.</p></details>`:''}<div class="table-scroll"><table><thead><tr><th>파라미터</th><th>범위 · 기본값</th><th>변화 관찰</th></tr></thead><tbody>${selected.fields.map((f,i)=>`<tr><td>${esc(f.label)}</td><td>${f.options?f.options.map(esc).join(' / '):f.min+' ~ '+f.max+' '+esc(f.unit||'')}<small>기본 ${esc(f.default)} ${esc(f.unit||'')}</small></td><td class="param-description">${esc(f.description||notes[selected.id]?.[selected.fields[0]?.key==='section'?i-1:i]||'지정 조건에 따른 구조 변화를 비교합니다.')}</td></tr>`).join('')}</tbody></table></div><p class="caption">2.5D는 계산된 2D 단면에 표시용 깊이를 더한 보기입니다. 소자 예제는 공정 형상을 보여주며 I–V 전기 특성을 계산하지 않습니다.</p><a class="button primary" style="margin-top:20px" href="/#${selected.id}">이 예제 열기 →</a>`;}
document.querySelector('.tutorial-table').hidden=true;document.querySelector('.tutorial-cards').hidden=true;
choose(requestedGuide?'mosfet':location.hash.slice(1)||'mosfet',requestedGuide);
}).catch(()=>document.getElementById('parameter-detail').textContent='예제를 불러오지 못했습니다. 서버를 확인하세요.');
