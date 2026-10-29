/* Candidate comparison and evidence-first diagnosis. Numerical grading stays in
   LearningScore; language models cannot modify these scores or correct options. */
(function(root){
 'use strict';
 function question(score){
  const checks=score.checks||[],bad=checks.filter(c=>!c.pass),m=(score.measures||[]).filter(m=>!m.pass).sort((a,b)=>b.error-a.error)[0];
  const choices=[
   {id:'geometry',text:'재료의 배치와 식각·증착 형상을 먼저 비교한다.'},
   {id:'dimension',text:'측정 위치의 폭·두께와 성장량·제거량을 먼저 비교한다.'},
   {id:'doping',text:'도핑종·주입 조건과 활성화 열처리를 먼저 비교한다.'},
   {id:'efficiency',text:'목표를 유지하면서 단계 수와 처리 비용을 줄일 수 있는지 비교한다.'},
   {id:'supported',text:'측정된 조건은 충족했다. 전기 동작은 별도의 검증이 필요하다.'}
  ];
  let correct,explanation;
  if(bad.length){correct='doping';explanation='형상이 비슷해도 총·활성 농도 또는 주입·열처리 조건이 목표에 미달했습니다. 주입과 열처리를 하나씩 바꿔 확인하세요. 이 정보만으로 실제 누설·단락을 확정하지 않습니다.';}
  else if(m){correct='dimension';explanation=`측정된 ${m.kind}는 목표 ${m.target.toFixed(1)} nm, 결과 ${m.actual.toFixed(1)} nm입니다. 같은 위치에서 성장·제거량을 바꿔 검증하세요. 특정 공정 하나가 원인이라고 단정할 수는 없습니다.`;}
  else if(score.components.geometry<90){correct='geometry';explanation='치수 일부가 맞아도 전체 재료 형상은 목표 범위를 벗어났습니다. 재료별 단면과 이전 단계를 비교하세요.';}
  else if(score.eligible&&score.actualCost>score.referenceCost*1.01){correct='efficiency';explanation='측정 목표를 충족한 상태에서 비용 지수가 증가했습니다. 필요한 ALD까지 일괄 제거하지 말고, 중복 처리와 공정 목적을 비교하세요.';}
  else {correct='supported';explanation='현재 평가 항목은 목표 범위를 만족합니다. 이 판정은 실제 소자 동작, 수율 또는 양산 가능성의 검증을 의미하지 않습니다.';}
  return {id:correct,correct,choices,explanation,prompt:'측정 근거를 바탕으로 가장 먼저 확인할 항목은 무엇인가요?',evidence:{geometry:score.components.geometry,cd:score.components.cd,doping:score.components.doping??null,checks:checks.map(c=>({name:c.name,pass:c.pass,detail:c.detail})),measure:m?{kind:m.kind,target:m.target,actual:m.actual,error:m.error}:null,cost:score.actualCost,referenceCost:score.referenceCost,eligible:score.eligible}};
 }
 function answer(q,choice,reason){if(!q.choices.some(c=>c.id===choice))return {error:'확인할 항목을 하나 선택하세요.'};if(typeof reason!=='string'||reason.trim().length<15)return {error:'관측한 수치와 이유를 15자 이상 적어주세요.'};if(reason.length>1200)return {error:'이유는 1,200자 이내로 적어주세요.'};return {correct:choice===q.correct,explanation:q.explanation};}
 function experiment(previous,steps,score){
  if(!previous?.recipe||!previous?.components)return null;
  const before=previous.recipe,changes=[];
  const sequence=before.length!==steps.length||before.some((s,i)=>s.op!==steps[i]?.op);
  if(!sequence)before.forEach((s,i)=>{for(const k of new Set([...Object.keys(s.params),...Object.keys(steps[i].params)]))if(s.params[k]!==steps[i].params[k])changes.push({step:i+1,key:k,before:s.params[k],after:steps[i].params[k]});});
  const deltas=Object.fromEntries(Object.keys(score.components).filter(k=>Number.isFinite(previous.components[k])).map(k=>[k,score.components[k]-previous.components[k]]));
  const key=previous.plan?.metric,delta=deltas[key],expected=previous.plan?.prediction;
  const prediction=Number.isFinite(delta)&&expected?Math.abs(delta)<.1?'유지':delta>0?'증가':'감소':null;
  return {sequence,changes,deltas,controlled:!sequence&&changes.length===1,unchanged:!sequence&&!changes.length,prediction,expected,matched:prediction!==null&&prediction===expected};
 }
 function planOptions(steps,operations=[]){return steps.flatMap((s,i)=>(operations.find(o=>o.id===s.op)?.fields||[]).filter(f=>typeof s.params[f.key]==='number'&&(!f.when||Object.entries(f.when).every(([k,v])=>v.includes(s.params[k])))).map(f=>({id:(i+1)+':'+f.key,step:i+1,key:f.key,value:s.params[f.key],field:f})));}
 const api={question,answer,experiment,planOptions};if(typeof module==='object'&&module.exports){module.exports=api;return;}root.RecipeStudio=api;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 api.diagnose=(host,score,target,steps,onDone,context={})=>{
  const q=question(score),e=q.evidence;
  host.innerHTML=`<div class="rs-diagnosis"><span class="rs-eyebrow">01 · EVIDENCE</span><h3>결과를 읽고 원인을 좁혀보세요</h3><div class="rs-evidence"><div><small>형상 일치</small><strong>${e.geometry.toFixed(1)}<em>%</em></strong></div><div><small>치수 달성</small><strong>${e.cd.toFixed(1)}<em>/100</em></strong></div><div><small>농도 일치</small><strong>${e.doping===null?'—':e.doping.toFixed(1)}<em>${e.doping===null?'해당 없음':'/100'}</em></strong></div><div><small>교육용 비용 지수</small><strong>${e.cost.toFixed(1)}<em>기준 ${e.referenceCost.toFixed(1)}</em></strong></div></div>${e.measure?`<p class="rs-observed">${esc(e.measure.kind)} ${e.measure.actual.toFixed(1)} nm / 목표 ${e.measure.target.toFixed(1)} nm · 오차 ${(e.measure.error*100).toFixed(1)}%</p>`:''}${e.checks.filter(c=>c.name!=='주입·열처리 완료').length?`<ul class="rs-checks">${e.checks.filter(c=>c.name!=='주입·열처리 완료').map(c=>`<li><b>${c.pass?'PASS':'CHECK'}</b> ${esc(c.name)} <small>${esc(c.detail)}</small></li>`).join('')}</ul>`:''}<form id="rs-quiz"><fieldset><legend>02 · ${esc(q.prompt)}</legend>${q.choices.map((c,i)=>`<label class="rs-choice"><input type="radio" name="diagnosis" value="${c.id}"><span><b>${i+1}</b>${esc(c.text)}</span></label>`).join('')}</fieldset><label class="rs-reason" for="rs-reason">관측 근거와 다음 실험</label><textarea id="rs-reason" maxlength="1200" rows="3" placeholder="어떤 수치를 봤고, 어느 조건을 바꿔 확인할지 적어주세요."></textarea><p id="rs-error" role="status"></p><button class="primary" type="submit">제출하고 해설 보기</button><p class="rs-note">선택지는 수치 근거로 확인합니다. 서술 답변은 자동 채점하지 않습니다.</p></form></div>`;
  const metrics={geometry:'형상 일치',cd:'치수 달성',doping:'농도 일치',efficiency:'효율'};
  if(context.scope)host.querySelector('.rs-diagnosis').insertAdjacentHTML('afterbegin',`<p class="rs-observed">${esc(context.scope)}</p>`);
  const options=planOptions(steps,context.operations),form=host.querySelector('form');
  form.querySelector('button[type=submit]').insertAdjacentHTML('beforebegin',`<details class="rs-plan"><summary>다음 실험 설계 · 선택</summary><div class="rs-plan-grid"><label>변경할 조건<select id="rs-variable"><option value="">선택하세요</option>${options.map(o=>`<option value="${o.id}">STEP ${o.step} · ${esc(ProcessUI.displayField(o.field).label)} (${ProcessUI.displayValue(o.field,o.value)} ${esc(ProcessUI.displayField(o.field).unit)})</option>`).join('')}</select></label><label>관찰할 점수<select id="rs-metric">${Object.keys(score.components).map(k=>`<option value="${k}">${metrics[k]}</option>`).join('')}</select></label><label>예상 변화<select id="rs-prediction"><option>증가</option><option>감소</option><option>유지</option></select></label></div><p class="rs-note">선택한 조건을 바꿔 재계산하고 예상한 변화와 비교하세요.</p></details>`);
  host.querySelector('form').onsubmit=event=>{event.preventDefault();const choice=host.querySelector('input:checked')?.value,reason=host.querySelector('textarea').value.trim(),result=answer(q,choice,reason);if(result.error){host.querySelector('#rs-error').textContent=result.error;return;}const plan=host.querySelector('#rs-variable').value?{label:host.querySelector('#rs-variable').selectedOptions[0].textContent,metric:metrics[host.querySelector('#rs-metric').value],prediction:host.querySelector('#rs-prediction').value}:null;onDone({...result,choice,reason,plan});};
 };
 api.feedback=r=>`<div class="rs-feedback"><b>${r.correct?'근거와 맞는 판단입니다.':'다른 근거를 함께 확인해보세요.'}</b><p>${esc(r.explanation)}</p>${r.plan?`<p><b>다음 실험</b><br>${esc(r.plan.label)}<br>${esc(r.plan.metric)} · 예상 ${esc(r.plan.prediction)}</p>`:''}<small>서술 답변은 자동 채점하지 않았습니다.</small></div>`;
 const dialog=document.createElement('dialog');dialog.className='rs-dialog';dialog.setAttribute('aria-labelledby','rs-title');document.body.append(dialog);let generation=0;
 function shell(title){dialog.innerHTML=`<header><div><span class="rs-eyebrow">RECIPE STUDIO</span><h2 id="rs-title">${esc(title)}</h2></div><button class="rs-close" aria-label="닫기">×</button></header><div class="rs-body" role="status">불러오는 중…</div>`;dialog.querySelector('.rs-close').onclick=()=>{generation++;dialog.close();};if(!dialog.open)dialog.showModal();return dialog.querySelector('.rs-body');}
 dialog.addEventListener('cancel',()=>generation++);
 api.open=async(targetId,onLoad)=>{
  const mine=++generation,body=shell('플로우 후보 비교');
  try{const response=await fetch('/api/flow-candidates/'+encodeURIComponent(targetId),{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('후보를 불러오지 못했습니다. 잠시 후 다시 시도하세요.');const entry=await response.json();if(mine!==generation)return;
   const base=entry.candidates[0],money=base.metrics.cost;
   body.innerHTML=`<p class="rs-intro">${esc(entry.title)} · ${entry.candidates.length}개 조건 비교</p><div class="rs-candidates">${entry.candidates.map((c,i)=>`<article class="rs-candidate"><div class="rs-candidate-top"><span>${String.fromCharCode(65+i)}</span><b class="rs-badge ${c.metrics.eligible?'pass':''}">${c.metrics.eligible?'측정 목표 충족':'목표 이탈 · 실험용'}</b></div><h3>${esc(c.name)}</h3><p>${esc(c.description)}</p><div class="rs-route-summary"><b>학습할 차이</b><span>${esc(c.benefit||'')}</span><b>대가·제약</b><span>${esc(c.tradeoff||'')}</span><b>단면에서 확인</b><span>${esc(c.observe||'')}</span></div><dl><div><dt>형상 일치</dt><dd>${c.metrics.geometry.toFixed(1)}%</dd></div><div><dt>치수 달성</dt><dd>${c.metrics.cd.toFixed(1)}/100</dd></div>${c.metrics.doping!==null?`<div><dt>농도 일치</dt><dd>${c.metrics.doping.toFixed(1)}/100</dd></div>`:''}<div><dt>입력 시간 합계</dt><dd>${c.metrics.knownSeconds.toLocaleString('ko-KR',{maximumFractionDigits:1})} s${c.metrics.partial?'*':''}</dd></div><div><dt>상대 비용 지수</dt><dd>${Math.round(c.metrics.cost/money*100)} <small>기준 100</small></dd></div><div><dt>공정 단계</dt><dd>${c.steps.length}</dd></div></dl><details><summary>변경 단계 · ${c.changes?.length||0}개 구간</summary><ul>${(c.changes||[]).map(d=>`<li>기준 ${d.before[0]}–${d.before[1]} → 후보 ${d.after[0]}–${d.after[1]} (${esc(d.kind)})</li>`).join('')}</ul></details><details><summary>근거·모델 범위</summary><p>${esc(c.scope||'교육용 조건')}</p>${(c.sources||[]).map(r=>`<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)} ↗</a>`).join('<br>')}</details><details><summary>공정 흐름 보기</summary><ol>${c.steps.map(s=>`<li>${esc(ProcessUI.processTitle(s))}</li>`).join('')}</ol></details><button class="primary" data-load="${i}">이 후보로 실험</button></article>`).join('')}</div><details class="rs-method"><summary>비교 기준</summary><p>공개 공정 모듈을 교육용 수치로 재구성한 예시입니다. 출처는 공정 원리의 근거이며 이 전체 레시피를 보증하지 않습니다. 같은 기준 단면에서 형상·치수·총/활성 농도를 평가합니다. 목표 이탈 후보도 원인 분석을 위해 제공합니다. 모두가 정답은 아닙니다.</p><p>시간은 입력된 시간만 합산하며 ALD 퍼지·이송·장비 준비 시간은 제외합니다. 비용은 교육용 가중치이며 실제 제조원가가 아닙니다. 재료의 유전율·이동도·전기 성능은 이 비교에 포함하지 않습니다.</p><p>같은 처리량을 분할해도 수치해석 결과가 달라질 수 있습니다. ±5% 치수 조건을 먼저 확인하세요.</p></details>`;
   body.querySelectorAll('[data-load]').forEach(b=>b.onclick=async()=>{if(mine!==generation||b.disabled)return;body.querySelectorAll('[data-load]').forEach(x=>x.disabled=true);try{await onLoad(structuredClone(entry.candidates[Number(b.dataset.load)]));dialog.close();generation++;}catch(e){body.querySelectorAll('[data-load]').forEach(x=>x.disabled=false);let err=body.querySelector('.rs-load-error');if(!err){err=document.createElement('p');err.className='rs-load-error';err.setAttribute('role','alert');body.prepend(err);}err.textContent=e.message;}});
  }catch(e){if(mine===generation)body.textContent=e.name==='TimeoutError'?'후보 응답이 지연됩니다. 다시 열어주세요.':e.message;}
 };
 const candidates=document.createElement('button');candidates.id='lab-candidates';candidates.textContent='플로우 후보';document.querySelector('#observation .process-panel .toolbar').prepend(candidates);
 candidates.onclick=()=>{if(!selected)return;const id=selected.id;api.open(id,async c=>{if(selected.id!==id)throw Error('예제가 변경되었습니다. 후보를 다시 선택하세요.');if(busy)throw Error('현재 계산이 끝난 후 후보를 적용하세요.');await reverseLab.select(id);reverseLab.loadCandidate(c);});};
})(typeof window==='object'?window:globalThis);
