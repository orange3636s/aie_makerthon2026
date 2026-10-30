/* Read-only educational models. Native coordinates: µm; density: cm^-3.
   No electrical TCAD, empirical factory prediction or AI-generated scores. */
(function(root){
 'use strict';
 const L=typeof module==='object'&&module.exports?require('./learning-score.js'):root.LearningScore;
 const version='learning-lab-1';
 const spans=(f,id,x)=>f?.polygons?L.intervals(f,id,1,x):[];
 const total=rows=>rows.reduce((v,[a,b])=>v+b-a,0);
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function density(frame,x,y,field='net_active'){
  const d=frame?.concentration;if(!d||!(d.dx>0)||!d.fields?.[field])return null;
  const i=Math.floor((x-d.origin[0])/d.dx),j=Math.floor((y-d.origin[1])/d.dx),k=j*d.nx+i;
  if(i<0||j<0||i>=d.nx||j>=d.ny||!d.mask?.[k])return null;
  if(![10,13].some(id=>spans(frame,id,x).some(([lo,hi])=>y>=lo&&y<=hi)))return null;
  return finite(d.fields[field][k])?d.fields[field][k]:null;
 }
 function dopantProfile(frame,x){
  const d=frame?.concentration,si=[...spans(frame,10,x),...spans(frame,13,x)];
  if(!d||!si.length)return {series:[],resolution:null};
  const top=Math.max(...si.map(s=>s[1]));
  const keys=Object.keys(d.fields).filter(k=>/_(total|active)$/.test(k)&&!k.startsWith('net'));
  return {resolution:d.dx*1000,series:keys.map(key=>({name:key.replace('_total',' · 총 농도').replace('_active',' · 활성 농도'),dash:key.endsWith('active'),points:Array.from({length:d.ny},(_,i)=>{const y=d.origin[1]+(d.ny-i-.5)*d.dx,v=density(frame,x,y,key);return [(top-y)*1000,v>0?Math.log10(v):null];}).filter(p=>p[0]>=0)}))};
 }
 function filmProfile(frame,bounds,id){
  if(!frame?.polygons||!bounds)return [];
  return Array.from({length:121},(_,i)=>{const x=bounds[0]+(bounds[1]-bounds[0])*(i+.5)/121;return [x*1000,total(spans(frame,id,x).map(([a,b])=>[Math.max(a,bounds[2]),Math.min(b,bounds[3])]).filter(([a,b])=>b>a))*1000]});
 }
 function coverage(frame,previous,bounds,id){
  // Only a single, central, open trench with two Si walls is supported.
  if(!previous?.polygons||id===10)return null;
  const center=spans(previous,10,0).at(-1),edge=spans(previous,10,bounds[0]+.03).at(-1);
  if(!center||!edge||edge[1]-center[1]<.05)return null;
  const y=(center[1]+edge[1])/2,walls=L.intervals(previous,10,0,y).filter(([a,b])=>b>bounds[0]&&a<bounds[1]);
  if(walls.length!==2||walls[0][1]>=0||walls[1][0]<=0)return null;
  const lo=walls[0][1],hi=walls[1][0],x=(bounds[0]+lo)/2;
  const inside=f=>total(L.intervals(f,id,0,y).map(([a,b])=>[Math.max(a,lo),Math.min(b,hi)]).filter(([a,b])=>b>a));
  const top=total(spans(frame,id,x))-total(spans(previous,id,x)),side=(inside(frame)-inside(previous))/2;
  if(top<=.001||side<0||inside(frame)>=(hi-lo)*.98)return null;
  return {topNm:top*1000,sideNm:side*1000,ratio:side/top,aspectRatio:(edge[1]-center[1])/(hi-lo),xNm:x*1000,yNm:y*1000};
 }
 function mosfet(frame,target,options={}){
  const fail=reason=>({available:false,reason});
  if(target!=='mosfet')return fail('현재 I–V 근사는 평면 NMOS / SiO₂ 게이트에만 적용됩니다.');
  const p={widthNm:1000,mobility:300,background:1e16,vfb:-.8,vds:.1,...options};
  if(!Object.values(p).every(finite)||p.widthNm<100||p.widthNm>10000||p.mobility<10||p.mobility>1000||p.background<1e14||p.background>1e18||p.vds<.01||p.vds>3||p.vfb<-2||p.vfb>2)return fail('모델 입력 범위를 확인하세요.');
  const gate=spans(frame,11,0).find(([a,b])=>b>a&&a>=0),si=spans(frame,10,0).find(([a,b])=>a<0&&b>=-.1);
  if(!gate||!si)return fail('중앙 Si 채널과 Poly Si 게이트가 필요합니다.');
  const oxide=spans(frame,30,0).find(([a,b])=>Math.abs(a-si[1])<.005&&Math.abs(b-gate[0])<.005);
  if(!oxide)return fail('Si와 게이트 사이 연속된 SiO₂를 확인하세요.');
  const g=L.intervals(frame,11,0,(gate[0]+gate[1])/2).find(([a,b])=>a<0&&b>0);
  if(!g)return fail('게이트 길이를 추출할 수 없습니다.');
  for(const fraction of [.1,.3,.5,.7,.9]){const x=g[0]+(g[1]-g[0])*fraction,s=spans(frame,10,x).find(([a,b])=>a<0&&b>=-.1),gates=spans(frame,11,x);
   if(!s||!gates.some(([a])=>spans(frame,30,x).some(([lo,hi])=>Math.abs(lo-s[1])<.005&&Math.abs(hi-a)<.005)))return fail('게이트 아래 산화막의 연속성을 확인하세요.');
  }
  const lengthNm=(g[1]-g[0])*1000,toxNm=(oxide[1]-oxide[0])*1000;
  if(lengthNm<100||toxNm<2||toxNm>200)return fail('현재 근사 범위: L ≥ 100 nm, SiO₂ 2–200 nm.');
  const d=frame.concentration;
  if(!d?.fields?.net_active)return fail('주입과 활성화 후 농도 계산이 필요합니다.');
  const peakAt=x=>{const surface=spans(frame,10,x).at(-1)?.[1];if(!finite(surface))return 0;let peak=0;for(let i=0;i<40;i++)peak=Math.max(peak,density(frame,x,surface-(i+.5)*d.dx)||0);return peak;};
  if(peakAt(g[0]-.10)<1e17||peakAt(g[1]+.10)<1e17)return fail('양쪽 S/D의 활성 n형 농도가 부족하거나 확인되지 않습니다.');
  if((density(frame,0,si[1]-d.dx/2)||0)>p.background)return fail('채널의 순 donor 농도가 가정한 p형 배경 농도를 넘습니다. 이 NMOS 근사를 적용할 수 없습니다.');
  const q=1.602176634e-19,eps0=8.8541878128e-12,vt=.025852,na=p.background*1e6,phi=vt*Math.log(p.background/1e10),cox=3.9*eps0/(toxNm*1e-9);
  const threshold=p.vfb+2*phi+Math.sqrt(4*q*11.7*eps0*na*phi)/cox,beta=p.mobility*1e-4*cox*p.widthNm/lengthNm;
  const points=Array.from({length:101},(_,i)=>{const vg=i*.03,over=vg-threshold;const id=over<=0?0:p.vds<over?beta*(over*p.vds-p.vds*p.vds/2):beta*over*over/2;return [vg,id*1e6];});
  return {available:true,version,lengthNm,toxNm,threshold,cox,options:p,points,scope:'장채널 square-law · 300 K · VSB = 0 · 누설·단채널·접촉저항 제외',assumptions:'W·이동도·p형 배경 농도·Vfb는 입력 가정입니다. L·산화막 두께만 계산 단면에서 추출합니다.'};
 }
 function diagnostics(frame,steps,bounds){
  const rows=[],d=frame?.concentration;
  if(!frame?.polygons)return rows;
  if(d){let peak=0,bottom=0,active=0;
   for(let j=0;j<d.ny;j++)for(let i=0;i<d.nx;i++){const k=j*d.nx+i;if(!d.mask[k])continue;const y=d.origin[1]+(j+.5)*d.dx;if(y<bounds[2]||y>bounds[3])continue;const n=Math.abs(d.fields.net_total?.[k]||0);peak=Math.max(peak,n);active=Math.max(active,Math.abs(d.fields.net_active?.[k]||0));if(y<bounds[2]+2*d.dx)bottom=Math.max(bottom,n);}
   if(peak>1e16&&active<peak*.05)rows.push({id:'activation',title:'활성화 확인',kind:'계산 농도',text:'총 농도 대비 활성 농도가 작습니다. 주입 후 열처리 조건을 확인하세요.'});
   if(peak>0&&bottom>peak*.05)rows.push({id:'depth',title:'표시 영역 하단의 도펀트',kind:'관찰 범위',text:'높은 농도가 현재 표시 영역 하단까지 남습니다. 주입 에너지와 기판 두께를 확인하세요. 실제 웨이퍼 관통을 의미하지 않습니다.'});
  }
  const last=steps?.at(-1);
  if(last?.op==='etch'&&['Isotropic','Wet Etch'].includes(last.params?.method))rows.push({id:'undercut',title:'마스크 아래 측방 식각 비교',kind:'탐구 질문',text:'식각 시간을 줄여 깊이와 언더컷이 함께 줄어드는지 비교하세요.'});
  if(last?.op==='deposition'&&last.params?.method==='PVD')rows.push({id:'coverage',title:'트렌치 입구와 바닥 비교',kind:'탐구 질문',text:'입구가 닫히기 전에 바닥 막이 충분히 성장했는지 단면을 확인하세요. PVD 사용만으로 보이드를 판정하지 않습니다.'});
  return rows;
 }
 function mission(reference,target){
  const final=reference?.frames?.at(-1);if(!final||!target)return null;
  const measures=L.dimensions(final,final,target.roi||reference.roi);
  return {id:target.id,version,title:target.title,goals:measures.map(m=>({...m,tolerance:.05*Math.abs(m.target)})),doping:!!final.concentration};
 }
 function checkMission(reference,result,target,{pending=false}={}){
  if(pending||!result||result.failure||result.frames?.length!==(result.steps?.length||0)+1)return {status:'unavailable',reason:'수정한 전체 공정을 계산한 뒤 평가하세요.'};
  const score=L.assess(reference.frames.at(-1),result.frames.at(-1),target.roi,target,reference.steps,result.steps);
  const species=target.assessment?.species||[];
  for(const sp of species){
   const i=result.steps.findLastIndex(s=>s.op==='diffusion'&&s.params?.species===sp&&['Ion implantation','Pre-deposition'].includes(s.params.method));
   const source=result.steps[i],activation=i>=0&&(source.params.method==='Pre-deposition'||result.steps.slice(i+1).some(s=>s.op==='diffusion'&&['Anneal','Drive-in'].includes(s.params?.method)));
   score.checks.push({name:sp+' 레시피 이력',pass:activation,detail:'도핑 공급 단계와 필요한 후속 열처리 확인'});
  }
  if(score.checks.some(c=>!c.pass))score.score=Math.min(score.score,79);
  const pass=score.components.geometry>=90&&score.measures.length>0&&score.measures.every(m=>m.pass)&&score.checks.every(c=>c.pass);
  return {status:pass?'pass':'retry',score:score.score,components:score.components,checks:score.checks,measures:score.measures,tradeoffs:score.tradeoffs,version};
 }
 const api={version,density,dopantProfile,filmProfile,coverage,mosfet,diagnostics,mission,checkMission};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.LearningLabModels=api;
})(typeof window==='object'?window:globalThis);
