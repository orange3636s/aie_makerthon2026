'use strict';
// Discrete native snapshots. No interpolated geometry, no preview in grading state.
(function(root){
 const cache=new Map(),slots=new Map();
 function values(value,field){return [...new Set([.5,1,1.5].map(k=>Math.min(field.max,Math.max(field.min,Number((value*k).toPrecision(6))))))]}
 function descriptor(step,operation){const key=step?.op==='etch'&&!['ALE','Selective removal','Pattern transfer'].includes(step.params.method)?'time':step?.op==='diffusion'&&step.params.method==='Ion implantation'?'dose':null;return key&&operation.fields.find(f=>f.key===key)}
 function stop(s){s.generation++;s.controller?.abort();s.controller=null;const pending=s.job?fetch('/api/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({job:s.job})}).catch(()=>{}):Promise.resolve();s.job=null;s.preview=null;return pending}
 function cancelAll(){return Promise.all([...slots.values()].map(s=>{const p=stop(s);s.draw?.();return p}))}
 function frame(id,f){const s=slots.get(id);return s?.preview||f}
 function active(id){return !!slots.get(id)?.preview}
 async function compute(payload,s,mine){
  const id=crypto.randomUUID();s.job=id;const signal=AbortSignal.any([s.controller.signal,AbortSignal.timeout(190000)]);
  const get=async(url,options={})=>{const r=await fetch(url,{...options,signal});const j=await r.json();if(!r.ok)throw Error(j.error||'계산 실패');return j};
  let j=await get('/api/reverse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,requestId:id})});
  while(!j.result){if(mine!==s.generation)throw new DOMException('취소','AbortError');if(['error','cancelled'].includes(j.state))throw Error(j.error||'계산 중지');await new Promise(r=>setTimeout(r,500));j=await get('/api/jobs/'+id);}
  s.job=null;if(j.result.failure)throw Error(j.result.failure.message);return j.result.frames.at(-1);
 }
 function mount(host,options){
  const {id,target,steps,index,operation,draw,apply,disabled=false,view='gate',substrateThickness,substrateRoughness=0}=options,step=steps[index-1],field=descriptor(step,operation),prefix=steps.slice(0,index);
  let s=slots.get(id);if(!s){s={generation:0,key:null};slots.set(id,s)}s.draw=draw;
  const value=step?.params?.[field?.key],valid=typeof value==='number'&&Number.isFinite(value)&&value>=field?.min&&value<=field?.max;
  const key=field&&valid&&!disabled?JSON.stringify([target,view,substrateThickness,substrateRoughness,prefix,field.key]):null;
  if(s.key!==key){stop(s);s.key=key;host.replaceChildren()}
  if(!key){host.hidden=true;return}host.hidden=false;
  if(host.firstChild)return;
  const samples=values(step.params[field.key],field);if(samples.length<2){host.hidden=true;return}
  host.className='preview-lab';host.innerHTML='<header><b>변화 미리보기</b><button type="button" data-build>조건 3개 계산</button></header><div data-controls hidden><input type="range" min="0" step="1" aria-label="미리 계산한 조건 선택"><header><output></output><button type="button" data-apply>레시피에 적용</button><button type="button" data-close>닫기</button></header></div><p role="status">미리보기</p>';
  const b=host.querySelector('[data-build]'),controls=host.querySelector('[data-controls]'),slider=host.querySelector('input'),out=host.querySelector('output'),note=host.querySelector('p');slider.max=samples.length-1;
  b.textContent=`조건 ${samples.length}개 계산`;let snapshots=cache.get(key);
  const display=()=>{s.preview=snapshots[+slider.value];out.textContent=field.label+' '+Number(samples[+slider.value]).toPrecision(3)+' '+field.unit;note.textContent='미리보기';draw()};
  const ready=()=>{controls.hidden=false;b.hidden=true;slider.value=Math.max(0,samples.indexOf(step.params[field.key]));display()};
  b.onclick=async()=>{if(s.controller){stop(s);s.controller=null;b.textContent='다시 계산';draw();return}const mine=++s.generation;s.controller=new AbortController();b.textContent='중지';snapshots=[];try{for(let i=0;i<samples.length;i++){note.textContent=`미리 계산 중 ${i+1}/${samples.length}`;const batch=structuredClone(prefix);batch[index-1].params[field.key]=samples[i];delete batch[index-1].label;const result=await compute({target,view,steps:batch,substrateRoughness,...(substrateThickness!==undefined?{substrateThickness}:{})},s,mine);if(mine!==s.generation)return;snapshots.push(result)}cache.set(key,snapshots);if(cache.size>6)cache.delete(cache.keys().next().value);ready()}catch(e){if(mine===s.generation){note.textContent=e.name==='AbortError'?'계산 중지':e.message;b.textContent='다시 계산'}}finally{if(mine===s.generation)s.controller=null}};
  slider.oninput=display;host.querySelector('[data-close]').onclick=()=>{s.preview=null;draw();controls.hidden=true;b.hidden=false;b.textContent='저장된 변화 보기'};
  host.querySelector('[data-apply]').onclick=()=>{const value=samples[+slider.value];s.preview=null;apply(field,value);draw()};
  if(snapshots){b.onclick=ready;b.textContent='저장된 변화 보기'}
 }
 const api={mount,frame,active,cancelAll,values,descriptor};if(typeof module==='object'&&module.exports)module.exports=api;else root.ParameterPreview=api;
})(typeof window==='object'?window:globalThis);
