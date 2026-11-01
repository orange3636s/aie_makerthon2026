'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),I=require('../web/implant-controls.js'),G=require('../web/poly-gate-doping.js'),B=require('../wafer-background.cjs'),M=require('../web/learning-lab-models.js'),D=require('../web/dopant-view.js');
for(const [symbol,file] of [['P','phosphorus'],['B','boron']]){
 const rows=fs.readFileSync(file+'_in_silicon_crystalline.csv','utf8').split(/\r?\n/).filter(s=>s&&!s.startsWith('#'));const keys=rows.shift().split(',');
 for(const line of rows){const row=Object.fromEntries(line.split(',').map((v,i)=>[keys[i],v]));assert.equal(I.sigma[symbol][+row.energyKeV],+row.headSigma);}
 for(const energy of [8,10,30,50,100,130,200])for(const value of [1e11,1e13,1e15]){const p={species:symbol,energy,dose:value};assert(Math.abs(I.dose(p,I.peak(p))/value-1)<1e-12);}
}
for(const v of [NaN,Infinity,-1,0,'1e18',1e30])assert.throws(()=>I.dose({species:'P',energy:30},v));
assert.equal(G.defaults('mosfet','gate',{type:'n'}).type,'p');
assert.equal(G.forWafer({type:'n',concentration:1e19},{type:'p'},{type:'n'}).type,'p');
assert.equal(G.forWafer({type:'p',concentration:1e19},{type:'p'},{type:'p'}).type,'p','density change preserves custom gate');
const ids=M.electricalDevices.filter(id=>!['cfet','pn-junction'].includes(id));
for(const id of ids){
 const raw=JSON.parse(fs.readFileSync('references/'+id+'.json')),n=B.apply(raw,{type:'p',concentration:1e16});
 const base=M.deviceIV(n.frames.at(-1),id);assert(base.available,id+base.reason);
 const wrong=B.apply(raw,{type:'n',concentration:1e16});assert(!M.deviceIV(wrong.frames.at(-1),id).available,id+' wrong S/D polarity is rejected');
 // Algebraic polarity regression; real native B runs checked separately.
 const mirrored=structuredClone(raw);for(const f of mirrored.frames){const d=f.concentration;if(!d)continue;for(const kind of ['total','active']){const a=d.fields['P_'+kind],b=d.fields['B_'+kind];delete d.fields['P_'+kind];delete d.fields['B_'+kind];if(a)d.fields['B_'+kind]=a;if(b)d.fields['P_'+kind]=b;if(d.fields['net_'+kind])d.fields['net_'+kind]=d.fields['net_'+kind].map(v=>-v);}}
 const pf=B.apply(mirrored,{type:'n',concentration:1e16}).frames.at(-1),pm=M.deviceIV(pf,id);assert(pm.available,id+': '+pm.reason);assert(pm.series[0].points.at(-1)[0]<0&&pm.series[0].points.at(-1)[1]<0,id+' PMOS signs');
 const body=B.apply(raw,{type:'p',concentration:5e15}).frames.at(-1),changed=M.deviceIV(body,id);assert(changed.available,id+changed.reason);assert.notDeepEqual(changed.series,base.series,id+' wafer concentration response');
 assert.notDeepEqual(D.rgb(1e19),D.rgb(-1e19));assert.notDeepEqual(D.rgb(1e18),D.rgb(1e19));
}
console.log('Dose/concentration round trips, CSV consistency, independent gate edits, 9 NMOS/PMOS models and wafer response passed.');
