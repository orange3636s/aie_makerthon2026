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
  const p={widthNm:1000,mobility:300,background:1e16,vfb:-.8,vds:.1,...options,...(frame.substrateDoping?.type!=='intrinsic'&&frame.substrateDoping?{background:frame.substrateDoping.concentration}:{})};
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
  const access=accessResistance(frame,g,1,p);
  if(!access)return fail('S/D 접근 영역의 활성 농도를 확인하세요.');
  const points=Array.from({length:101},(_,i)=>{const vg=i*.03;return [vg,terminalCurrent(vg,p.vds,threshold,beta,access)*1e6];});
  return {available:true,version,lengthNm,toxNm,threshold,cox,access,options:p,points,scope:'장채널 square-law · S/D 접근 저항 · 300 K',assumptions:'L·산화막 두께·S/D 활성 농도는 계산 단면에서 추출합니다. 접근 영역은 게이트 양옆 100 nm, 이동도는 입력값으로 가정합니다. 배경 농도는 Wafer 설정과 연동하며 W·Vfb는 입력 가정입니다. 누설·단채널·금속 접촉저항은 제외합니다.'};
 }
 const electricalDevices=Object.freeze(['pn-junction','mosfet','fdsoi','pdsoi','rcat','bcat','finfet','gaafet','mbcfet','charge-trap','cfet']);
 const dielectricK=Object.freeze({16:7.5,30:3.9,31:9,32:20,201:25});
 function electricalDefaults(target){
  if(target==='pn-junction')return {areaUm2:1,ideality:1,lifetimeUs:1};
  return {widthNm:1000,mobility:300,background:1e16,vfb:target==='mosfet'?-.8:-.5,vds:.1};
 }
 // Extract a *vertical* Si / dielectric / conductor stack at the channel centre.
 // W_eff is explicitly supplied: an extruded longitudinal section cannot establish
 // Fin/GAA gated perimeter, sheet count, or a real 3-D electrostatic solution.
 function gateSections(frame){
  const layers=Object.keys(dielectricK).flatMap(id=>spans(frame,+id,0).map(([a,b])=>({a,b,k:dielectricK[id],id:+id})));
  const gates=[11,70,79].flatMap(id=>spans(frame,id,0).map(([a,b])=>({a,b,id})));
  return spans(frame,10,0).flatMap(([bottom,surface])=>{
   let end=surface,eot=0,materials=[];
   for(let i=0;i<8;i++){
    const layer=layers.find(p=>Math.abs(p.a-end)<.003&&p.b>end+.0001);
    if(!layer)break; eot+=(layer.b-layer.a)*1000*3.9/layer.k;end=layer.b;materials.push(layer.id);
   }
   const gate=gates.find(g=>Math.abs(g.a-end)<.003);
   if(!gate||eot<.5||eot>300)return [];
   const span=L.intervals(frame,gate.id,0,(gate.a+gate.b)/2).find(([a,b])=>a<0&&b>0);
   if(!span||span[1]-span[0]<.02)return [];
   return [{bottom,surface,eot,gate,span,materials,lengthNm:(span[1]-span[0])*1000}];
  });
 }
 // Use only active net dopants in surviving Si, and separate the two sides.
 // Peaks are readiness checks, not inferred channel background doping.
 function activePeaks(frame,{left=0,right=0,y0=-Infinity,y1=Infinity}={}){
  const d=frame?.concentration,out={n:[0,0],p:[0,0]};
  if(!d?.fields?.net_active||!(d.dx>0))return out;
  for(let i=0;i<d.nx;i++){
   const x=d.origin[0]+(i+.5)*d.dx,side=x<left?0:x>right?1:-1;if(side<0)continue;
   const silicon=spans(frame,10,x);
   for(let j=0;j<d.ny;j++){
    const k=j*d.nx+i,y=d.origin[1]+(j+.5)*d.dx,v=d.fields.net_active[k];
    if(!d.mask?.[k]||!finite(v)||y<y0||y>y1||!silicon.some(([a,b])=>y>=a&&y<=b))continue;
    out.n[side]=Math.max(out.n[side],v);out.p[side]=Math.max(out.p[side],-v);
   }
  }return out;
 }
 // Educational access resistance: Rsh = 1 / (q mu integral N_active dz).
 // Average sheet density in a 100-nm band on each side of the gate. This
 // is not contact extraction or a 2D current-path/short-channel solver.
 function accessResistance(frame,span,polarity,p,y0=-Infinity,y1=Infinity){
  const d=frame?.concentration;if(!d?.fields?.net_active)return null;
  const sums=[0,0],counts=[0,0],length=.1;
  for(let i=0;i<d.nx;i++){
   const x=d.origin[0]+(i+.5)*d.dx;
   const side=x>=span[0]-length&&x<span[0]?0:x>span[1]&&x<=span[1]+length?1:-1;
   if(side<0)continue;const si=spans(frame,10,x);let sheet=0;
   for(let j=0;j<d.ny;j++){
    const k=j*d.nx+i,y=d.origin[1]+(j+.5)*d.dx,v=d.fields.net_active[k];
    if(d.mask[k]&&finite(v)&&y>=y0&&y<=y1&&si.some(([a,b])=>y>=a&&y<=b))sheet+=Math.max(0,polarity*v)*d.dx*1e-4;
   }
   sums[side]+=sheet;counts[side]++;
  }
  const sheets=sums.map((s,i)=>s/counts[i]);
  if(sheets.some(v=>!finite(v)||v<=0))return null;
  const mobility=p.mobility*(polarity===-1?.4:1);
  const resistance=sheets.map(n=>100/p.widthNm/(1.602176634e-19*mobility*n));
  if(!resistance.every(finite))return null;
  return {source:resistance[0],drain:resistance[1],sheetDensity:sheets,lengthNm:100};
 }
 function terminalCurrent(vg,vd,threshold,beta,r){
  const intrinsic=(g,d)=>{const u=g-threshold;if(u<=0||d<=0)return 0;return d<u?beta*(u*d-d*d/2):beta*u*u/2;};
  let lo=0,hi=Math.min(intrinsic(vg,vd),vd/(r.source+r.drain));
  for(let i=0;i<60;i++){
   const current=(lo+hi)/2,expected=intrinsic(vg-current*r.source,vd-current*(r.source+r.drain));
   if(current>expected)hi=current;else lo=current;
  }
  return (lo+hi)/2;
 }
 function deviceIV(frame,target,options={}){
  const fail=reason=>({available:false,reason}),q=1.602176634e-19,eps0=8.8541878128e-12,vt=.025852;
  if(!electricalDevices.includes(target))return fail('구조 예제에는 전기 단자가 정의되어 있지 않습니다. 소자 예제를 선택하세요.');
  if(!frame?.polygons?.length)return fail('계산된 소자 단면이 필요합니다.');
  const p={...electricalDefaults(target),...options,...(frame.substrateDoping?.type!=='intrinsic'&&frame.substrateDoping&&target!=='pn-junction'?{background:frame.substrateDoping.concentration}:{})};
  if(frame.substrateDoping){if(!frame.processEvidence?.annealedSpecies?.length)return fail('기판 도핑만으로 S/D가 만들어지지 않습니다. 주입과 활성화 열처리를 완료하세요.');if(target!=='pn-junction'&&frame.substrateDoping.type!=='p')return fail('이 예제의 nFET에는 저농도 p형 기판이 필요합니다. Wafer 도핑 설정을 확인하세요.');}
  if(!Object.values(p).every(finite))return fail('모델 입력 범위를 확인하세요.');
  if(target==='mosfet'){
   const r=mosfet(frame,target,p);
   return {...r,series:r.available?[{name:'NMOS',points:r.points}]:[],xLabel:'Vgs (V)',yLabel:'Id (µA)',facts:r.available?[['L',r.lengthNm,'nm'],['SiO₂',r.toxNm,'nm'],['Vth',r.threshold,'V'],['Rsd',r.access.source+r.access.drain,'Ω']]:[]};
  }
  if(target==='pn-junction'){
   if(p.areaUm2<.01||p.areaUm2>100||p.ideality<1||p.ideality>2||p.lifetimeUs<.01||p.lifetimeUs>100)return fail('모델 입력 범위를 확인하세요.');
   const peaks=activePeaks(frame),nd=Math.max(...peaks.n),na=Math.max(...peaks.p);
   if(nd<1e14||na<1e14)return fail('Si 내부의 활성 n형·p형 영역이 모두 필요합니다. 주입 후 열처리를 확인하세요.');
   // Low-injection Shockley diffusion-current estimate, cm-based quantities.
   const dn=1350*vt,dp=480*vt,tau=p.lifetimeUs*1e-6;
   const is=q*p.areaUm2*1e-8*1e20*(dn/(Math.sqrt(dn*tau)*na)+dp/(Math.sqrt(dp*tau)*nd));
   const points=Array.from({length:121},(_,i)=>{const v=-.3+i*.0075;return [v,is*Math.expm1(v/(p.ideality*vt))*1e6];});
   return {available:true,series:[{name:'PN Junction',points}],points,xLabel:'접합 전압 V (V)',yLabel:'I (µA)',facts:[['Vbi',vt*Math.log(na*nd/1e20),'V'],['Is',is,'A']],options:p,
    assumptions:'300 K Shockley 저준위 주입 근사. 활성 n/p 최고 농도를 균일한 접합 농도로 대신 사용합니다. 접합 면적·수명·이상계수는 입력 가정이며 μn=1350, μp=480 cm²/V·s입니다. 실제 접합 면적·재결합·직렬저항·항복은 해석하지 않습니다.'};
  }
  if(p.widthNm<100||p.widthNm>10000||p.mobility<10||p.mobility>1000||p.background<1e14||p.background>1e18||p.vds<.01||p.vds>3||p.vfb<-2||p.vfb>2)return fail('모델 입력 범위를 확인하세요.');
  let sections=gateSections(frame).sort((a,b)=>a.surface-b.surface);
  if(!sections.length)return fail('Si 채널과 게이트 사이의 연속된 절연막이 필요합니다.');
  if(target==='cfet'&&sections.length<2)return fail('CFET의 상부·하부 게이트와 채널을 모두 계산하세요.');
  sections=target==='cfet'?[sections[0],sections.at(-1)]:[sections.at(-1)];
  const branches=[];
  for(let index=0;index<sections.length;index++){
   const s=sections[index],polarity=target==='cfet'&&index===1?-1:1;
   const mid=target==='cfet'?(sections[0].surface+sections[1].bottom)/2:null;
   const peaks=activePeaks(frame,{left:s.span[0],right:s.span[1],y0:mid!==null&&index===1?mid:-Infinity,y1:mid!==null&&index===0?mid:Infinity});
   if(peaks[polarity===1?'n':'p'].some(v=>v<1e16))return fail(`${polarity===1?'n형':'p형'} 양쪽 S/D 활성 도핑이 필요합니다. 주입·열처리를 확인하세요.`);
   let lengthNm=s.lengthNm;
   if(['rcat','bcat'].includes(target)){
    const tops=[s.span[0]-.12,s.span[1]+.12].map(x=>spans(frame,10,x).at(-1)?.[1]);
    if(!tops.every(finite))return fail('리세스 양쪽 Si 표면을 확인할 수 없습니다.');
    lengthNm+=Math.max(0,(tops[0]+tops[1])/2-s.surface)*2000;
   }
   const cox=3.9*eps0/(s.eot*1e-9),phi=vt*Math.log(p.background/1e10),na=p.background*1e6;
   const depletion=Math.sqrt(4*11.7*eps0*phi/(q*na));
   const body=['fdsoi','pdsoi'].includes(target)?Math.min(depletion,(s.surface-s.bottom)*1e-6):depletion;
   const threshold=p.vfb+2*phi+q*na*body/cox;
   const beta=p.mobility*(polarity===-1?.4:1)*1e-4*cox*p.widthNm/lengthNm;
   const access=accessResistance(frame,s.span,polarity,p,mid!==null&&index===1?mid:-Infinity,mid!==null&&index===0?mid:Infinity);
   if(!access)return fail('S/D 접근 영역의 활성 농도를 확인하세요.');
   branches.push({polarity,lengthNm,eot:s.eot,threshold,beta,access});
  }
  // Common voltage window for both CFET branches. Negative values use conventional PMOS signs.
  const vmax=Math.max(3,...branches.map(b=>Math.ceil(b.threshold+1)));
  const series=branches.map(b=>({name:target==='cfet'?(b.polarity===1?'하부 nFET':'상부 pFET'):'등가 nFET',points:Array.from({length:121},(_,i)=>{
   const v=i*vmax/120,id=terminalCurrent(v,p.vds,b.threshold,b.beta,b.access);
   return [v*b.polarity,id*1e6*b.polarity];
  })}));
  const s=sections[0],b=branches[0];
  const notes=[];
  if(target==='charge-trap'&&!s.materials.includes(16))notes.push('현재 게이트 아래 Si₃N₄가 검출되지 않아 ONO 저장층이 없는 등가 FET 곡선입니다.');
  let assumptions='300 K 장채널 square-law 등가 모델. L과 EOT는 중앙 단면에서 추출합니다. 배경 농도는 Wafer 설정과 연동하며 W_eff·이동도·Vfb는 입력 가정입니다. 유전율 가정: SiO₂ 3.9, Si₃N₄ 7.5, HfO₂ 20, Al₂O₃ 9, HZO 25. 누설·단채널·접촉저항·양자효과는 제외합니다.';
  assumptions+=' S/D 접근 저항은 게이트 양옆 100 nm 영역의 Si 순 활성 농도 깊이 적분과 입력 이동도로 계산합니다. 내부 Vgs·Vds의 저항 전압강하를 반복 계산하며, 금속 접촉저항이나 실제 2D 전류 경로를 추출하는 모델은 아닙니다.';
  if(['fdsoi','pdsoi'].includes(target))assumptions+=' 공핍 전하는 min(공핍 폭, 계산된 Si 몸체 두께)로 제한합니다. 완전/부분 공핍은 농도와 몸체 두께에 따라 달라지며, 후면 게이트·부유 몸체 효과는 제외합니다.';
  if(['rcat','bcat'].includes(target))assumptions+=' L_eff = 게이트 폭 + 2 × 리세스 깊이로 U자 채널을 근사합니다.';
  if(['finfet','gaafet','mbcfet','cfet'].includes(target))assumptions+=' W_eff는 핀/시트의 전체 유효 채널 둘레를 포함하는 사용자 가정입니다. 단면에서 시트 수나 3D 게이트 둘레를 복원하지 않으며 BSIM-CMG 모델이 아닙니다.';
  if(target==='cfet')assumptions+=' 상부 pFET는 Vfb의 부호를 반전한 대칭 임계전압 가정, 이동도는 nFET의 0.4배입니다. 두 독립 소자의 곡선이며 인버터 전달 특성이 아닙니다.';
  if(target==='charge-trap')assumptions+=' 적층 절연막의 직렬 용량만 반영합니다. 트랩 전하·program/erase·보존시간은 계산하지 않습니다.';
  return {available:true,series,points:series[0].points,xLabel:'Vgs (V)',yLabel:'Id (µA)',options:p,branches,notes,assumptions,
   facts:[['L_eff',b.lengthNm,'nm'],['EOT',b.eot,'nm'],...branches.flatMap((b,i)=>[[branches.length>1?(i?'pFET Vth':'nFET Vth'):'Vth',b.threshold*b.polarity,'V'],[branches.length>1?(i?'pFET Rsd':'nFET Rsd'):'Rsd',b.access.source+b.access.drain,'Ω']])]};
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
 const api={version,density,dopantProfile,filmProfile,coverage,mosfet,electricalDevices,electricalDefaults,deviceIV,diagnostics,mission,checkMission};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.LearningLabModels=api;
})(typeof window==='object'?window:globalThis);
