/* Concentration is a Gaussian-equivalent input to the existing native dose
   solver, not a promise of the post-anneal active peak. sigma: CSV headSigma nm. */
(function(root){
 'use strict';
 const sigma={P:{8:13.546,10:18.855,30:21.862,50:47.52,100:49.792,130:82.66,200:82.343},B:{8:33.336,10:25.734,30:39.037,50:59.065,100:80.596,130:85.853,200:96.385}};
 const applicable=row=>row?.op==='diffusion'&&row.params?.method==='Ion implantation';
 const factor=p=>Math.sqrt(2*Math.PI)*sigma[p.species]?.[p.energy]*1e-7;
 const peak=p=>p.dose/factor(p);
 function dose(p,value){if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw Error('주입 농도를 확인하세요.');const d=value*factor(p);if(!Number.isFinite(d)||d<1e11*(1-1e-12)||d>1e15*(1+1e-12))throw Error('주입량 1e11–1e15 cm⁻² 범위의 농도를 입력하세요.');return Math.min(1e15,Math.max(1e11,d));}
 function mount(container,prefix,row){
  if(!applicable(row))return;
  const p=row.params,f=factor(p),doseInput=document.getElementById(prefix+'dose');if(!doseInput||!f)return;
  const id=prefix+'peak',low=1e11/f,high=1e15/f,value=Number.isFinite(peak(p))?peak(p).toExponential(5):'';
  doseInput.closest('.field').insertAdjacentHTML('beforebegin',`<div class="field"><label for="${id}">주입 피크 농도 · cm⁻³</label><input id="${id}" type="number" min="${Math.min(low,Number(value))}" max="${Math.max(high,Number(value))}" step="any" value="${value}" required ${doseInput.disabled?'disabled':''}><small>가우시안 환산 · 열처리 후 활성 농도는 달라집니다.</small></div>`);
  const input=document.getElementById(id);let fromPeak=false;
  input.oninput=()=>{fromPeak=true;let q=Number(input.value)*f;if(q>=1e11*(1-1e-5)&&q<=1e15*(1+1e-5))q=Math.min(1e15,Math.max(1e11,q));doseInput.value=input.value===''?'':q.toExponential(6);doseInput.dispatchEvent(new Event('input',{bubbles:true}));fromPeak=false;};
  doseInput.addEventListener('input',()=>{if(!fromPeak){input.value=doseInput.value===''?'':(Number(doseInput.value)/f).toExponential(4);input.dispatchEvent(new Event('change',{bubbles:true}));}});
 }
 const devices=new Set(['mosfet','fdsoi','pdsoi','rcat','bcat','finfet','gaafet','mbcfet','charge-trap','cfet']);
 const fields=(row,items,target)=>items.map(f=>applicable(row)&&f.key==='species'?{...f,label:devices.has(target)?'소스/드레인 도핑 종류':'주입 도핑 종류'}:f);
 const label=(row,f,v)=>applicable(row)&&f.key==='species'?(v==='P'?'n+ · P (인)':'p+ · B (붕소)'):null;
 const api={fields,label,sigma,applicable,factor,peak,dose,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.ImplantControls=api;
})(typeof window==='object'?window:globalThis);
