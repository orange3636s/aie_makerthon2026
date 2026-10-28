'use strict';
(function(root){
 const UI=typeof module==='object'&&module.exports?require('./ui-contract.js'):root.ProcessUI;
 const titles={photo:'Photo',etch:'Etch',deposition:'Deposition',diffusion:'Diffusion',cmp:'Planarization'};
 function defaults(row,operations){const op=operations.find(o=>o.id===row.op);return {...Object.fromEntries(op.fields.map(f=>[f.key,f.default])),...op.presets?.[row.params?.method],...row.params}}
 function signature(row,p){return JSON.stringify([row.op,...(row.op==='photo'?[p.action,...(p.action==='Pattern'?[p.pattern,p.tone]:[])]:row.op==='diffusion'?[p.method,...(['Ion implantation','Pre-deposition'].includes(p.method)?[p.species]:[])]:row.op==='cmp'?[]:[p.method,p.material])])}
 function name(row,p){return row.label||(titles[row.op]+(p.material?' · '+p.material:row.op==='diffusion'?' · '+p.method+(['Ion implantation','Pre-deposition'].includes(p.method)?' '+p.species:''):row.op==='photo'?' · '+p.action:''))}
 function compare(target,actual,operations){
  const prep=(s,i)=>{const p=defaults(s,operations);return {s,p,index:i+1,key:signature(s,p),name:name(s,p)}};
  const a=target.recipe.map(prep),b=actual.map(prep),dp=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
  for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)dp[i][j]=a[i].key===b[j].key?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
  const pairs=[],missing=[],extra=[];let i=0,j=0;
  while(i<a.length||j<b.length){if(i<a.length&&j<b.length&&a[i].key===b[j].key){pairs.push([a[i++],b[j++]]);}else if(i<a.length&&(j===b.length||dp[i+1][j]>=dp[i][j+1]))missing.push(a[i++]);else extra.push(b[j++]);}
  const findings=[];
  for(const x of missing){const k=extra.findIndex(y=>y.key===x.key),y=k<0?null:extra.splice(k,1)[0];findings.push({id:'step-'+x.index,kind:y?'order':'missing',referenceStep:x.index,actualStep:y?.index||null,title:x.name,detail:y?`기준 STEP ${x.index} · 내 STEP ${y.index}`:`기준 STEP ${x.index}에 대응하는 공정이 없습니다.`,action:y?'전후 공정과 순서를 확인하세요.':'기준 흐름과 비교해 이 공정의 필요성을 확인하세요.'});}
  for(const [x,y] of pairs){const op=operations.find(o=>o.id===x.s.op),diff=op.fields.filter(f=>f.key!=='slurry').filter(f=>(!f.when||Object.entries(f.when).every(([key,values])=>values.includes(x.p[key])&&values.includes(y.p[key])))).filter(f=>typeof x.p[f.key]==='number'?Math.abs(x.p[f.key]-y.p[f.key])>Math.max(1e-12,Math.abs(x.p[f.key])*1e-6):x.p[f.key]!==y.p[f.key]);if(diff.length)findings.push({id:'condition-'+x.index,kind:'condition',referenceStep:x.index,actualStep:y.index,title:x.name,detail:diff.map(f=>`${UI.fieldLabel(f)}: ${UI.displayValue(f,x.p[f.key])} → ${UI.displayValue(f,y.p[f.key])}${UI.displayField(f).unit?' '+UI.displayField(f).unit:''}`).join(' · '),action:'조건 차이가 형상·농도에 미치는 영향을 비교하세요.'});}
  for(const y of extra)findings.push({id:'extra-'+y.index,kind:'extra',referenceStep:null,actualStep:y.index,title:y.name,detail:`내 STEP ${y.index} · 기준 흐름에 대응하지 않는 공정`,action:'필요한 추가 공정인지 결과로 판단하세요.'});
  findings.sort((x,y)=>(x.referenceStep||100+x.actualStep)-(y.referenceStep||100+y.actualStep));
  return {findings,matched:pairs.length,referenceCount:a.length,actualCount:b.length,summary:findings.length?`기준 흐름 대비 누락 후보 ${findings.filter(f=>f.kind==='missing').length}개 · 조건 차이 ${findings.filter(f=>f.kind==='condition').length}개 · 순서 차이 ${findings.filter(f=>f.kind==='order').length}개`:'기준 흐름과 공정 순서·조건이 일치합니다.',note:'기준 레시피와의 비교입니다. 다른 유효한 공정 경로가 있을 수 있으며 전기적 동작을 검증하지 않습니다.'};
 }
 function describeFlow(rows,operations){return rows.map(row=>{const op=operations.find(o=>o.id===row.op),p=defaults(row,operations),fields=op.fields.filter(f=>UI.active(f,p));return {op:row.op,label:row.label,params:Object.fromEntries(fields.map(f=>[f.key,UI.displayValue(f,p[f.key])])),units:Object.fromEntries(fields.map(f=>[f.key,UI.displayField(f).unit]))}})}
 const api={compare,describeFlow};if(typeof module!=='undefined')module.exports=api;else root.ProcessReview=api;
})(typeof window!=='undefined'?window:this);
