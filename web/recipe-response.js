'use strict';
// Nominal, bounded teaching responses. Parity-tested against recipe_models.py.
(function(root){
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const arr=(t,r,e)=>Math.exp(clamp(-e/8.617333262145e-5*(1/(t+273.15)-1/(r+273.15)),-20,20));
 function lpcvdFactor(p){
  if(p.material!=='PolySi'||p.source_gas!=='SiH4')throw Error('LPCVD 모델은 PolySi / SiH4 조합을 지원합니다.');
  const pressure=p.cvd_pressure??.2;
  return arr(p.depo_temperature??630,630,1)*((p.source_flow??60)/60)**.4*2*pressure/(pressure+.2);
 }
 function nominal(op,p){
  if(p.input_mode!=='Equipment'){
   let rate=p.rate;
   if(op==='deposition'&&p.method==='PVD')rate*=(p.power??500)/500*1.25/(1+(p.pvd_pressure??5)/20)*2*(p.argon_flow??50)/((p.argon_flow??50)+50);
   if(op==='deposition'&&p.method==='CVD')rate*=p.cvd_type==='LPCVD'?lpcvdFactor(p):arr(p.depo_temperature??400,400,.3)*((p.source_flow??100)/100)**.4*2*(p.cvd_pressure??1)/((p.cvd_pressure??1)+1)*((p.cvd_type??'PECVD')!=='PECVD'?1:((p.power??500)/500)**.3);
   if(op==='etch'&&p.method==='Directional')rate*=((p.rf_power??300)/300)**.5*((p.gas_flow??50)/50)**.3;
   if(op==='etch'&&p.method==='Isotropic')rate*=arr(p.etch_temperature??25,25,.25);
   return {rate,nm:(p.method==='ALD'?p.gpc*p.cycles:p.method==='ALE'?p.epc*p.cycles:rate*p.time)*1000};
  }
  let rate,gpc;
  if(op==='deposition'){
   if(p.method==='PVD'){
    const base={Al:.004,Cu:.003,Ti:.002,W:.0015,Co:.002,Mo:.0018,TiN:.002,Si:.003,PolySi:.003,SiO2:.002,Si3N4:.0018}[p.material];
    if(base===undefined)throw Error('이 재료의 PVD 기준 모델은 없습니다.');const pressure=p.pvd_pressure??5,flow=p.argon_flow??50;rate=Math.min(.05,base*p.power/500*1.25/(1+pressure/20)*2*flow/(flow+50));
   }else if(p.method==='CVD'){
    const allowed={'SiH4/O2':['SiO2'],'SiH4/NH3':['Si3N4'],'SiH4':['Si','PolySi'],'WF6/H2':['W']};
    if(!allowed[p.source_gas]?.includes(p.material))throw Error('Source 가스와 재료를 확인하세요.');
    const pressure=p.cvd_pressure??1;rate=p.cvd_type==='LPCVD'?clamp(11.02/60/1000*lpcvdFactor(p),.000001,.03):clamp(.002*arr(p.depo_temperature,400,.3)*(p.source_flow/100)**.4*(p.cvd_type==='PECVD'?(p.power/300)**.3:1)*2*pressure/(pressure+1),.00001,.03);
   }else if(p.method==='ALD'){
    const spec={'TMA/H2O':['Al2O3',.00011],'TDMAH/H2O':['HfO2',.0001],'BDEAS/O2':['SiO2',.00008],'TiCl4/NH3':['TiN',.00005]}[p.precursor];
    if(!spec||spec[0]!==p.material)throw Error('전구체와 재료를 확인하세요.');gpc=spec[1]*(1-Math.exp(-p.pulse/.08));
   }else throw Error('선택한 공정의 기준 조건을 확인하세요.');
  }else if(op==='etch'){
   if(p.method==='ALE')return {nm:p.epc*p.cycles*1000};
   let base;
   if(p.method==='Isotropic'){
    base={HF:{SiO2:.003},H3PO4:{Si3N4:.002},HNA:{Si:.004,PolySi:.004,SiGe:.005}}[p.etchant]?.[p.material];
    if(base===undefined)throw Error('Etchant와 재료를 확인하세요.');rate=Math.min(.05,base*arr(p.etch_temperature,25,.25));
   }else{
    base={CF4:{SiO2:.003,Si3N4:.002,Si:.001},Cl2:{Si:.004,PolySi:.004,TiN:.002,Al:.003},HBr:{Si:.002,PolySi:.002}}[p.gas]?.[p.material];
    if(base===undefined)throw Error('반응 가스와 재료를 확인하세요.');rate=Math.min(.05,base*(p.rf_power/300)**.5*(p.gas_flow/50)**.3);
   }
  }else return null;
  return {nm:(gpc===undefined?rate*p.time:gpc*p.cycles)*1000,rate,gpc};
 }
 const api={nominal};if(typeof module==='object'&&module.exports)module.exports=api;else root.RecipeResponse=api;
})(typeof window==='object'?window:globalThis);
