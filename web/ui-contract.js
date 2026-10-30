'use strict';
// Display-only conventions shared by observation, reverse design and tutorial.
(function(root){
 const groups=['초급','중급','고급'];
 const beginner=new Set(['photo-lithography','pvd','wet','sf6','fin','planarization']);
 const devices=new Set(['pn-junction','mosfet','fdsoi','pdsoi','rcat','bcat','finfet','gaafet','mbcfet','charge-trap','cfet']);
 const level=example=>devices.has(example.id)||example.group==='소자'?'고급':beginner.has(example.id)?'초급':'중급';
 const labels={Central:'중앙 패턴',Double:'이중 패턴',Triple:'삼중 패턴',Repeat:'반복 패턴',Conformal:'등각 성장 · 기하 모델',Positive:'Positive PR',Negative:'Negative PR',Pattern:'패터닝',Strip:'PR 제거','Pattern transfer':'패턴 전사 · 기하 모델',Directional:'방향성 식각',Isotropic:'등방성 식각','Selective removal':'선택 재료 제거','Ion implantation':'이온 주입',Anneal:'열처리','Pre-deposition':'Pre-deposition','Drive-in':'Drive-in','Wet oxidation':'습식 산화','Dry oxidation':'건식 산화',SiO2:'SiO₂',Si3N4:'Si₃N₄',HfO2:'HfO₂'};
 const label=x=>labels[x]||String(x);
 Object.assign(labels,{Effective:'유효 속도',Equipment:'장비 조건 · 학습 모델',Thickness:'두께 지정',Spin:'Spin coating',HMDS:'HMDS coating',Exposure:'Alignment & Exposure',Ashing:'PR ashing',Exposed:'노출 표면','Section sides':'단면 밖 측면 접근',Existing:'현재 구조 마스크',Pattern:'Patterning · 기존 통합 단계',Patterning:'Patterning',Coat:'PR coating',Develop:'Developing',Strip:'PR strip',PolySi:'Poly Si',Al2O3:'Al₂O₃',HfZrO2:'HZO (Hf₀.₅Zr₀.₅O₂)',Anneal:'Annealing',Directional:'Dry Etch',Isotropic:'Wet Etch',Conformal:'기존 예제 · 기하 성장',Metal:'기존 재료 · Metal',Dielectric:'기존 재료 · Dielectric',
 Unspecified:'미지정','Ceria oxide':'CeO₂ (SiO₂ slurry)','Silica oxide':'SiO₂ abrasive (SiO₂ slurry)','Silica silicon':'Colloidal SiO₂ (Si slurry)','Silica polysilicon':'Colloidal SiO₂ (Poly Si slurry)','Silica nitride':'Colloidal SiO₂ (Si₃N₄ slurry)','Silica SiGe':'SiO₂ (SiGe slurry)','Silica tungsten':'SiO₂ 기반 (W slurry)','Cobalt formulated':'Co slurry','Silica molybdenum':'SiO₂ (Mo slurry)','Silica TiN':'SiO₂ (TiN slurry)','Silica hafnia':'SiO₂ (HfO₂ slurry)','Unverified alumina':'Al₂O₃ slurry · 미설정','Unverified HZO':'HZO slurry · 미설정'});
 const legacy=v=>['Conformal','Selective removal','Pattern transfer','Metal','Dielectric','Pattern'].includes(v);
 const optionsFor=(f,value)=>(f.options||[]).filter(v=>!legacy(v)||v===value);
 // Separate process pickers, while retaining the validated native thermal adapter.
 function processKind(row){return row?.op==='diffusion'?(row.params.method==='Ion implantation'?'implant':/oxidation$/.test(row.params.method)?'oxidation':'diffusion'):row?.op;}
 function recipeFields(op,p){const kind=processKind({op:op.id,params:p});return op.fields.filter(f=>active(f,p)&&!(op.id==='deposition'&&f.key==='power'&&p.method==='CVD'&&p.cvd_type==='Thermal CVD')&&!(kind==='implant'&&f.key==='method')).map(f=>f.key==='method'&&op.id==='diffusion'?{...f,options:kind==='oxidation'?['Wet oxidation','Dry oxidation']:['Pre-deposition','Drive-in','Anneal']}:f);}
 const processTitle=row=>({implant:'Ion implantation',oxidation:'Oxidation',diffusion:'Diffusion',photo:'Photo',etch:'Etch',deposition:'Deposition',cmp:'C&C'}[processKind(row)]||'Process');
 const text=x=>String(x).replace(/\b(SiO2|Si3N4|HfO2|PolySi|Al2O3|HfZrO2)\b/g,x=>label(x)).replace(/\bCMP\b/g,'C&C');
 const integer=f=>['cycles','layers','sheets'].includes(f.key);
 const active=(f,p)=>!f.when||Object.entries(f.when).every(([k,v])=>v.includes(p[k]));
 const valid=(f,v)=>f.options?f.options.includes(v):typeof v==='number'&&Number.isFinite(v)&&v>=f.min&&v<=f.max&&(!integer(f)||Number.isInteger(v));
 // A hidden invalid draft must not block the other section's native calculation.
 // Keep valid inactive values so switching back does not erase user's conditions.
 function normalizeInactive(fields,params){const next={...params};for(const f of fields)if(!active(f,params)&&!valid(f,next[f.key]))next[f.key]=f.default;return next;}
 const referenceKey=(id,params)=>id+':'+(params?.section||'default');
 // API, saved recipes and solver geometry retain their original units.
 // Only the display/input boundary converts lengths to nm, exactly once.
 const unitPower=u=>/^[µμu]m(?:$|\/)/.test(u||'')?3:/^[µμu]m[²2](?:$|\/)/.test(u||'')?6:0;
 function decimalShift(v,p){if(typeof v!=='number'||!Number.isFinite(v)||!p)return v;const [m,e='0']=String(v).split('e');return Number(m+'e'+(Number(e)+p));}
 const displayUnit=u=>unitPower(u)?String(u).replace(/^[µμu]m/,'nm'):u||'';
 const displayValue=(f,v)=>decimalShift(v,unitPower(f.unit));
 const inputValue=(f,v)=>decimalShift(v,-unitPower(f.unit));
 const fieldLabel=f=>f.key==='exponent'?'입사 방향성':f.key==='gpc'?'포화 시 사이클당 성장량':f.label;
 const dimensionless=f=>['sticking','ald_sticking','exponent'].includes(f.key)&&!f.unit;
 function displayField(f){return {...f,label:fieldLabel(f),unit:dimensionless(f)?'무차원':displayUnit(f.unit),...Object.fromEntries(['min','max','step','default'].filter(k=>k in f).map(k=>[k,displayValue(f,f[k])]))};}
 function hint(f){return "";}
 function displayText(s){return String(s).replace(/(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*([µμu]m(?:[²2])?(?:\/[A-Za-z]+)?)/gi,(_,v,u)=>decimalShift(Number(v),unitPower(u))+' '+displayUnit(u));}
 const advanced=f=>['sticking','ald_sticking','exponent','isotropic','access'].includes(f.key);
 function groupControls(fields,render,expanded=false){const basic=fields.filter(f=>!advanced(f)),extra=fields.filter(advanced);return basic.map(render).join('')+(extra.length?`<details class="advanced-options" ${expanded?'open':''}><summary>고급 모델 설정 <span aria-hidden="true">⌄</span></summary><div class="advanced-fields">${extra.map(render).join('')}</div></details>`:'');}
 if(typeof document==='object')document.addEventListener('invalid',event=>{const details=event.target.closest?.('.advanced-options');if(details)details.open=true;},true);
 const api={groups,level,label,text,integer,active,valid,normalizeInactive,referenceKey,displayUnit,displayValue,inputValue,displayField,fieldLabel,hint,displayText,advanced,groupControls,legacy,optionsFor,recipeFields,processKind,processTitle};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ProcessUI=api;
})(typeof window==='object'?window:globalThis);
