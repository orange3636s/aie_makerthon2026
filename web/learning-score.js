/* Educational rubric: measured cross-section dimensions and relative recipe effort.
   No electrical solver, fabricated factory costs, or inferred TEM segmentation. */
(function(root){
 const G=typeof module==='object'&&module.exports?require('./grading.js'):root.SimulationGrading;
 const clamp=v=>Math.max(0,Math.min(100,v));
 function intervals(frame,id,axis,at){
  let spans=[];const other=1-axis;
  // Native hulls carry exterior rings and holes as separate contours.
  // Apply the same material-group even/odd rule as 2D/3D rendering and IoU.
  const groups=new Map();for(const p of frame.polygons){if(!groups.has(p.material))groups.set(p.material,[]);groups.get(p.material).push(p);}
  for(const [material,polys] of groups){
   const xs=[];for(const p of polys)for(let i=0,j=p.points.length-1;i<p.points.length;j=i++){
    const a=p.points[i],b=p.points[j];if((a[other]>at)!==(b[other]>at))xs.push(a[axis]+(at-a[other])*(b[axis]-a[axis])/(b[other]-a[other]));
   }
   xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)if(xs[i+1]-xs[i]>1e-6){
    const a=xs[i],b=xs[i+1];
    if(material===id)spans.push([a,b]);
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
   const low=Math.min(...points.map(p=>p[1])),high=Math.max(...points.map(p=>p[1]));
   let y=(low+high)/2,span=closest(intervals(frame,id,0,y),0);
   // A stack's midpoint can fall in a different material between two tiers.
   if(!span){
    const layer=closest(intervals(frame,id,1,0).filter(([a,b])=>b>roi[2]&&a<roi[3]),y);
    if(!layer)continue;
    y=(Math.max(layer[0],roi[2])+Math.min(layer[1],roi[3]))/2;
    span=closest(intervals(frame,id,0,y),0);
    if(!span)continue;
   }
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
 // Teaching effort units, not fab prices. Explicit ALD timing uses symmetric
 // A/purge/B/purge pulses. Transfer, pumping and thermal ramps remain excluded.
 function resources(steps){const rows=steps.map((s,index)=>{const p=s.params||{};let effort=1,seconds=0,partial=false;
  if(s.op==='deposition'){
   if(p.method==='ALD'){const pulse=(p.cycles||0)*(p.pulse||0);seconds=Number.isFinite(p.purge_time)?2*(p.cycles||0)*((p.pulse||0)+p.purge_time):pulse;partial=!Number.isFinite(p.purge_time);effort=3+(p.cycles||0)*.05+seconds*.1}
   else {seconds=p.time||0;effort=(p.method==='PVD'?2:3)+seconds*.25}
  }else if(s.op==='etch'){if(p.method==='ALE'){effort=2+(p.cycles||0)*.025;partial=true}else{seconds=p.time||0;effort=2+seconds*.25}}
  else if(s.op==='photo'){effort={Coat:1,Patterning:2,Develop:1,Strip:.5}[p.action]||2;if(p.action==='Exposure')effort=({248:2,193:3,13.5:6}[p.wavelength]||3);const key={Coat:'spin_time',HMDS:'treatment_time','Soft bake':'bake_time',PEB:'bake_time','Hard bake':'bake_time',Develop:'develop_time',Ashing:'ash_time'}[p.action];seconds=key?(p[key]||0):0;partial=!key||!Number.isFinite(p[key])}
  else if(s.op==='cmp'){seconds=p.action==='Cleaning'?(p.clean_time||0):(p.time||0);effort=2+seconds/120}
  else if(s.op==='diffusion'){seconds=/oxidation/.test(p.method)?(p.oxidation_time||0)*3600:p.method==='Anneal'?(p.time||0):['Drive-in','Pre-deposition'].includes(p.method)?(p.diffusion_time||0):0;partial=p.method==='Ion implantation';effort=3+seconds/600}
  return {index:index+1,op:s.op,method:p.method||p.action,effort,seconds,partial,cycles:p.method==='ALD'?(p.cycles||0):0};
 });return {rows,cost:rows.reduce((a,r)=>a+r.effort,0),knownSeconds:rows.reduce((a,r)=>a+r.seconds,0),partial:rows.some(r=>r.partial),aldCycles:rows.reduce((a,r)=>a+r.cycles,0)}}
 function cost(steps){return resources(steps).cost}
 // Editable assignments use fixed measurement cuts; the example shape is illustrative.
 function specification(frame,roi,options={}){
  const cuts=dimensionPlan(frame,roi).map((m,i)=>({...m,key:`${i}:${m.id}:${m.axis}`}));
  const peaks=['B','P','As'].filter(s=>!frame.concentration?.background||(options.assessment?.species||frame.processEvidence?.dopedSpecies||[]).includes(s)).map(species=>({species,value:(frame.concentration?.fields?.[species+'_active']||[]).reduce((a,b)=>Math.max(a,b),0)})).filter(p=>p.value>0);
  return {version:1,targetId:options.id,dimensions:cuts.map(m=>({key:m.key,value:m.target})),peaks,tolerance:5,cuts};
 }
 function validateSpec(frame,roi,options,input){
  if(input==null)return null;
  const base=specification(frame,roi,options),fail=()=>{throw Error('설계 목표 형식 또는 값이 유효하지 않습니다. 목표를 다시 설정하세요.');};
  if(input.version!==1||input.targetId!==options.id||!Array.isArray(input.dimensions)||!Array.isArray(input.peaks)||input.dimensions.length!==base.dimensions.length||input.peaks.length!==base.peaks.length||!Number.isFinite(input.tolerance)||input.tolerance<1||input.tolerance>20)fail();
  function values(rows,expected,key,min,max){return expected.map(e=>{const match=rows.filter(r=>r&&r[key]===e[key]);if(match.length!==1||typeof match[0].value!=='number'||!Number.isFinite(match[0].value)||match[0].value<min||match[0].value>max)fail();return {[key]:e[key],value:match[0].value};});}
  return {version:1,targetId:options.id,dimensions:values(input.dimensions,base.dimensions,'key',1,100000),peaks:values(input.peaks,base.peaks,'species',1e10,1e22),tolerance:input.tolerance};
 }
 function assess(target,actual,roi,options,referenceSteps,actualSteps){
  const spec=validateSpec(target,roi,options,options.designSpec),tolerance=(spec?.tolerance??5)/100;
  const core=G.compare(target,actual,roi,options),measures=dimensions(target,actual,roi);
  if(spec)measures.forEach((m,i)=>{m.target=spec.dimensions[i].value;m.error=Math.abs(m.actual-m.target)/m.target;m.pass=m.error<=tolerance;m.score=m.pass?100:clamp(100*(.5-m.error)/(.5-tolerance));});
  const cd=measures.length?measures.reduce((sum,m)=>sum+m.score,0)/measures.length:core.components.geometry*100;
  let doping=core.doping===null?null:core.doping*100;
  const checks=[];
  if(target.substrateDoping){const expected=target.substrateDoping,got=actual.substrateDoping;checks.push({kind:'substrate',name:'기판 도핑 극성',pass:got?.type===expected.type,detail:`목표 ${expected.type}형 · 현재 ${got?.type||'미확인'}`});}
  if(doping!==null){
   if(!spec)checks.push({name:'총·활성 농도 분포',pass:core.components.total>=.9&&core.components.active>=.9,detail:'예시 분포 유사도 각각 90% 이상'});
   checks.push({name:'주입·열처리 완료',pass:core.components.process===1,detail:'필수 도핑종과 최종 열처리 이력'});
   for(const species of options.assessment?.species||[]){
    const peak=(f)=>(f.concentration?.fields?.[species+'_active']||[]).reduce((m,v)=>Math.max(m,v),0);
    const expected=spec?.peaks.find(p=>p.species===species)?.value??peak(target),value=peak(actual);
    checks.push({name:species+' 활성 농도 최고값',pass:expected>0&&(spec?Math.abs(value-expected)/expected<=tolerance:value>=expected*.5&&value<=expected*2),detail:`목표 ${expected.toExponential(3)} · 계산값 ${value.toExponential(3)} cm⁻³`});
   }
  }
  if(spec&&spec.peaks.length){const scores=spec.peaks.map(p=>{const peak=(actual.concentration?.fields?.[p.species+'_active']||[]).reduce((a,b)=>Math.max(a,b),0),error=Math.abs(peak-p.value)/p.value;return error<=tolerance?100:clamp(100*(.5-error)/(.5-tolerance));});doping=scores.reduce((a,b)=>a+b,0)/scores.length;}
  const opticalChecks=actualSteps.flatMap((s,i)=>{
   const p=s.params||{};if(s.op!=='photo'||p.action!=='Exposure')return [];
   const limit=.6*p.wavelength/p.na,cd=p.width*1000;
   return [{kind:'photo',name:`STEP ${i+1} 노광 해상도`,pass:Number.isFinite(limit)&&cd>=limit,detail:`패턴 폭 ${cd.toFixed(1)} nm · 모델 해상도 ${limit.toFixed(1)} nm`}];
  });checks.push(...opticalChecks);
  const requiredMaterials=[...new Set(target.polygons.map(p=>p.material))],actualMaterials=new Set(actual.polygons.map(p=>p.material));
  const materialMatch=requiredMaterials.every(id=>actualMaterials.has(id));
  if(spec)checks.push({kind:'material',name:'필수 재료',pass:materialMatch,detail:'예제에 필요한 재료의 존재 여부'});
  const eligible=(spec?materialMatch:core.components.geometry>=.9)&&measures.every(m=>m.pass)&&checks.every(c=>c.pass);
  const referenceCost=cost(referenceSteps),actualCost=cost(actualSteps);
  const efficiency=eligible?100*(Math.min(1,referenceSteps.length/Math.max(1,actualSteps.length))+Math.min(1,referenceCost/Math.max(1,actualCost)))/2:0;
  const weights=spec?(doping===null?{cd:.85,efficiency:.15}:{cd:.5,doping:.35,efficiency:.15}):(doping===null?{geometry:.6,cd:.25,efficiency:.15}:{geometry:.4,cd:.2,doping:.25,efficiency:.15});
  const components={geometry:core.components.geometry*100,cd,efficiency,...(doping===null?{}:{doping})};
  let score=Math.round(Object.entries(weights).reduce((sum,[key,weight])=>sum+components[key]*weight,0));
  // Missing dopants/anneal may never be offset by geometry or a shorter recipe.
  if(!checks.every(c=>c.pass))score=Math.min(score,spec?79:core.score,79);
  const hints=[];
  for(const m of measures.filter(m=>!m.pass).sort((a,b)=>b.error-a.error).slice(0,2))hints.push({id:m.id,text:`${m.kind} ${m.actual.toFixed(1)} nm / 목표 ${m.target.toFixed(1)} nm. 해당 재료의 ${m.actual>m.target?'성장량을 줄이거나 제거량을 늘리는':'성장량을 늘리거나 제거량을 줄이는'} 조건을 한 가지씩 비교하세요.`});
  if(checks.some(c=>!c.pass&&!c.kind))hints.push({text:'도핑종·주입 마스크·에너지와 마지막 열처리 순서를 확인하세요.'});
  if(spec&&!materialMatch)hints.push({text:'필수 재료가 누락되었습니다. 증착 단계와 과도한 식각 여부를 확인하세요.'});
  if(opticalChecks.some(c=>!c.pass))hints.push({text:'선택 광원의 모델 해상도보다 패턴이 작습니다. 선폭·NA·광원을 비교하세요.'});
  if(eligible&&actualCost>referenceCost)hints.push({text:'목표 조건은 충족했습니다. 추가 증착·식각·마스크 단계 중 결과에 필요하지 않은 단계를 비교해 보세요.'});
  if(!hints.length)hints.push({text:eligible?'현재 형상·치수와 필수 조건이 목표 범위에 있습니다.':'재료별 형상 차이와 공정 누락을 먼저 확인하세요.'});
  const referenceResources=resources(referenceSteps),actualResources=resources(actualSteps),tradeoffs=[];
  if(actualResources.aldCycles>referenceResources.aldCycles)tradeoffs.push(`ALD ${actualResources.aldCycles} cycles · 예시 ${referenceResources.aldCycles} cycles. 반복량 증가가 비용 지수에 반영됩니다.`);
  if(actualCost>referenceCost*1.01)tradeoffs.push(`교육용 비용 지수 ${referenceCost.toFixed(1)} → ${actualCost.toFixed(1)} (+${((actualCost/referenceCost-1)*100).toFixed(0)}%). ${eligible?'효율 점수에 반영했습니다.':'목표 조건 충족 전까지 효율 평가는 보류합니다.'}`);
  return {version:4,score,core,weights,measures,checks,eligible,designSpec:spec,geometryReferenceOnly:!!spec,tolerance:tolerance*100,referenceCost,actualCost,referenceSteps:referenceSteps.length,actualSteps:actualSteps.length,components,hints:hints.slice(0,3),referenceResources,actualResources,tradeoffs};
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
 const api={assess,dimensions,layers,cost,resources,intervals,specification,validateSpec};if(typeof module==='object'&&module.exports)module.exports=api;else root.LearningScore=api;
})(typeof window==='object'?window:globalThis);
