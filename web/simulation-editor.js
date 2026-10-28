'use strict';
// The observation and reverse-design views execute the same bounded native steps.
(() => {
 const panel=$('condition-form').parentElement;
 const form=document.createElement('form');form.id='obs-step-form';form.hidden=true;
 form.innerHTML='<p id="obs-step-title" class="step-kicker"></p><div id="obs-step-scroll"><div id="obs-step-fields"></div><div id="obs-preview" hidden></div><div id="obs-step-estimate" hidden></div></div><button class="primary" id="obs-step-run" type="submit">공정 계산</button>';
 panel.insertBefore(form,$('reset'));
 let operations=[],draft=[],stageDraft={},source=null;
 fetch('/api/reverse-catalog').then(r=>r.json()).then(d=>{operations=d.operations;source=null;paint()}).catch(()=>{});
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function at(){return current?.frames[frame]?.stepIndex ?? (current?.frames.length===current?.steps?.length+1?frame:null)}
 function cyclic(){return !!current?.stageControls?.length}
 function runnable(){return !!current?.steps?.length&&operations.length&&current.steps.every(s=>operations.some(o=>o.id===s.op))}
 function sync(){if(source!==current){source=current;draft=current?.steps?structuredClone(current.steps).map(s=>{const o=operations.find(o=>o.id===s.op);return o?{...s,params:{...RecipeState.defaults(o,s.params?.method),...(s.op==='photo'&&!s.params?.action?{action:'Pattern'}:{}),...s.params}}:s}):[];stageDraft={...(current?.stages||{})}}}
 function paint(){
  const advancedOpen=!!$('obs-step-fields').querySelector('.advanced-options[open]');
  if(!selected)return;sync();const index=at(),row=draft[(index||0)-1],op=row&&operations.find(o=>o.id===row.op),sequential=runnable()||cyclic();
  $('condition-form').hidden=sequential||!current;form.hidden=!sequential;$('reset').hidden=true;
  if(!sequential)return;
  if(cyclic()){
   ProcessEstimate.render($('obs-step-estimate'),null);
   const raw=current.stageControls.find(f=>f.frame===frame),f=raw&&ProcessUI.displayField(raw);
   $('obs-step-title').textContent=ProcessUI.text(current.frames[frame].label);
   $('obs-step-fields').innerHTML=f?`<div class="field"><label for="obs-phase-value">${esc(f.label)} · ${esc(f.unit)}</label><input id="obs-phase-value" type="number" min="${f.min}" max="${f.max}" step="any" value="${ProcessUI.displayValue(raw,stageDraft[frame]??raw.value)}" required></div>`:'<p class="caption">공정 단계를 선택하세요.</p>';
   $('obs-step-run').disabled=busy||!f;
   if(f){const input=$('obs-phase-value');input.disabled=busy;input.oninput=()=>{stageDraft[frame]=input.value===''?'':ProcessUI.inputValue(raw,Number(input.value));status('선택 ')}}
   return;
  }
  $('obs-step-title').textContent=index?`STEP ${index} · ${ProcessUI.text(current.frames[frame].label)}`:'START · Si substrate';
  $('obs-step-fields').innerHTML=op?ProcessUI.groupControls(ProcessUI.recipeFields(op,row.params),raw=>{const f=ProcessUI.displayField(raw);return `<div class="field"><label for="obs-p-${f.key}">${esc(ProcessUI.text(f.label))}${f.unit?' · '+esc(f.unit):''}</label>${f.options?`<select id="obs-p-${f.key}">${ProcessUI.optionsFor(f,row.params[f.key]).map(v=>`<option value="${esc(v)}" ${v===row.params[f.key]?'selected':''} ${ProcessUI.legacy(v)?'disabled':''}>${esc(ProcessUI.label(v))}</option>`).join('')}</select>`:`<input id="obs-p-${f.key}" type="number" min="${f.min}" max="${f.max}" step="${ProcessUI.integer(f)?1:'any'}" value="${esc(row.params[f.key]===''?'':shortNumber(ProcessUI.displayValue(raw,row.params[f.key])))}" required>`}${ProcessUI.hint(raw)?`<p class="field-help">${esc(ProcessUI.hint(raw))}</p>`:''}</div>`},advancedOpen):'<p class="caption">공정 단계를 선택하세요.</p>';
  $('obs-step-run').disabled=busy||!op;
  function mountPreview(){ParameterPreview.mount($('obs-preview'),{id:'section',target:current.target||selected.id,steps:draft,index:index||0,operation:op,disabled:busy,draw:()=>{drawMain();ProcessEstimate.render($('obs-step-estimate'),ParameterPreview.active('section')?null:op?ProcessEstimate.estimate(op,row.params):null)},apply:(f,v)=>{const input=$('obs-p-'+f.key);input.value=ProcessUI.displayValue(f,v);input.dispatchEvent(new Event('input',{bubbles:true}))}});}
  const preview=()=>ProcessEstimate.render($('obs-step-estimate'),op?ProcessEstimate.estimate(op,row.params):null);preview();mountPreview();
  if(op)for(const f of op.fields){const input=$('obs-p-'+f.key);if(!input)continue;input.disabled=busy;input.addEventListener(f.options?'change':'input',()=>{
   row.params[f.key]=f.options?f.options.find(v=>String(v)===input.value):input.value===''?'':ProcessUI.inputValue(f,Number(input.value));
   if(f.key==='method')Object.assign(row.params,op.presets?.[row.params.method]||{});
   row.params=ProcessUI.normalizeInactive(op.fields,row.params);delete row.label;
   ParameterPreview.cancelAll();status('');if(f.options)paint();else {preview();mountPreview()}drawMain();
  })}

 }
 form.onsubmit=async e=>{
  e.preventDefault();await ParameterPreview.cancelAll();if(busy||(!runnable()&&!cyclic()))return;
  const bad=cyclic()?null:RecipeState.invalid(draft,operations);if(bad){status(`STEP ${bad.step} · ${bad.message}`,true);return}
  if(!form.reportValidity())return;
  const isCyclic=cyclic(),selectedStep=at(),selectedFrame=frame,params=current.params,id=selected.id,mine=++calculationGeneration;setBusy(true);paint();status('변경한 단계와 이후 흐름을 계산 중…');
  try{
   const result=await calculateJob(isCyclic?'/api/run':'/api/reverse',isCyclic?{example:id,params,stages:stageDraft}:{target:current.target||id,steps:draft},mine);if(!result||mine!==calculationGeneration)return;
   result.params=params;result.example=id;result.customFlow=true;current=result;lastResults.set(id,result);
   frame=isCyclic?Math.min(selectedFrame,result.frames.length-1):Math.max(0,result.frames.findLastIndex(f=>(f.stepIndex??result.frames.indexOf(f))<=selectedStep));
   updateAll();status(result.failure?`STEP ${result.failure.step} · ${result.failure.message}`:`단계 조건 반영 · ${result.elapsed.toFixed(1)}초`,!!result.failure);
  }catch(error){if(mine===calculationGeneration)status(error.message,true)}finally{if(mine===calculationGeneration){setBusy(false);paint()}}
 };
 window.simulationEditor={maskPreview(){const index=at(),row=draft[(index||0)-1];return PhotoPreview.context(row,draft.slice(0,(index||0)-1),current?.frames[frame])},reset(){source=null;paint()},result(){paint()},selectFrame(){paint();drawMain()}};
})();
