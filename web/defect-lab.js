'use strict';
(() => {
 const M=DefectLabModels,q=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let active=null,starting=false,target=null,operations=null;
 const button=document.createElement('button');button.id='defect-mode';button.textContent='불량분석';button.setAttribute('aria-pressed','false');document.querySelector('.mode-switch').append(button);
 const dialog=document.createElement('dialog');dialog.className='defect-dialog';dialog.setAttribute('aria-labelledby','defect-title');document.body.append(dialog);
 const brief=document.createElement('section');brief.className='defect-brief';brief.hidden=true;document.querySelector('.reverse-controls').prepend(brief);
 function shell(title,html){dialog.innerHTML=`<header><h2 id="defect-title">${title}</h2><button aria-label="닫기" data-close>×</button></header><div class="defect-body">${html}</div>`;dialog.querySelector('[data-close]').onclick=()=>dialog.close();if(!dialog.open)dialog.showModal();}
 function leave(){active=null;brief.hidden=true;document.querySelector('.design-brief').hidden=false;button.classList.remove('active');button.setAttribute('aria-pressed','false');}
 function showPicker(){
  if(starting||reverseLab.busy||busy){toast('현재 계산을 마친 뒤 과제를 선택하세요.');return;}
  shell('불량분석 · MOSFET',`<div class="defect-cases">${M.cases.map((c,i)=>`<button data-case="${c.id}"><small>CASE 0${i+1}</small><strong>${c.title}</strong><span>${c.symptom}</span></button>`).join('')}</div><p id="defect-error" role="alert"></p>`);
  dialog.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>start(b.dataset.case));
 }
 async function start(id){
  if(starting)return;starting=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
   const response=await fetch('/api/reverse-catalog');if(!response.ok)throw Error('과제를 불러오지 못했습니다. 다시 시도하세요.');const catalog=await response.json();target=catalog.targets.find(t=>t.id==='mosfet');operations=catalog.operations;
   await reverseLab.select('mosfet',true,'gate','case-'+id);
   const context=reverseLab.context();if(context.id!=='mosfet'||!context.reference)throw Error('MOSFET 기준 계산을 불러오지 못했습니다.');
   await reverseLab.loadCandidate(M.recipe(id,context.reference));
   active=M.cases.find(c=>c.id===id);document.querySelector('.design-brief').hidden=true;
   q('reverse-mode').classList.remove('active');q('reverse-mode').setAttribute('aria-pressed','false');button.classList.add('active');button.setAttribute('aria-pressed','true');
   brief.hidden=false;brief.innerHTML=`<div class="defect-brief-heading"><b>불량 과제</b><button id="defect-change">다른 과제</button></div><h3>${active.title}</h3><p>${active.symptom}</p><div class="defect-goal">${active.goal}</div><div id="defect-progress" role="status"></div>`;
   q('defect-change').onclick=showPicker;dialog.close();
   if(!reverseLab.context().result)q('defect-progress').textContent='공정 계산으로 초기 단면을 확인하세요.';
  }catch(e){const el=q('defect-error');if(el)el.textContent=e.message;else toast(e.message);}
  finally{starting=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
 }
 function evaluate(){
  const c=reverseLab.context(),out=M.check(active.id,c,target,LearningLabModels,LearningScore,operations);
  if(out.status==='unavailable'){shell('공정설계 평가',`<p>${esc(out.reason)}</p>`);return;}
  const pass=out.status==='pass',rows=out.measures.filter(m=>!m.pass).slice(0,4);
  shell('공정설계 평가',`<div class="defect-result ${pass?'pass':''}"><strong>${pass?'개선 목표 달성':'추가 개선 필요'}</strong><span>${esc(active.title)}</span></div><dl class="defect-metrics"><div><dt>형상 일치</dt><dd>${out.components.geometry.toFixed(1)}%</dd></div><div><dt>치수 달성</dt><dd>${out.components.cd.toFixed(1)} / 100</dd></div><div><dt>도핑 조건</dt><dd>${out.checks.every(c=>c.pass)?'충족':'확인 필요'}</dd></div><div><dt>비용 지수 / 목표</dt><dd>${out.cost.toFixed(1)} / ${out.costLimit.toFixed(1)}</dd></div></dl>${out.oxide?`<p>게이트 절연막 ${out.oxide.actual?.toFixed(1)??'—'} nm · 목표 ${out.oxide.expected?.toFixed(1)??'—'} nm</p>`:''}${rows.length?`<ul>${rows.map(m=>`<li>${esc(m.kind)} ${m.actual.toFixed(1)} nm · 목표 ${m.target.toFixed(1)} nm</li>`).join('')}</ul>`:''}<button class="primary" id="defect-return">레시피로 돌아가기</button>`);
  q('defect-return').onclick=()=>dialog.close();q('defect-progress').textContent=pass?'최근 평가: 개선 목표 달성':'최근 평가: 추가 개선 필요';
 }
 dialog.addEventListener('cancel',e=>{if(starting)e.preventDefault()});
 button.onclick=showPicker;
 q('r-grade').addEventListener('click',e=>{if(active){e.preventDefault();e.stopImmediatePropagation();evaluate();}},true);
 window.DefectLab={leave,get active(){return active?.id||null}};
})();
