/* Concentration is a Gaussian-equivalent input to the existing native dose
   solver, not a promise of the post-anneal active peak. sigma: CSV headSigma nm. */
(function(root){
 'use strict';
 const sigma={P:{8:13.546,10:18.855,30:21.862,50:47.52,100:49.792,130:82.66,200:82.343},B:{8:33.336,10:25.734,30:39.037,50:59.065,100:80.596,130:85.853,200:96.385}};
 const applicable=row=>row?.op==='diffusion'&&row.params?.method==='Ion implantation';
 const factor=p=>Math.sqrt(2*Math.PI)*sigma[p.species]?.[p.energy]*1e-7;
 const peak=p=>p.dose/factor(p);
 function dose(p,value){if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw Error('주입 농도를 확인하세요.');const d=value*factor(p);if(!Number.isFinite(d)||d<1e11*(1-1e-12)||d>1e15*(1+1e-12))throw Error('주입량 1e11–1e15 cm⁻² 범위의 농도를 입력하세요.');return Math.min(1e15,Math.max(1e11,d));}
 function sdMask(frame,bounds){
  const points=(frame?.polygons||[]).filter(p=>p.material===11).flatMap(p=>p.points);
  if(!points.length||!bounds)return null;
  const left=Math.min(...points.map(p=>p[0]))-.02,right=Math.max(...points.map(p=>p[0]))+.02,center=(left+right)/2;
  const outer=Math.min(center-bounds[0],bounds[1]-center),half=(right-left)/2,width=outer-half,pitch=outer+half;
  if(width<.06||width>1||pitch<.15||pitch>1||Math.abs(center)>.4)return null;
  const clean=v=>Number(v.toFixed(5));
  return {implant_mask:'Double',implant_width:clean(width),implant_pitch:clean(pitch),implant_offset:clean(center)};
 }
 function mount(container,prefix,row,geometry){
  if(!applicable(row))return;
  const mask=document.getElementById(prefix+'implant_mask'),preset=sdMask(geometry?.frame,geometry?.bounds);
  if(mask){
   const tools=document.createElement('div');tools.className='implant-mask-tools';mask.closest('.field').append(tools);
   const hint=document.createElement('small');hint.textContent='회색: 차폐 · 열린 영역만 주입';tools.append(hint);
   if(preset){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='게이트 보호 · S/D 개방';button.disabled=mask.disabled;button.onclick=()=>{Object.assign(row.params,preset);mask.value='Double';mask.dispatchEvent(new Event('change',{bubbles:true}));};tools.append(button);}
  }
  const p=row.params,f=factor(p),doseInput=document.getElementById(prefix+'dose');if(!doseInput||!f)return;
  const id=prefix+'peak',low=1e11/f,high=1e15/f,value=Number.isFinite(peak(p))?peak(p).toExponential(5):'';
  doseInput.closest('.field').insertAdjacentHTML('beforebegin',`<div class="field"><label for="${id}">주입 피크 농도 · cm⁻³</label><input id="${id}" type="number" min="${Math.min(low,Number(value))}" max="${Math.max(high,Number(value))}" step="any" value="${value}" required ${doseInput.disabled?'disabled':''}><small>가우시안 환산 · 열처리 후 활성 농도는 달라집니다.</small></div>`);
  const input=document.getElementById(id);let fromPeak=false;
  input.oninput=()=>{fromPeak=true;let q=Number(input.value)*f;if(q>=1e11*(1-1e-5)&&q<=1e15*(1+1e-5))q=Math.min(1e15,Math.max(1e11,q));doseInput.value=input.value===''?'':q.toExponential(6);doseInput.dispatchEvent(new Event('input',{bubbles:true}));fromPeak=false;};
  doseInput.addEventListener('input',()=>{if(!fromPeak){input.value=doseInput.value===''?'':(Number(doseInput.value)/f).toExponential(4);input.dispatchEvent(new Event('change',{bubbles:true}));}});
 }
 const devices=new Set(['mosfet','fdsoi','pdsoi','rcat','bcat','finfet','gaafet','mbcfet','charge-trap','cfet']);
 const fields=(row,items,target)=>{const mapped=items.map(f=>applicable(row)&&f.key==='species'?{...f,label:devices.has(target)?'소스/드레인 도핑 종류':'주입 도핑 종류'}:applicable(row)&&f.key==='implant_mask'?{...f,label:devices.has(target)?'S/D 주입 마스크':'주입 마스크'}:f);if(applicable(row)){const i=mapped.findIndex(f=>f.key==='implant_mask');if(i>=0){const [mask]=mapped.splice(i,1);mapped.splice(1,0,mask);}}return mapped;};
 const label=(row,f,v)=>!applicable(row)?null:f.key==='species'?(v==='P'?'n+ · P (인)':'p+ · B (붕소)'):f.key==='implant_mask'?({Existing:'현재 게이트·PR로 차폐',Central:'중앙 개구',Double:'S/D 양쪽 개구',Triple:'3개 개구',Repeat:'반복 개구'}[v]||v):null;
 const api={fields,label,sigma,applicable,factor,peak,dose,mount,sdMask};if(typeof module==='object'&&module.exports)module.exports=api;else root.ImplantControls=api;
})(typeof window==='object'?window:globalThis);
