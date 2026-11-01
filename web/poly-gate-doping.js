/* Uniform in-situ gate film, independent of Si implantation/transport. */
(function(root){
 'use strict';
 const defaults=(target,view,wafer)=>({type:wafer?.type==='n'?'p':wafer?.type==='p'?'n':/pmos|pfet/i.test(target||'')||view==='sd-p'?'p':'n',concentration:1e20});
 function validate(value,target,view){
  if(value===undefined)return defaults(target,view);
  if(!value||Array.isArray(value)||Object.keys(value).some(k=>!['type','concentration'].includes(k))||!['p','n'].includes(value.type)||typeof value.concentration!=='number'||!Number.isFinite(value.concentration)||value.concentration<1e17||value.concentration>1e20)throw Error('Poly-Si 게이트: p형/n형, 농도 1e17–1e20 cm⁻³를 확인하세요.');
  return {type:value.type,concentration:value.concentration};
 }
 const forWafer=(gate,previous,next)=>previous?.type!==next?.type&&['p','n'].includes(next?.type)?{...gate,type:next.type==='n'?'p':'n'}:gate;
 const equal=(a,b)=>a?.type===b?.type&&a?.concentration===b?.concentration;
 const applicable=(target,step)=>target!=='sadp'&&step?.op==='deposition'&&step.params?.material==='PolySi';
 function controls(prefix,value,disabled=false){
  const d=value||defaults(),off=disabled?'disabled':'';
  return `<div class="field"><label for="${prefix}-type">게이트 도핑 종류</label><select id="${prefix}-type" ${off}><option value="n" ${d.type==='n'?'selected':''}>n+ · P (인)</option><option value="p" ${d.type==='p'?'selected':''}>p+ · B (붕소)</option></select></div><div class="field"><label for="${prefix}-density">게이트 농도 · cm⁻³</label><input id="${prefix}-density" type="number" min="1e17" max="1e20" step="any" value="${typeof d.concentration==='number'&&Number.isFinite(d.concentration)?d.concentration.toExponential(2):''}" required ${off}><small>증착 중 도핑 · 공정 계산 후 색상·I–V 반영</small></div>`;
 }
 function bind(prefix,change){const type=document.getElementById(prefix+'-type'),density=document.getElementById(prefix+'-density');const update=()=>change({type:type.value,concentration:density.value===''?'':Number(density.value)});type.onchange=update;density.oninput=update;}
 const api={forWafer,defaults,validate,equal,applicable,controls,bind};if(typeof module==='object'&&module.exports)module.exports=api;else root.PolyGateDoping=api;
})(typeof window==='object'?window:globalThis);
