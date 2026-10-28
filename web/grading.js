/* Material-balanced IoU in the active region, in fixed physical coordinates. */
(function(root){
 function raster(frame,bounds,n=180){
  const out=new Int16Array(n*n).fill(-1),groups=new Map();
  for(const p of frame.polygons){if(!groups.has(p.material))groups.set(p.material,[]);groups.get(p.material).push(p.points)}
  for(const [mat,polys] of groups)for(let row=0;row<n;row++){
   const y=bounds[2]+(row+.5)*(bounds[3]-bounds[2])/n,xs=[];
   for(const pts of polys)for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))}
   xs.sort((a,b)=>a-b);for(let k=0;k+1<xs.length;k+=2)for(let col=Math.max(0,Math.ceil((xs[k]-bounds[0])/(bounds[1]-bounds[0])*n-.5));col<n&&bounds[0]+(col+.5)*(bounds[1]-bounds[0])/n<xs[k+1];col++)out[row*n+col]=mat;
  }return out;
 }
 function validField(frame,key){
  const c=frame?.concentration,n=c?.nx*c?.ny,values=c?.fields?.[key];
  return !!c&&c.unit==='cm^-3'&&Number.isInteger(c.nx)&&c.nx>0&&Number.isInteger(c.ny)&&c.ny>0&&Number.isFinite(c.dx)&&c.dx>0&&Array.isArray(c.origin)&&c.origin.length===2&&c.origin.every(Number.isFinite)&&Array.isArray(c.mask)&&c.mask.length===n&&c.mask.every(v=>v===0||v===1)&&Array.isArray(values)&&values.length===n&&values.every(v=>Number.isFinite(v)&&(key.startsWith('net_')||v>=0));
 }
 function dopantSimilarity(target,actual,roi,key='net_total'){
  // Fixed physical coordinates; signed log concentration preserves P/B polarity.
  // Missing or malformed fields are never interpreted as a matching empty grid.
  if(!validField(target,key)||!validField(actual,key))return 0;
  function sample(frame,x,y){const c=frame.concentration,ix=Math.floor((x-c.origin[0])/c.dx),iy=Math.floor((y-c.origin[1])/c.dx);if(ix<0||iy<0||ix>=c.nx||iy>=c.ny)return 0;const i=iy*c.nx+ix,v=c.mask[i]?c.fields[key][i]:0;return Math.sign(v)*Math.min(1,Math.max(0,(Math.log10(Math.max(1,Math.abs(v)))-14)/6))}
  let error=0,mass=0;const n=160;
  for(let row=0;row<n;row++)for(let col=0;col<n;col++){const x=roi[0]+(col+.5)*(roi[1]-roi[0])/n,y=roi[2]+(row+.5)*(roi[3]-roi[2])/n,a=sample(target,x,y),b=sample(actual,x,y);error+=Math.abs(a-b);mass+=Math.abs(a)+Math.abs(b)}
  return mass?Math.max(0,1-error/mass):0;
 }
 function policyFor(target,options){
  if(options.assessment)return options.assessment;
  // Legacy callers must not silently fall back to geometry for a doped target.
  const species=['B','P'].filter(s=>target.concentration?.fields?.[s+'_total']);
  return species.length?{species,requireAnneal:true,weights:options.grading==='doping'?{geometry:.2,total:.35,active:.35,process:.1}:{geometry:.5,total:.2,active:.2,process:.1}}:null;
 }
 function assessDoping(target,actual,roi,policy){
  const issues=[],components={},evidence=actual.processEvidence;
  for(const kind of ['total','active']){
   const keys=['net_'+kind,...policy.species.map(s=>s+'_'+kind)];
   if(keys.some(key=>!validField(target,key)))throw Error('목표 농도 데이터가 불완전합니다. 기준 결과를 다시 생성하세요.');
   components[kind]=keys.reduce((sum,key)=>sum+dopantSimilarity(target,actual,roi,key),0)/keys.length;
   if(keys.some(key=>!validField(actual,key)))issues.push(kind==='total'?'총농도 데이터 누락':'활성농도 데이터 누락');
   else if(components[kind]<.995)issues.push(kind==='total'?'총농도 분포 차이':'활성농도 분포 차이');
  }
  let passed=0,required=0;
  for(const species of policy.species){
   required++;if(evidence?.implantedSpecies?.includes(species))passed++;else issues.push(species+' 주입 미완료');
   if(policy.requireAnneal){required++;if(evidence?.implantedSpecies?.includes(species)&&evidence?.annealedSpecies?.includes(species))passed++;else issues.push(species+' 최종 주입 후 열처리 미완료');}
  }
  components.process=required?passed/required:1;
  return {components,issues};
 }
 function compare(target,actual,roi,options={}){const a=raster(target,roi),b=raster(actual,roi),ids=new Set([...a,...b]);ids.delete(-1);const materials=[];let total=0,weights=0;
  for(const id of ids){let intersection=0,union=0,targetPixels=0,actualPixels=0;for(let i=0;i<a.length;i++){const x=a[i]===id,y=b[i]===id;if(x)targetPixels++;if(y)actualPixels++;if(x&&y)intersection++;if(x||y)union++}if(!union)continue;const iou=intersection/union,weight=id===10?.25:1;materials.push({id,iou,targetPixels,actualPixels});total+=iou*weight;weights+=weight}
  const geometry=weights?total/weights:0,policy=policyFor(target,options),assessment=policy?assessDoping(target,actual,roi,policy):{components:{},issues:[]};
  const components={geometry,...assessment.components},w=policy?.weights||{geometry:1};
  let score=Math.round(100*Object.entries(w).reduce((sum,[key,weight])=>sum+weight*components[key],0));
  if(assessment.issues.length)score=Math.min(score,99);
  return{version:2,score,materials,components,weights:w,issues:assessment.issues,doping:policy?(components.total+components.active)/2:null,method:policy?'Material IoU + signed log10 net and species total/active dopants + completed implantation/anneal evidence; fixed ROI; educational similarity, not electrical validation':'Active-region material IoU; Si weight 0.25; geometry only, not device-function validation'};
 }
 const api={raster,compare,dopantSimilarity,validField};if(typeof module!=='undefined')module.exports=api;else root.SimulationGrading=api;
})(typeof window!=='undefined'?window:this);
