/* Educational rubric: measured cross-section dimensions and relative recipe effort.
   No electrical solver, fabricated factory costs, or inferred TEM segmentation. */
(function(root){
 const G=typeof module==='object'&&module.exports?require('./grading.js'):root.SimulationGrading;
 const clamp=v=>Math.max(0,Math.min(100,v));
 function intervals(frame,id,axis,at){
  let spans=[];const other=1-axis;
  for(const p of frame.polygons){
   const xs=[];for(let i=0,j=p.points.length-1;i<p.points.length;j=i++){
    const a=p.points[i],b=p.points[j];if((a[other]>at)!==(b[other]>at))xs.push(a[axis]+(at-a[other])*(b[axis]-a[axis])/(b[other]-a[other]));
   }
   xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)if(xs[i+1]-xs[i]>1e-6){
    const a=xs[i],b=xs[i+1];
    if(p.material===id)spans.push([a,b]);
    else spans=spans.flatMap(([lo,hi])=>b<=lo||a>=hi?[[lo,hi]]:[...(lo<a?[[lo,a]]:[]),...(hi>b?[[b,hi]]:[])]);
   }
  }
  // Rendering splits a continuous film into viewport tiles. Merge their scanline
  // intervals before measuring CD, otherwise a tile seam looks like a real edge.
  spans.sort((a,b)=>a[0]-b[0]);const out=[];
  for(const span of spans){const last=out.at(-1);if(last&&span[0]<=last[1]+1e-6)last[1]=Math.max(last[1],span[1]);else out.push(span.slice())}return out;
 }
 function closest(rows,anchor){return rows.reduce((best,row)=>!best||Math.abs((row[0]+row[1])/2-anchor)<Math.abs((best[0]+best[1])/2-anchor)?row:best,null)}
 function dimensionPlan(frame,roi,limit=3){
  const priority=[11,79,32,30,16,70,72,80,13,31,201,0],ids=new Set(frame.polygons.map(p=>p.material)),plan=[];
  for(const id of priority.filter(id=>ids.has(id)).slice(0,limit)){
   const points=frame.polygons.filter(p=>p.material===id).flatMap(p=>p.points).filter(p=>p[1]>=roi[2]&&p[1]<=roi[3]);if(!points.length)continue;
   const low=Math.min(...points.map(p=>p[1])),high=Math.max(...points.map(p=>p[1])),y=(low+high)/2;
   const span=closest(intervals(frame,id,0,y),0);if(!span)continue;
   const x=(span[0]+span[1])/2;
   plan.push({id,kind:'폭',axis:0,at:y,anchor:x,target:(span[1]-span[0])*1000});
   const vertical=closest(intervals(frame,id,1,x),y);
   if(vertical)plan.push({id,kind:'두께',axis:1,at:x,anchor:(vertical[0]+vertical[1])/2,target:(vertical[1]-vertical[0])*1000});
  }
  // Bare etched silicon needs a depth measurement, not the full wafer thickness.
  const top=intervals(frame,10,1,0).at(-1)?.[1];
  if(top<-.01)plan.push({id:10,kind:'중앙 식각 깊이',axis:1,at:0,depth:true,target:-top*1000});
  return plan.filter(p=>p.target>1);
 }
 function dimensions(target,actual,roi,limit=3){return dimensionPlan(target,roi,limit).map(p=>{
  const span=p.depth?intervals(actual,p.id,1,0).at(-1):closest(intervals(actual,p.id,p.axis,p.at),p.anchor);
  const measured=span?(p.depth?Math.max(0,-span[1])*1000:(span[1]-span[0])*1000):0;
  const error=Math.abs(measured-p.target)/p.target,score=error<=.05?100:clamp(100*(.5-error)/.45);
  return {...p,actual:measured,error,score,pass:error<=.05};
 })}
 // Teaching effort units, not fab prices. ALD includes cycle/pulse burden;
 // no complete ALD cycle time is claimed because purge/co-reactant times are absent.
 function resources(steps){const rows=steps.map((s,index)=>{const p=s.params||{};let effort=1,seconds=0,partial=false;
  if(s.op==='deposition'){
   if(p.method==='ALD'){seconds=(p.cycles||0)*(p.pulse||0);partial=true;effort=3+(p.cycles||0)*.05+seconds*.1}
   else {seconds=p.time||0;effort=(p.method==='PVD'?2:3)+seconds*.25}
  }else if(s.op==='etch'){if(p.method==='ALE'){effort=2+(p.cycles||0)*.025;partial=true}else{seconds=p.time||0;effort=2+seconds*.25}}
  else if(s.op==='photo'){effort={Coat:1,Patterning:2,Develop:1,Strip:.5}[p.action]||2;seconds=p.action==='Develop'?(p.develop_time||0):0;partial=p.action!=='Develop'}
  else if(s.op==='cmp'){seconds=p.time||0;effort=2+seconds/120}
  else if(s.op==='diffusion'){seconds=/oxidation/.test(p.method)?(p.oxidation_time||0)*3600:p.method==='Anneal'?(p.time||0):['Drive-in','Pre-deposition'].includes(p.method)?(p.diffusion_time||0):0;partial=p.method==='Ion implantation';effort=3+seconds/600}
  return {index:index+1,op:s.op,method:p.method||p.action,effort,seconds,partial,cycles:p.method==='ALD'?(p.cycles||0):0};
 });return {rows,cost:rows.reduce((a,r)=>a+r.effort,0),knownSeconds:rows.reduce((a,r)=>a+r.seconds,0),partial:rows.some(r=>r.partial),aldCycles:rows.reduce((a,r)=>a+r.cycles,0)}}
 function cost(steps){return resources(steps).cost}
 function assess(target,actual,roi,options,referenceSteps,actualSteps){
  const core=G.compare(target,actual,roi,options),measures=dimensions(target,actual,roi);
  const cd=measures.length?measures.reduce((sum,m)=>sum+m.score,0)/measures.length:core.components.geometry*100;
  const doping=core.doping===null?null:core.doping*100;
  const checks=[];
  if(doping!==null){
   checks.push({name:'총·활성 농도 분포',pass:core.components.total>=.9&&core.components.active>=.9,detail:'예시 분포 유사도 각각 90% 이상'});
   checks.push({name:'주입·열처리 완료',pass:core.components.process===1,detail:'필수 도핑종과 최종 열처리 이력'});
   for(const species of options.assessment?.species||[]){
    const peak=(f)=>(f.concentration?.fields?.[species+'_active']||[]).reduce((m,v)=>Math.max(m,v),0);
    const expected=peak(target),value=peak(actual);
    checks.push({name:species+' 활성 농도 최고값',pass:expected>0&&value>=expected*.5&&value<=expected*2,detail:`목표 ${expected.toExponential(1)} · 실측 ${value.toExponential(1)} cm⁻³`});
   }
  }
  const eligible=core.components.geometry>=.9&&measures.every(m=>m.pass)&&checks.every(c=>c.pass);
  const referenceCost=cost(referenceSteps),actualCost=cost(actualSteps);
  const efficiency=eligible?100*(Math.min(1,referenceSteps.length/Math.max(1,actualSteps.length))+Math.min(1,referenceCost/Math.max(1,actualCost)))/2:0;
  const weights=doping===null?{geometry:.6,cd:.25,efficiency:.15}:{geometry:.4,cd:.2,doping:.25,efficiency:.15};
  const components={geometry:core.components.geometry*100,cd,efficiency,...(doping===null?{}:{doping})};
  let score=Math.round(Object.entries(weights).reduce((sum,[key,weight])=>sum+components[key]*weight,0));
  // Missing dopants/anneal may never be offset by geometry or a shorter recipe.
  if(!checks.every(c=>c.pass))score=Math.min(score,core.score,79);
  const hints=[];
  for(const m of measures.filter(m=>!m.pass).sort((a,b)=>b.error-a.error).slice(0,2))hints.push({id:m.id,text:`${m.kind} ${m.actual.toFixed(1)} nm / 목표 ${m.target.toFixed(1)} nm. 해당 재료의 ${m.actual>m.target?'성장량을 줄이거나 제거량을 늘리는':'성장량을 늘리거나 제거량을 줄이는'} 조건을 한 가지씩 비교하세요.`});
  if(!checks.every(c=>c.pass))hints.push({text:'도핑종·주입 마스크·에너지와 마지막 열처리 순서를 확인하세요.'});
  if(eligible&&actualCost>referenceCost)hints.push({text:'목표 조건은 충족했습니다. 추가 증착·식각·마스크 단계 중 결과에 필요하지 않은 단계를 비교해 보세요.'});
  if(!hints.length)hints.push({text:eligible?'현재 형상·치수와 필수 조건이 목표 범위에 있습니다.':'재료별 형상 차이와 공정 누락을 먼저 확인하세요.'});
  const referenceResources=resources(referenceSteps),actualResources=resources(actualSteps),tradeoffs=[];
  if(actualResources.aldCycles>referenceResources.aldCycles)tradeoffs.push(`ALD ${actualResources.aldCycles} cycles · 예시 ${referenceResources.aldCycles} cycles. 반복량 증가가 비용 지수에 반영됩니다.`);
  if(actualCost>referenceCost*1.01)tradeoffs.push(`교육용 비용 지수 ${referenceCost.toFixed(1)} → ${actualCost.toFixed(1)} (+${((actualCost/referenceCost-1)*100).toFixed(0)}%). ${eligible?'효율 점수에 반영했습니다.':'목표 조건 충족 전까지 효율 평가는 보류합니다.'}`);
  return {version:4,score,core,weights,measures,checks,eligible,referenceCost,actualCost,referenceSteps:referenceSteps.length,actualSteps:actualSteps.length,components,hints:hints.slice(0,3),referenceResources,actualResources,tradeoffs};
 }
 function layers(frame){
  const points=frame.polygons.flatMap(p=>p.points),xs=points.map(p=>p[0]),left=Math.min(...xs),right=Math.max(...xs),center=(left+right)/2;
  const cuts=[center-(right-left)*.3125,center,center+(right-left)*.3125],ids=[...new Set(frame.polygons.map(p=>p.material))],rows=[],counts={};
  for(const x of cuts)for(const id of ids)for(const vertical of intervals(frame,id,1,x)){
   const y=(vertical[0]+vertical[1])/2,span=intervals(frame,id,0,y).find(s=>s[0]-1e-6<=x&&s[1]+1e-6>=x);
   if(span&&(vertical[1]-vertical[0])*1000>1)rows.push({id,x:x*1000,y:y*1000,width:(span[1]-span[0])*1000,thickness:(vertical[1]-vertical[0])*1000});
  }
  return rows.sort((a,b)=>a.x-b.x||a.y-b.y).map(p=>({...p,region:counts[p.id]=(counts[p.id]||0)+1}));
 }
 const api={assess,dimensions,layers,cost,resources,intervals};if(typeof module==='object'&&module.exports)module.exports=api;else root.LearningScore=api;
})(typeof window==='object'?window:globalThis);
