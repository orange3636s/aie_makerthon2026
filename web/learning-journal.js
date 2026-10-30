'use strict';
(function(root){
 const KEY='processtrace.learning.v1',LIMIT=30;
 function read(storage){try{const rows=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(rows)?rows.filter(r=>r&&typeof r.target==='string'&&Array.isArray(r.steps)&&r.components&&Number.isFinite(r.score)).slice(-LIMIT):[];}catch{return [];}}
 function record(storage,value){const row={...value,at:new Date().toISOString(),model:'educational-response-v1',version:1};const rows=read(storage);rows.push(row);storage.setItem(KEY,JSON.stringify(rows.slice(-LIMIT)));return row;}
 const api={read,record};if(typeof module==='object'&&module.exports){module.exports=api;return;}root.LearningJournal=api;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dialog=document.createElement('dialog');dialog.className='learning-dialog';dialog.setAttribute('aria-labelledby','learning-title');document.body.append(dialog);
 const button=document.createElement('button');button.type='button';button.className='learning-open';button.textContent='학습 노트';document.querySelector('.app-header nav').append(button);
 api.save=value=>{try{record(localStorage,value);}catch{toast('학습 기록을 저장하지 못했습니다. 레시피를 파일로 저장하세요.');}};
 function show(){const rows=read(localStorage).reverse();dialog.innerHTML=`<header><div><small>PROCESS LAB</small><h2 id="learning-title">실험하고, 이유를 남기세요</h2></div><button data-close aria-label="학습 노트 닫기">×</button></header><div class="learning-body"><div class="learning-tasks"><article><small>01 · 공정 통합</small><h3>STI · 채움과 평탄화</h3><p>증착 방식 또는 한 가지 조건을 바꾸고, 빈 공간과 잔여 단차를 비교하세요.</p><button data-task="sti">STI 이어서 실험</button></article><article><small>02 · 원인 진단</small><h3>MOSFET · 도핑과 열처리</h3><p>주입 에너지·도즈·열처리 중 하나를 바꾸고, S/D 분포와 채널 경계를 비교하세요.</p><button data-task="mosfet">MOSFET 이어서 실험</button></article></div><h3>제출 기록 <small>${rows.length} / 30</small></h3><p class="learning-caption">평가 문제와 근거를 제출하면 이 브라우저에 저장됩니다.</p><div class="learning-records">${rows.length?rows.map((r,i)=>{const before=rows.slice(i+1).find(p=>p.target===r.target&&p.complete===r.complete),delta=before?r.score-before.score:null;return `<details><summary><span><b>${escape(r.title||r.target)}</b><small>${new Date(r.at).toLocaleString('ko-KR')} · ${r.complete?'최종':'중간'} 평가</small></span><strong>${Math.round(r.score)}<small> / 100${delta!==null?' · '+(delta>=0?'+':'')+Math.round(delta):''}</small></strong></summary><div class="learning-evidence"><dl>${Object.entries(r.components).map(([k,v])=>`<div><dt>${({geometry:'형상',cd:'치수',doping:'농도',efficiency:'효율'})[k]||escape(k)}</dt><dd>${Number(v).toFixed(1)}</dd></div>`).join('')}</dl><h4>관측 근거와 수정 계획</h4><p>${escape(r.reason)}</p>${r.plan?`<p>${escape(r.plan.label)} · ${escape(r.plan.prediction)} 예상</p>`:''}<button data-export="${i}">레시피·기록 저장</button></div></details>`;}).join(''):'<div class="learning-empty">역설계 → 공정설계 평가에서 첫 실험을 제출하세요.</div>'}</div></div>`;
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.querySelectorAll('[data-task]').forEach(b=>b.onclick=async()=>{if(window.reverseLab?.busy||typeof busy!=='undefined'&&busy){toast('현재 계산을 마친 후 이동하세요.');return;}await reverseLab.select(b.dataset.task);dialog.close();});
  dialog.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{const row=rows[+b.dataset.export];download(new Blob([JSON.stringify(row,null,2)],{type:'application/json'}),'ProcessTrace-learning-'+row.target+'.json');});
  dialog.showModal();
 }
 button.onclick=show;
})(typeof window==='object'?window:globalThis);
