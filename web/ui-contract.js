'use strict';
// Display-only conventions shared by observation, reverse design and tutorial.
(function(root){
 const groups=['Photo','Etch','Deposition','Diffusion','C&C','구조','소자'];
 const labels={Central:'중앙 패턴',Double:'이중 패턴',Triple:'삼중 패턴',Repeat:'반복 패턴',Conformal:'등각 성장 · 기하 모델',Positive:'Positive PR',Negative:'Negative PR',Pattern:'패터닝',Strip:'PR 제거','Pattern transfer':'패턴 전사 · 기하 모델',Directional:'방향성 식각',Isotropic:'등방성 식각','Selective removal':'선택 재료 제거','Ion implantation':'이온 주입',Anneal:'열처리','Wet oxidation':'습식 산화','Dry oxidation':'건식 산화',SiO2:'SiO₂',Si3N4:'Si₃N₄',HfO2:'HfO₂'};
 const label=x=>labels[x]||String(x);
 const text=x=>String(x).replace(/\b(SiO2|Si3N4|HfO2)\b/g,x=>label(x));
 const integer=f=>['cycles','layers','sheets'].includes(f.key);
 const active=(f,p)=>!f.when||Object.entries(f.when).every(([k,v])=>v.includes(p[k]));
 const valid=(f,v)=>f.options?f.options.includes(v):typeof v==='number'&&Number.isFinite(v)&&v>=f.min&&v<=f.max&&(!integer(f)||Number.isInteger(v));
 // A hidden invalid draft must not block the other section's native calculation.
 // Keep valid inactive values so switching back does not erase user's conditions.
 function normalizeInactive(fields,params){const next={...params};for(const f of fields)if(!active(f,params)&&!valid(f,next[f.key]))next[f.key]=f.default;return next;}
 const referenceKey=(id,params)=>id+':'+(params?.section||'default');
 const api={groups,label,text,integer,active,valid,normalizeInactive,referenceKey};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ProcessUI=api;
})(typeof window==='object'?window:globalThis);
