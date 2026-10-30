/* In-session measurement steps inspect the current fabrication state. */
(() => {
 'use strict';
 const contexts=new Map(),selected=new Map(),records=new Map();
 const types={surface:'Profilometer · 표면 높이',thickness:'단면 계측 · 재료 두께',doping:'SIMS · 총 도펀트 농도'};
 function read(key){if(!records.has(key))records.set(key,[]);return records.get(key);}
 const holder=id=>document.getElementById(id==='section'?'timeline':'r-flow');
 const host=id=>document.querySelector(id==='section'?'.viewer':'.reverse-view');
 function close(id){const wasSelected=selected.delete(id);host(id)?.classList.remove('measurement-selected');if(wasSelected)window.ProcessWorkbench?.measurement(id,null);}
 function render(id){const d=contexts.get(id),list=holder(id);if(!d||!list)return;const rows=read(d.key);for(const n of list.querySelectorAll('.metrology-card'))n.remove();
  for(const row of rows){const anchor=list.querySelector(id==='section'?`[data-frame="${row.after}"]`:`[data-step="${row.after}"]`);if(!anchor)continue;const b=document.createElement('div');b.className='metrology-card';const open=document.createElement('button');open.type='button';open.textContent=types[row.kind];open.setAttribute('aria-label',`STEP ${row.after} 다음 ${types[row.kind]}`);open.setAttribute('aria-pressed',String(selected.get(id)===row));
   open.onclick=()=>{anchor.click();const current=contexts.get(id);if(!current?.frame||current.pending||current.preview){toast('앞 공정을 먼저 계산하세요.');return;}selected.set(id,row);host(id).classList.add('measurement-selected');window.ProcessWorkbench.measurement(id,row.kind);render(id);};
   b.append(open);(id==='section'?anchor:anchor.closest('.flow-card')).after(b);
  }
 }
 function update(id,d){const old=contexts.get(id);contexts.set(id,d);if(old&&(old.key!==d.key||old.index!==d.index||old.frame!==d.frame||d.pending||d.preview))close(id);if(old?.key!==d.key)render(id);}
 for(const id of ['section','r-current']){const list=holder(id),panel=list.closest('.process-panel'),actions=panel.querySelector('.panel-heading');const wrap=document.createElement('div');wrap.className='metrology-add';wrap.innerHTML='<button type="button" aria-expanded="false">+ 계측</button><select aria-label="추가할 계측 종류" hidden><option value="">계측 선택</option>'+Object.entries(types).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')+'</select>';actions.append(wrap);const button=wrap.querySelector('button'),select=wrap.querySelector('select');button.onclick=()=>{select.hidden=!select.hidden;button.setAttribute('aria-expanded',String(!select.hidden));if(!select.hidden)select.focus();};select.onchange=()=>{if(!select.value)return;const d=contexts.get(id);if(!d?.frame||d.pending||d.preview){toast('앞 공정을 먼저 계산하세요.');select.value='';return;}const rows=read(d.key);let r=rows.find(r=>r.after===d.index&&r.kind===select.value);if(!r){if(rows.length>=96){toast('계측은 최대 96개까지 추가할 수 있습니다.');return;}r={after:d.index,kind:select.value};rows.push(r);}selected.set(id,r);host(id).classList.add('measurement-selected');window.ProcessWorkbench.measurement(id,r.kind);select.value='';select.hidden=true;button.setAttribute('aria-expanded','false');render(id);const active=list.querySelector('.metrology-card:has([aria-pressed=true])');if(active)list.scrollLeft+=active.getBoundingClientRect().left-list.getBoundingClientRect().left-list.clientWidth/2;};
  list.addEventListener('click',e=>{if(e.target.closest('[data-frame],[data-step]'))close(id);},true);
  new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.frame-card,.flow-card')||n.querySelector?.('[data-step]')))))render(id);}).observe(list,{childList:true});
 }
 window.MetrologySteps={update,isActive:id=>selected.has(id),isDoping:id=>selected.get(id)?.kind==='doping'};
})();
