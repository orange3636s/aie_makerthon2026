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
  if(bad.some(c=>c.kind==='photo')){correct='dimension';explanation='노광 패턴 폭이 선택한 광원의 모델 해상도보다 작습니다. NA와 광원 파장을 비교하고 목표 치수를 확인하세요.';}
  else if(bad.some(c=>c.kind==='material')){correct='geometry';explanation='목표에 필요한 재료가 없습니다. 누락된 막과 공정 순서를 확인하세요.';}
  else if(bad.length){correct='doping';explanation='형상이 비슷해도 총·활성 농도 또는 주입·열처리 조건이 목표에 미달했습니다. 주입과 열처리를 하나씩 바꿔 확인하세요. 이 정보만으로 실제 누설·단락을 확정하지 않습니다.';}
  else if(m){correct='dimension';explanation=`측정된 ${m.kind}는 목표 ${m.target.toFixed(1)} nm, 결과 ${m.actual.toFixed(1)} nm입니다. 같은 위치에서 성장·제거량을 바꿔 검증하세요. 특정 공정 하나가 원인이라고 단정할 수는 없습니다.`;}
  else if(!score.geometryReferenceOnly&&score.components.geometry<90){correct='geometry';explanation='치수 일부가 맞아도 전체 재료 형상은 목표 범위를 벗어났습니다. 재료별 단면과 이전 단계를 비교하세요.';}
  else if(score.eligible&&score.actualCost>score.referenceCost*1.01){correct='efficiency';explanation='측정 목표를 충족한 상태에서 비용 지수가 증가했습니다. 필요한 ALD까지 일괄 제거하지 말고, 중복 처리와 공정 목적을 비교하세요.';}
  else {correct='supported';explanation='현재 평가 항목은 목표 범위를 만족합니다. 이 판정은 실제 소자 동작, 수율 또는 양산 가능성의 검증을 의미하지 않습니다.';}
  return {id:correct,correct,choices,explanation,prompt:'측정 근거를 바탕으로 가장 먼저 확인할 항목은 무엇인가요?',evidence:{geometry:score.components.geometry,cd:score.components.cd,doping:score.components.doping??null,checks:checks.map(c=>({name:c.name,pass:c.pass,detail:c.detail})),measure:m?{kind:m.kind,target:m.target,actual:m.actual,error:m.error}:null,cost:score.actualCost,referenceCost:score.referenceCost,eligible:score.eligible}};
 }
 function answer(q,choice,reason){if(!q.choices.some(c=>c.id===choice))return {error:'확인할 항목을 하나 선택하세요.'};if(typeof reason!=='string'||reason.trim().length<15)return {error:'관측한 수치와 이유를 15자 이상 적어주세요.'};if(reason.length>1200)return {error:'이유는 1,200자 이내로 적어주세요.'};return {correct:choice===q.correct,explanation:q.explanation};}
 // AI prioritizes existing findings; it cannot introduce another score or an
 // unobserved defect. Alternate, successful recipes are not treated as errors.
 function designQuestion(score,report){
  const fallback=question(score);
  if(score.designSpec||score.eligible||!report?.ai?.suggestions?.length)return fallback;
  const tip=report.ai.suggestions.find(s=>(report.findings||[]).some(f=>f.id===s.id&&['missing','order','condition'].includes(f.kind)));
  const finding=report.findings?.find(f=>f.id===tip?.id);
  if(!finding)return fallback;
  const action={missing:'누락 가능성을 확인한다',order:'앞뒤 순서를 확인한다',condition:'입력 조건을 비교한다'}[finding.kind];
  const choices=[
   {id:'check',text:`${finding.title}의 ${action}.`},
   {id:'mask',text:'다른 단계의 마스크 개구 폭과 정렬 위치부터 조정한다.'},
   {id:'coverage',text:'다른 단계의 증착 방식과 측벽 피복성부터 비교한다.'},
   {id:'thermal',text:'다른 단계의 열처리 온도와 확산 시간을 먼저 변경한다.'},
   {id:'polish',text:'마지막 평탄화 단계의 제거 시간부터 조정한다.'}
  ];
  // Stable permutation: the expected choice is not always in the first slot.
  const shift=Array.from(finding.id).reduce((a,c)=>a+c.charCodeAt(0),0)%5;
  return {...fallback,id:finding.id,correct:'check',choices:choices.slice(shift).concat(choices.slice(0,shift)),
   prompt:'AI가 선택한 검토 지점입니다. 아래 공정 차이를 직접 확인하는 조치는 무엇인가요?',
   observation: finding.kind==='condition'?finding.detail:`기준 STEP ${finding.referenceStep}와 내 레시피의 대응 관계를 확인하세요. ${finding.kind==='order'?'같은 공정이 다른 위치에 있습니다.':'대응 단계가 확인되지 않았습니다.'}`,
   explanation:tip.analysis+' '+tip.action,source:'AI 분석 · 기준 레시피 차이',findingId:finding.id};
 }
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
 const api={question,designQuestion,answer,experiment,planOptions};if(typeof module==='object'&&module.exports){module.exports=api;return;}root.RecipeStudio=api;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 api.diagnose=(host,score,target,steps,onDone,context={})=>{
  const q=designQuestion(score,context.report),e=q.evidence;
  host.innerHTML=`<div class="rs-diagnosis"><span class="rs-eyebrow">01 · EVIDENCE</span><h3>결과를 읽고 원인을 좁혀보세요</h3><div class="rs-evidence"><div><small>${score.geometryReferenceOnly?'참고 형상':'형상 일치'}</small><strong>${e.geometry.toFixed(1)}<em>%</em></strong></div><div><small>치수 달성</small><strong>${e.cd.toFixed(1)}<em>/100</em></strong></div><div><small>농도 일치</small><strong>${e.doping===null?'—':e.doping.toFixed(1)}<em>${e.doping===null?'해당 없음':'/100'}</em></strong></div><div><small>교육용 비용 지수</small><strong>${e.cost.toFixed(1)}<em>기준 ${e.referenceCost.toFixed(1)}</em></strong></div></div>${e.measure?`<p class="rs-observed">${esc(e.measure.kind)} ${e.measure.actual.toFixed(1)} nm / 목표 ${e.measure.target.toFixed(1)} nm · 오차 ${(e.measure.error*100).toFixed(1)}%</p>`:''}${e.checks.filter(c=>c.name!=='주입·열처리 완료').length?`<ul class="rs-checks">${e.checks.filter(c=>c.name!=='주입·열처리 완료').map(c=>`<li><b>${c.pass?'PASS':'CHECK'}</b> ${esc(c.name)} <small>${esc(c.detail)}</small></li>`).join('')}</ul>`:''}<form id="rs-quiz"><fieldset><legend>02 · ${esc(q.prompt)}</legend>${q.choices.map((c,i)=>`<label class="rs-choice"><input type="radio" name="diagnosis" value="${c.id}"><span><b>${i+1}</b>${esc(c.text)}</span></label>`).join('')}</fieldset><label class="rs-reason" for="rs-reason">관측 근거와 다음 실험</label><textarea id="rs-reason" maxlength="1200" rows="3" placeholder="어떤 수치를 봤고, 어느 조건을 바꿔 확인할지 적어주세요."></textarea><p id="rs-error" role="status"></p><button class="primary" type="submit">제출하고 해설 보기</button><p class="rs-note">선택지는 수치 근거로 확인합니다. 서술 답변은 자동 채점하지 않습니다.</p></form></div>`;
  const metrics={geometry:'형상 일치',cd:'치수 달성',doping:'농도 일치',efficiency:'효율'};
  if(q.observation)host.querySelector('fieldset').insertAdjacentHTML('afterbegin',`<p class="rs-observed">${esc(q.observation)}</p>`);
  host.querySelector('h3').textContent='공정설계 평가';
  const source=document.createElement('p');source.className='rs-note';source.textContent=q.source||context.aiState||'수치 기반 문제';host.querySelector('h3').after(source);
  if(context.scope)host.querySelector('.rs-diagnosis').insertAdjacentHTML('afterbegin',`<p class="rs-observed">${esc(context.scope)}</p>`);
  const options=planOptions(steps,context.operations),form=host.querySelector('form');
  form.querySelector('button[type=submit]').insertAdjacentHTML('beforebegin',`<details class="rs-plan"><summary>다음 실험 설계 · 선택</summary><div class="rs-plan-grid"><label>변경할 조건<select id="rs-variable"><option value="">선택하세요</option>${options.map(o=>`<option value="${o.id}">STEP ${o.step} · ${esc(ProcessUI.displayField(o.field).label)} (${ProcessUI.displayValue(o.field,o.value)} ${esc(ProcessUI.displayField(o.field).unit)})</option>`).join('')}</select></label><label>관찰할 점수<select id="rs-metric">${Object.keys(score.components).map(k=>`<option value="${k}">${metrics[k]}</option>`).join('')}</select></label><label>예상 변화<select id="rs-prediction"><option>증가</option><option>감소</option><option>유지</option></select></label></div><p class="rs-note">선택한 조건을 바꿔 재계산하고 예상한 변화와 비교하세요.</p></details>`);
  host.querySelector('form').onsubmit=event=>{event.preventDefault();const choice=host.querySelector('input:checked')?.value,reason=host.querySelector('textarea').value.trim(),result=answer(q,choice,reason);if(result.error){host.querySelector('#rs-error').textContent=result.error;return;}if(!result.correct){host.querySelector('#rs-error').textContent='관측 근거와 직접 연결되는 조치를 다시 골라보세요.';return;}const plan=host.querySelector('#rs-variable').value?{label:host.querySelector('#rs-variable').selectedOptions[0].textContent,metric:metrics[host.querySelector('#rs-metric').value],prediction:host.querySelector('#rs-prediction').value}:null;onDone({...result,choice,reason,plan});};
 };
 api.feedback=r=>`<div class="rs-feedback"><b>${r.correct?'근거와 맞는 판단입니다.':'다른 근거를 함께 확인해보세요.'}</b><p>${esc(r.explanation)}</p>${r.plan?`<p><b>다음 실험</b><br>${esc(r.plan.label)}<br>${esc(r.plan.metric)} · 예상 ${esc(r.plan.prediction)}</p>`:''}<small>서술 답변은 자동 채점하지 않았습니다.</small></div>`;
 const dialog=document.createElement('dialog');dialog.className='rs-dialog';dialog.setAttribute('aria-labelledby','rs-title');document.body.append(dialog);let generation=0;
 function shell(title){dialog.innerHTML=`<header><div><span class="rs-eyebrow">RECIPE STUDIO</span><h2 id="rs-title">${esc(title)}</h2></div><button class="rs-close" aria-label="닫기">×</button></header><div class="rs-body" role="status">불러오는 중…</div>`;dialog.querySelector('.rs-close').onclick=()=>{generation++;dialog.close();};if(!dialog.open)dialog.showModal();return dialog.querySelector('.rs-body');}
 dialog.addEventListener('cancel',()=>generation++);
 api.open=async(targetId,onLoad,context={})=>{
  const mine=++generation,body=shell('플로우 후보 비교');
  try{const response=await fetch('/api/flow-candidates/'+encodeURIComponent(targetId),{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('후보를 불러오지 못했습니다. 잠시 후 다시 시도하세요.');const entry=await response.json();if(mine!==generation)return;
   if(!Array.isArray(entry.candidates)||entry.candidates.length!==3)throw Error('후보 3개가 준비되지 않았습니다.');
   const money=entry.candidates[0].metrics.cost;
   body.innerHTML=`<p class="rs-intro">${esc(entry.title)} · 설계 경로 선택${context.customSpec?' · 수정한 목표는 불러온 뒤 다시 평가하세요.':''}</p><div class="rs-candidates">${entry.candidates.map((c,i)=>`<article class="rs-candidate"><div class="rs-candidate-top"><span>${i===0?'기존':'후보 '+(i+1)}</span><b class="rs-badge ${c.metrics.eligible?'pass':''}">${c.metrics.eligible?(context.customSpec?'원본 목표 충족':'측정 목표 충족'):'비교 실험'}</b></div><h3>${esc(c.name)}</h3><p>${esc(c.description)}</p><div class="rs-route-summary"><b>핵심 특징</b><span>${esc(c.benefit||'기준 공정의 구조를 관찰합니다.')}</span><b>비교할 점</b><span>${esc(c.tradeoff||c.observe||'조건을 바꿔 단면을 비교하세요.')}</span></div><dl><div><dt>형상 일치</dt><dd>${c.metrics.geometry.toFixed(1)}%</dd></div><div><dt>상대 비용 지수</dt><dd>${Math.round(c.metrics.cost/money*100)}</dd></div><div><dt>단계 수</dt><dd>${c.steps.length}</dd></div></dl><button class="primary" data-load="${i}">예제 flow 불러오기</button></article>`).join('')}</div><p class="rs-note">비용: 교육용 상대 지수</p>`;
   if(context.feedback)body.insertAdjacentHTML('afterbegin',api.feedback(context.feedback));
   if(context.detail)body.insertAdjacentHTML('beforeend',`<details class="rs-detail"><summary>공정설계 평가 상세</summary>${context.detail}</details>`);
   body.querySelectorAll('[data-load]').forEach(b=>b.onclick=async()=>{if(mine!==generation||b.disabled)return;body.querySelectorAll('[data-load]').forEach(x=>x.disabled=true);try{await onLoad({...structuredClone(entry.candidates[Number(b.dataset.load)]),targetId});dialog.close();generation++;}catch(e){body.querySelectorAll('[data-load]').forEach(x=>x.disabled=false);let err=body.querySelector('.rs-load-error');if(!err){err=document.createElement('p');err.className='rs-load-error';err.setAttribute('role','alert');body.prepend(err);}err.textContent=e.message;}});
  }catch(e){if(mine===generation)body.textContent=e.name==='TimeoutError'?'후보 응답이 지연됩니다. 다시 열어주세요.':e.message;}
 };
 const candidates=document.createElement('button');candidates.id='lab-candidates';candidates.textContent='플로우 후보';document.querySelector('#observation .process-panel .toolbar').prepend(candidates);
 candidates.onclick=()=>{if(!selected)return;const id=selected.id;api.open(id,async c=>{if(selected.id!==id)throw Error('예제가 변경되었습니다. 후보를 다시 선택하세요.');if(busy)throw Error('현재 계산이 끝난 후 후보를 적용하세요.');await reverseLab.select(id);await reverseLab.loadCandidate(c);});};
})(typeof window==='object'?window:globalThis);
