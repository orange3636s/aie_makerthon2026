'use strict';
(function(root){
 const Recipe=typeof module==='object'&&module.exports?require('./recipe-state.js'):root.RecipeState;
 const cases=[
  {id:'activation',title:'농도 이상',symptom:'형상은 비슷하지만 소스·드레인의 활성 도펀트 농도가 목표에 미달합니다.',goal:'형상·치수를 유지하면서 도핑 조건과 후속 공정의 연결을 복구하세요.'},
  {id:'oxide',title:'절연막 두께 편차',symptom:'게이트 아래 절연막이 목표보다 두껍습니다. 이후 공정에도 치수 차이가 이어집니다.',goal:'게이트 절연막과 최종 구조의 치수 오차를 허용 범위로 줄이세요.'},
  {id:'cost',title:'불필요한 처리 비용',symptom:'목표 형상은 충족하지만 중복 처리가 포함되어 공정 비용 지수가 증가했습니다.',goal:'형상·치수·도핑 목표를 유지하면서 비용 지수를 기준 흐름 이하로 줄이세요.'}
 ];
 function recipe(id,reference){
  let steps=structuredClone(reference.steps);
  if(id==='activation')steps=steps.filter(s=>!(s.op==='diffusion'&&['Anneal','Drive-in'].includes(s.params.method)));
  else if(id==='oxide'){const s=steps.find(s=>s.op==='deposition'&&s.params.material==='SiO2');s.params.cycles=Math.round(s.params.cycles*1.5);}
  else if(id==='cost'){const coat=steps.find(s=>s.op==='photo'&&s.params.action==='Coat'),strip=steps.find(s=>s.op==='photo'&&s.params.action==='Strip');steps.unshift(structuredClone(coat),structuredClone(strip));}
  else throw Error('지원하지 않는 불량 과제입니다.');
  return {id:'defect-'+id,targetId:'mosfet',name:cases.find(c=>c.id===id).title,steps};
 }
 function check(id,context,target,models,score,operations){
  const out=models.checkMission(context.reference,context.result,target,{pending:context.pending});
  if(out.status==='unavailable')return out;
  const current=score.cost(Recipe.restore(context.result.steps,operations)),limit=score.cost(Recipe.restore(context.reference.steps,operations));
  let oxide=null,oxidePass=true;
  if(id==='oxide'){
   const thickness=f=>{const spans=score.intervals(f,30,1,0).filter(([a,b])=>a<=.01&&b>0);return spans.length?(spans[0][1]-spans[0][0])*1000:null;};
   const expected=thickness(context.reference.frames.at(-1)),actual=thickness(context.result.frames.at(-1));
   oxide={expected,actual};oxidePass=Number.isFinite(actual)&&Number.isFinite(expected)&&Math.abs(actual-expected)<=expected*.05;
  }
  return {...out,status:out.status==='pass'&&oxidePass&&(id!=='cost'||current<=limit+1e-8)?'pass':'retry',cost:current,costLimit:limit,oxide};
 }
 const api={cases,recipe,check};if(typeof module==='object'&&module.exports)module.exports=api;else root.DefectLabModels=api;
})(typeof window==='object'?window:globalThis);
