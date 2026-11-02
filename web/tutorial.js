 'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(() => {
 const lessons=[
  ['Trench를 여세요','위의 ‘Trench 실습 시작’을 누르세요.','단면 중앙의 홈이 트렌치입니다. 입구와 바닥의 막을 비교해 볼 거예요.','library'],
  ['마지막 PVD 단계를 선택하세요','Process flow에서 ‘PVD · 3/3’을 누르세요. 오른쪽 꺾쇠를 누르면 공정 조건이 열립니다.','‘기준으로 저장’을 눌러 현재 단면을 남기세요.','flow'],
  ['증착 시간을 20% 늘리세요','증착 시간(s)에 현재 값의 1.2배를 입력하세요.','같은 증착률에서 시간을 늘리면 입구와 바닥의 두께가 얼마나 달라질까요?','field'],
  ['기준선과 새 단면을 비교하세요','‘공정 계산’이 끝나면 ‘기준 겹치기’를 켜세요.','같은 단면에서 기준선과 새 막 경계 사이의 간격을 보세요. 간격이 큰 곳에 막이 더 쌓였습니다.','calculate'],
  ['목표 두께에 맞춰 설계하세요','‘역설계’에서 목표 치수를 읽고 Wafer 아래 ＋로 공정을 추가하세요.','계산 후 ‘공정설계 평가’에서 목표값과 계산값을 비교하세요.','design']
 ];
 let current=0;
 const buttons=[...document.querySelectorAll('[data-lesson]')],prev=document.getElementById('lesson-prev'),next=document.getElementById('lesson-next');
 function draw(){
  const [title,action,result,focus]=lessons[current];
  buttons.forEach((b,i)=>{if(i===current)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});
  document.getElementById('lesson-copy').innerHTML=`<h3>${esc(title)}</h3><p>${esc(action)}</p><p class="lesson-result">${esc(result)}</p>`;
  const mark=part=>focus===part?' mock-focus':'';
  document.getElementById('lesson-preview').innerHTML=`<div class="mock-title"><strong>Workspace / Trench</strong><span>${focus==='design'?'역설계':'실험실'}</span></div><div class="mock-workspace"><div class="mock-library${mark('library')}"><span>예제 목록</span><span>Line pattern</span><span class="mock-active">Trench</span><span>STI</span></div><div class="mock-view"><svg viewBox="0 0 240 160" role="img" aria-label="트렌치 증착 단면 조작 안내도"><path d="M20 45h65v62h70V45h65v96H20z" fill="#d9e2ee"/><path d="M20 40h70v62h60V40h70" stroke="#6498ed" stroke-width="${current===3?16:9}" fill="none"/>${current===3?'<path d="M20 40h70v62h60V40h70" stroke="#324666" stroke-dasharray="4 4" fill="none"/>':''}</svg></div><div class="mock-flow${mark('flow')}"><b>Process flow</b><span>01 Wafer</span><span class="mock-active">09 PVD · 3/3　⌄</span><div class="mock-field${mark('field')}"><span>증착 시간 · s</span><strong>${current>=2?'기준값 × 1.2':'기준값'}</strong></div><div class="mock-action${mark('calculate')}">${focus==='design'?'＋ 공정 추가':'공정 계산'}</div></div></div><p class="mock-caption">Trench 실습 조작 예시</p>`;
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
 function choose(id){selected=examples.find(e=>e.id===id)||examples.find(e=>e.id==='pvd')||examples[0];open=ProcessUI.level(selected);renderNav();const t=targets.find(t=>t.id===selected.id),names={photo:'Photo',etch:'Etch',deposition:'Deposition',diffusion:'Doping / Thermal',cmp:'C&C'};const fields=selected.fields.filter(f=>typeof f.default==='number').slice(0,selected.id==='pvd'?2:3).map(f=>ProcessUI.displayField(f));const ops=(t?.recipe||[]).map(s=>names[s.op]||s.op).filter((x,i,a)=>i===0||x!==a[i-1]);document.getElementById('detail-title').textContent=selected.title;document.getElementById('parameter-detail').innerHTML=`<p>${fields.map(f=>`${esc(f.label)} <b>${esc(f.default)} ${esc(f.unit||'')}</b>`).join(' · ')}</p><details><summary>공정 순서</summary><div class="flow-mini"><span>Wafer</span>${ops.map(x=>`<span>→ ${esc(x)}</span>`).join('')}</div></details><a class="button primary" href="/#${esc(selected.id)}">이 예제 열기 →</a>${selected.sources?.length?`<details><summary>구조 참고 자료</summary>${selected.sources.map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></p>`).join('')}</details>`:''}`;}
 choose(location.hash.slice(1));
}).catch(()=>document.getElementById('parameter-detail').textContent='예제를 불러오지 못했습니다. 새로고침해 주세요.');
