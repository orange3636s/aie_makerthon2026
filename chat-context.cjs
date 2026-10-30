'use strict';
// Only server-owned simulation results are accepted as numerical evidence.
const fail=message=>{throw Object.assign(Error(message),{status:400})};
function validate(data){
 if(typeof data.question!=='string'||!data.question.trim()||data.question.length>1000)fail('질문은 1–1000자로 입력하세요.');
 const history=data.history??[];
 if(!Array.isArray(history)||history.length>8||history.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>3000))fail('대화 내역을 확인하세요.');
 if(data.pending!==undefined&&typeof data.pending!=='boolean')fail('계산 상태를 확인하세요.');
 return {question:data.question.trim(),history:history.map(({role,content})=>({role,content}))};
}
function build(data,verified){
 const base=validate(data);
 if(!verified)return {...base,selectedEvidence:{status:'unavailable'},scope:'일반 반도체 학습 질문'};
 const {report,input,matching}=verified;
 if(!Number.isInteger(data.selectedStep)||data.selectedStep<0||data.selectedStep>input.steps.length)fail('선택 단계를 확인하세요.');
 const f=!data.pending&&(matching?.frames.find(f=>f.stepIndex===data.selectedStep)||matching?.frames[data.selectedStep]);
 const fields=f?.concentration?.fields||{},mask=f?.concentration?.mask||[];
 const selectedEvidence=f?{
  status:'server-verified',layers:require('./web/learning-score.js').layers(f),
  dopantPeaks:Object.fromEntries(Object.entries(fields).filter(([k])=>!k.startsWith('net')).map(([k,a])=>[k,{value:a.reduce((v,n,i)=>mask[i]&&Number.isFinite(n)?Math.max(v,n):v,0),unit:'cm^-3'}])),
  diagnostics:require('./web/learning-lab-models.js').diagnostics(f,input.steps.slice(0,data.selectedStep),matching.bounds)
 }:{status:'unavailable'};
 return {...base,target:report.target,scope:report.scope,selectedStep:data.selectedStep,selectedLabel:data.selectedStep?(input.steps[data.selectedStep-1].label||input.steps[data.selectedStep-1].op):'Wafer',pending:!!data.pending,flow:report.actualFlow,selectedEvidence};
}
module.exports={validate,build};
