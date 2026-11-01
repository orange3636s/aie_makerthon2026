'use strict';
const L=require('./web/learning-score.js'),materials=require('./web/materials.js');
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const signature=steps=>canonical(steps.map(s=>({op:s.op,params:s.params})));
function evidence(reference,result,target){
 if(!result||result.failure)return {status:'unavailable',reason:'일치하는 서버 계산 결과 없음. 수치·결함 발생을 추측하지 마세요.'};
 const score=L.assess(reference.frames.at(-1),result.frames.at(-1),target.roi,target,reference.steps,result.steps);
 return {status:'server-verified',source:'LearningScore v4 / native result',designSpec:score.designSpec,geometryReferenceOnly:score.geometryReferenceOnly,score:score.score,components:score.components,eligible:score.eligible,measurements:score.measures.map(m=>({materialId:m.id,material:materials[m.id]?.name||String(m.id),kind:m.kind,axis:m.axis,at_nm:m.at*1000,target_nm:m.target,actual_nm:m.actual,error_percent:m.error*100,pass:m.pass})),checks:score.checks,tradeoffs:score.tradeoffs,relativeCost:{reference:score.referenceCost,actual:score.actualCost},limitations:['전기 동작 및 제조 수율 미검증','비용은 교육용 지수','레시피 차이 자체가 실패를 의미하지 않음']};
}
module.exports={signature,evidence};
