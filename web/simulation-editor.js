'use strict';
// The observation and reverse-design views execute the same bounded native steps.
(() => {
 const panel=$('condition-form').parentElement;
 const tabs=document.createElement('div');tabs.className='simulation-condition-tabs';
 tabs.innerHTML='<button id="obs-basic" class="active" type="button">기본 조건</button><button id="obs-step" type="button">단계 조건</button>';
 panel.insertBefore(tabs,$('condition-form'));
 const form=document.createElement('form');form.id='obs-step-form';form.hidden=true;
 form.innerHTML='<p id="obs-step-title" class="step-kicker"></p><div id="obs-step-fields"></div><button class="primary" id="obs-step-run" type="submit">공정 계산</button>';
 panel.insertBefore(form,$('reset'));
 let operations=[],draft=[],stageDraft={},stepMode=false,source=null;
 fetch('/api/reverse-catalog').then(r=>r.json()).then(d=>{operations=d.operations;paint()}).catch(()=>{});
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function at(){return current?.frames[frame]?.stepIndex ?? (current?.frames.length===current?.steps?.length+1?frame:null)}
 function cyclic(){return !!current?.stageControls?.length}
 function runnable(){return !!current?.steps?.length&&operations.length&&current.steps.every(s=>operations.some(o=>o.id===s.op))}
 function sync(){if(source!==current){source=current;draft=current?.steps?structuredClone(current.steps).map(s=>{const o=operations.find(o=>o.id===s.op);return o?{...s,params:{...RecipeState.defaults(o,s.params?.method),...s.params}}:s}):[];stageDraft={...(current?.stages||{})}}}
 function paint(){
  if(!selected)return;sync();const index=at(),row=draft[(index||0)-1],op=row&&operations.find(o=>o.id===row.op),sequential=runnable()||cyclic();
  $('obs-basic').classList.toggle('active',!stepMode);$('obs-step').classList.toggle('active',stepMode);
  $('condition-form').hidden=stepMode&&sequential;form.hidden=!stepMode||!sequential;
  $('reset').hidden=stepMode&&sequential;
  if(!stepMode)return;
  if(!sequential){status('선택 단계: '+(current?.frames[frame]?.label||'')+' · 모델 조건으로 전체 흐름을 재계산합니다.');return}
  if(cyclic()){
   const f=current.stageControls.find(f=>f.frame===frame);
   $('obs-step-title').textContent=ProcessUI.text(current.frames[frame].label);
   $('obs-step-fields').innerHTML=f?`<div class="field"><label for="obs-phase-value">${esc(f.label)} · ${esc(f.unit)}</label><input id="obs-phase-value" type="number" min="${f.min}" max="${f.max}" step="any" value="${stageDraft[frame]??f.value}" required></div>`:'<p class="caption">공정 단계를 선택하세요.</p>';
   $('obs-step-run').disabled=busy||!f;
   if(f){const input=$('obs-phase-value');input.disabled=busy;input.oninput=()=>{stageDraft[frame]=input.value===''?'':Number(input.value);status('선택 단계 조건 변경 · 공정 계산으로 반영하세요.')}}
   return;
  }
  $('obs-step-title').textContent=index?`STEP ${index} · ${ProcessUI.text(current.frames[frame].label)}`:'START · Si substrate';
  $('obs-step-fields').innerHTML=op?op.fields.filter(f=>ProcessUI.active(f,row.params)).map(f=>`<div class="field"><label for="obs-p-${f.key}">${esc(ProcessUI.text(f.label))}${f.unit?' · '+esc(f.unit):''}</label>${f.options?`<select id="obs-p-${f.key}">${f.options.map(v=>`<option value="${esc(v)}" ${v===row.params[f.key]?'selected':''}>${esc(ProcessUI.label(v))}</option>`).join('')}</select>`:`<input id="obs-p-${f.key}" type="number" min="${f.min}" max="${f.max}" step="${ProcessUI.integer(f)?1:'any'}" value="${esc(row.params[f.key])}" required>`}</div>`).join(''):'<p class="caption">공정 단계를 선택하세요.</p>';
  $('obs-step-run').disabled=busy||!op;
  if(op)for(const f of op.fields){const input=$('obs-p-'+f.key);if(!input)continue;input.disabled=busy;input.addEventListener(f.options?'change':'input',()=>{
   row.params[f.key]=f.options?f.options.find(v=>String(v)===input.value):input.value===''?'':Number(input.value);
   if(f.key==='method')Object.assign(row.params,op.presets?.[row.params.method]||{});
   row.params=ProcessUI.normalizeInactive(op.fields,row.params);delete row.label;
   status('단계 조건 변경 · 공정 계산으로 반영하세요.');if(f.options)paint();
  })}
 }
 $('obs-basic').onclick=()=>{if(busy)return;stop();stepMode=false;paint()};
 $('obs-step').onclick=()=>{if(busy)return;stop();stepMode=true;paint()};
 form.onsubmit=async e=>{
  e.preventDefault();if(busy||(!runnable()&&!cyclic()))return;
  const bad=cyclic()?null:RecipeState.invalid(draft,operations);if(bad){status(`STEP ${bad.step} · ${bad.message}`,true);return}
  if(!form.reportValidity())return;
  const isCyclic=cyclic(),selectedStep=at(),selectedFrame=frame,params=current.params,id=selected.id;setBusy(true);paint();status('변경한 단계와 이후 흐름을 계산 중…');
  try{
   const job=await request(isCyclic?'/api/run':'/api/reverse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(isCyclic?{example:id,params,stages:stageDraft}:{target:current.target||id,steps:draft})});let result=job.result;
   for(let i=0;!result&&i<260;i++){const j=await request('/api/jobs/'+job.job);if(j.state==='error')throw Error(j.error);if(j.state==='done')result=j.result;else await new Promise(r=>setTimeout(r,600))}
   if(!result)throw Error('계산 응답 시간이 초과됐습니다.');
   result.params=params;result.example=id;result.customFlow=true;current=result;lastResults.set(id,result);
   frame=isCyclic?Math.min(selectedFrame,result.frames.length-1):Math.max(0,result.frames.findLastIndex(f=>(f.stepIndex??result.frames.indexOf(f))<=selectedStep));
   updateAll();status(result.failure?`STEP ${result.failure.step} · ${result.failure.message}`:`단계 조건 반영 · ${result.elapsed.toFixed(1)}초`,!!result.failure);
  }catch(error){status(error.message,true)}finally{setBusy(false);paint()}
 };
 window.simulationEditor={reset(){source=null;stepMode=false;paint()},result(){paint()},selectFrame(){stepMode=true;paint()}};
})();
