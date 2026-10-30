 'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(() => {
 const lessons=[
  ['Trench 예제를 열어보세요.','상단의 Trench 실습 시작을 누르세요. Workspace에서는 왼쪽 예제 목록에서 Trench를 선택할 수도 있습니다.','처음 계산이 끝나면 단면과 Process flow가 나타납니다.','library'],
  ['공정 이름과 꺾쇠는 역할이 달라요.','Process flow에서 증착 단계를 누르면 그 시점의 단면을 봅니다. 오른쪽 꺾쇠를 눌러 입력 항목을 펼치세요.','변경 전에 ‘기준으로 저장’을 누르면 지금 결과를 비교 기준으로 남길 수 있습니다.','flow'],
  ['증착 시간만 조금 늘려보세요.','증착 시간의 숫자 입력 또는 슬라이더로 현재 값보다 약 20% 늘립니다. 나머지 조건은 그대로 두세요.','입력값만 바꾼 상태입니다. 아직 새 조건의 계산 결과는 아닙니다.','field'],
  ['계산한 다음, 차이를 확인하세요.','‘공정 계산’을 누르고 완료를 기다리세요. ‘기준 겹치기’를 켜서 저장한 단면과 새 결과를 비교하세요.','입구·벽·바닥 중 어디에 막이 더 쌓였는지 살펴보세요. 한 번에 한 변수만 바꾸면 이유를 찾기 쉽습니다.','calculate'],
  ['이번에는 나만의 순서를 만들어보세요.','‘역설계’를 선택하고 목표 스펙을 읽으세요. Wafer 아래 ＋로 공정을 추가하고, 계산 후 ‘공정 설계 평가’를 누릅니다.','먼저 간단한 구조부터 시작하세요. 막히면 예제 flow와 비교하거나 AI 튜터에게 현재 단계에 대해 질문하세요.','design']
 ];
 let current=0;
 const buttons=[...document.querySelectorAll('[data-lesson]')],prev=document.getElementById('lesson-prev'),next=document.getElementById('lesson-next');
 function draw(){
  const [title,action,result,focus]=lessons[current];
  buttons.forEach((b,i)=>{if(i===current)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});
  document.getElementById('lesson-copy').innerHTML=`<h3>${esc(title)}</h3><p>${esc(action)}</p><p class="lesson-result">${esc(result)}</p>`;
  const mark=part=>focus===part?' mock-focus':'';
  document.getElementById('lesson-preview').innerHTML=`<div class="mock-title"><strong>Workspace / Trench</strong><span>${focus==='design'?'역설계':'실험실'}</span></div><div class="mock-workspace"><div class="mock-library${mark('library')}"><span>예제 목록</span><span>Line pattern</span><span class="mock-active">Trench</span><span>STI</span></div><div class="mock-view"><svg viewBox="0 0 240 160" role="img" aria-label="트렌치 증착 단면 조작 안내도"><path d="M20 45h65v62h70V45h65v96H20z" fill="#d9e2ee"/><path d="M20 40h70v62h60V40h70" stroke="#6498ed" stroke-width="${current===3?16:9}" fill="none"/>${current===3?'<path d="M20 40h70v62h60V40h70" stroke="#324666" stroke-dasharray="4 4" fill="none"/>':''}</svg></div><div class="mock-flow${mark('flow')}"><b>Process flow</b><span>01 Wafer</span><span class="mock-active">02 PVD · SiO₂　⌄</span><div class="mock-field${mark('field')}"><span>증착 시간 · s</span><strong>${current>=2?'기준값 × 1.2':'기준값'}</strong></div><div class="mock-action${mark('calculate')}">${focus==='design'?'＋ 공정 추가':'공정 계산'}</div></div></div><p class="mock-caption">조작 안내도 · 실제 계산은 Workspace에서 진행합니다.</p>`;
  document.getElementById('lesson-progress').textContent=`${current+1} / ${lessons.length}`;
  prev.disabled=current===0;next.disabled=current===lessons.length-1;
 }
 buttons.forEach(b=>b.addEventListener('click',()=>{current=Number(b.dataset.lesson);draw()}));
 prev.addEventListener('click',()=>{current=Math.max(0,current-1);draw()});
 next.addEventListener('click',()=>{current=Math.min(lessons.length-1,current+1);draw()});
 draw();
})();
Promise.all([fetch('/api/catalog').then(r=>{if(!r.ok)throw Error();return r.json()}),fetch('/api/reverse-catalog').then(r=>{if(!r.ok)throw Error();return r.json()})]).then(([{examples},{targets}])=>{
 const nav=document.getElementById('tutorial-nav');let selected,open;
 function renderNav(){nav.innerHTML=ProcessUI.groups.map(g=>`<div><button class="theme-toggle" data-group="${esc(g)}" aria-expanded="${open===g}">${esc(g)} <span>⌄</span></button><div ${open===g?'':'hidden'}>${examples.filter(e=>ProcessUI.level(e)===g).map(e=>`<button class="nav-item ${e.id===selected.id?'active':''}" data-id="${esc(e.id)}" aria-current="${e.id===selected.id?'true':'false'}">${esc(e.title)}</button>`).join('')}</div></div>`).join('');nav.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{open=open===b.dataset.group?null:b.dataset.group;renderNav()});nav.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>choose(b.dataset.id));}
 function choose(id){selected=examples.find(e=>e.id===id)||examples.find(e=>e.id==='pvd')||examples[0];open=ProcessUI.level(selected);renderNav();const t=targets.find(t=>t.id===selected.id),names={photo:'Photo',etch:'Etch',deposition:'Deposition',diffusion:'Doping / Thermal',cmp:'C&C'};const ops=(t?.recipe||[]).map(s=>names[s.op]||s.op).filter((x,i,a)=>i===0||x!==a[i-1]);document.getElementById('detail-title').textContent=selected.title;document.getElementById('parameter-detail').innerHTML=`<div class="flow-mini"><span>Wafer</span>${ops.map(x=>`<span>→ ${esc(x)}</span>`).join('')}</div><a class="button primary" href="/#${esc(selected.id)}">이 예제 열기 →</a>${selected.sources?.length?`<details><summary>구조 참고 자료</summary>${selected.sources.map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></p>`).join('')}</details>`:''}`;}
 choose(location.hash.slice(1));
}).catch(()=>document.getElementById('parameter-detail').textContent='예제를 불러오지 못했습니다. 새로고침해 주세요.');
