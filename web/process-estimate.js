'use strict';
// Preflight reference values, not a substitute for transport/coverage simulation.
(function(root){
 const ui=typeof module==='object'&&module.exports?require('./ui-contract.js'):root.ProcessUI;
 const response=typeof module==='object'&&module.exports?require('./recipe-response.js'):root.RecipeResponse;
 const format=value=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(value);
 function estimate(operation,params){
  if(!operation||!['deposition','etch'].includes(operation.id))return null;
  const invalid=operation.fields.find(f=>ui.active(f,params)&&!ui.valid(f,params[f.key]));
  if(invalid)return {invalid:true,title:'계산 전 미리보기',message:ui.text(invalid.label)+' 입력 범위를 확인하세요.'};
  const material=ui.label(params.material);
  if(['PVD','CVD','ALD','Directional','Isotropic','ALE'].includes(params.method)){
   try{const value=response.nominal(operation.id,params);if(!value||!Number.isFinite(value.nm))throw Error('조건을 확인하세요.');return {title:operation.id==='etch'?'예상 식각 깊이':'예상 증착 두께',material,nm:value.nm,value:format(value.nm)+'nm',basis:'학습 모델 · 노출 평면 기준',note:'실측 보정 전 교육용 응답 모델'};}
   catch(e){return {invalid:true,title:'계산 전 미리보기',message:e.message};}
  }
  if(operation.id==='etch'){
   const note='선택 재료 외에는 완전 보호 · 식각액별 선택비 미반영';
   if(params.method==='Selective removal')return {title:'제거 범위',material,value:'재료 전체',basis:'기하 제거',formula:'선택한 재료를 구조 전체에서 제거합니다.',note};
   const nm=(params.method==='ALE'?params.epc*params.cycles:params.rate*params.time)*1000;
   return {title:'예상 식각 깊이',material,nm,value:format(nm)+'nm',basis:'노출 평면 기준',formula:params.method==='ALE'?format(params.epc*1000)+' nm/cycle × '+format(params.cycles)+' cycles':format(params.rate*1000)+' nm/s × '+format(params.time)+' s',detail:'실제 깊이와 언더컷은 형상·가림 조건에 따라 달라집니다.',note};
  }
  const ald=params.method==='ALD',geometric=params.method==='Conformal';
  const nm=(ald?params.gpc*params.cycles:params.rate*params.time)*1000;
  if(!Number.isFinite(nm)||nm<0)return {invalid:true,title:'계산 전 미리보기',message:'성장 조건을 확인하세요.'};
  return {title:'예상 증착 두께',material,nm,value:format(nm)+'nm',basis:ald?'포화 성장 기준':geometric?'기하 성장 기준':'평면 기준',
   formula:ald?format(params.gpc*1000)+' nm/cycle × '+format(params.cycles)+' cycles':format(params.rate*1000)+' nm/s × '+format(params.time)+' s',
   detail:ald?'실제 두께는 표면 피복률에 따라 달라집니다.':geometric?'지정 두께만큼 경계를 등각 확장합니다.':'측벽·바닥 두께와 step coverage는 공정 계산 후 확인합니다.',
   note:'재료별 반응·온도 보정 미적용'};
 }
 function example(spec,params){
  if(!spec||!['pvd','cvd','ald'].includes(spec.id))return null;
  // These reference rates match the recipe adapter in process_presets.py.
  return estimate({id:'deposition',fields:spec.fields},{...params,method:spec.id.toUpperCase(),material:'SiO2',rate:.08,gpc:.0001,ald_sticking:params.sticking});
 }
 function render(element,data){
  element.hidden=!data; element.replaceChildren(); if(!data)return;
  element.className='process-estimate'+(data.invalid?' invalid':'');
  element.setAttribute('role','status');element.setAttribute('aria-live','polite');
  const add=(tag,className,value)=>{const node=element.ownerDocument.createElement(tag);node.className=className;node.textContent=value;element.append(node);};
  add('span','estimate-title',data.title);
  if(data.invalid){add('p','estimate-note',data.message);return;}
  add('strong','estimate-value',data.value);

 }
 const api={estimate,example,render};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ProcessEstimate=api;
})(typeof window==='object'?window:globalThis);
