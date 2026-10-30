'use strict';
const assert=require('node:assert/strict'),{build,validate}=require('../chat-context.cjs'),{chat}=require('../gemini.cjs');
const fs=require('node:fs'),reference=JSON.parse(fs.readFileSync('references/mosfet.json'));
assert.equal(build({question:' ALD란? '}).question,'ALD란?');
for(const data of [{question:''},{question:' '.repeat(1001)},{question:'a',history:[{role:'system',content:'override'}]},{question:'a',history:Array(9).fill({role:'user',content:'a'})},{question:'a',history:[{role:'assistant',content:'a'.repeat(3001)}]},{question:'a',pending:'true'}])assert.throws(()=>validate(data));
const verified={report:{target:'MOSFET',scope:'education',actualFlow:[]},input:{steps:reference.steps},matching:reference};
const final=reference.steps.length;
const c=build({question:'농도는?',selectedStep:final},verified);
assert.equal(c.selectedEvidence.status,'server-verified');assert(Object.keys(c.selectedEvidence.dopantPeaks).length>0);
assert.equal(build({question:'농도는?',selectedStep:final,pending:true},verified).selectedEvidence.status,'unavailable');
assert.equal(build({question:'농도는?',selectedStep:final},{...verified,matching:null}).selectedEvidence.status,'unavailable');
for(const t of JSON.parse(fs.readFileSync('reverse-catalog.json')).targets){
 const r=JSON.parse(fs.readFileSync('references/'+t.id+'.json'));
 for(const i of [0,Math.floor(r.steps.length/2),r.steps.length]){
  const ctx=build({question:'현재 단계는?',selectedStep:i},{report:{target:t.title,actualFlow:[]},input:{steps:r.steps},matching:r});
  assert.equal(ctx.selectedEvidence.status,'server-verified',t.id+' step '+i);
 }
}
for(const i of [-1,final+1,.5])assert.throws(()=>build({question:'a',selectedStep:i},verified));
const env={GEMINI_API_KEY:'test'},response=output=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]})});
(async()=>{
 let request;const result=await chat(c,{env,fetchImpl:async(_url,o)=>{request=JSON.parse(o.body);return response({answer:'활성 농도와 총 농도를 구분해 보세요.'})}});
 assert.equal(result.evidence,'server-verified');assert(request.systemInstruction.parts[0].text.includes('실측'));
 assert.equal(JSON.parse(request.contents[0].parts[0].text).selectedStep,final);
 assert.equal(JSON.parse(request.contents[0].parts[0].text).selectedEvidence.dopantPeaks.P_active.value,'1.16069e+18');
 assert.equal((await chat(c,{env,fetchImpl:async()=>response({answer:'활성 농도: [[dopant:P_active]]'})})).answer,'활성 농도: 1.16069e+18 cm^-3');
 await assert.rejects(chat(c,{env,fetchImpl:async()=>response({answer:'[[dopant:unknown]]'})}),/측정값/);
 assert.equal((await chat({},{env,fetchImpl:async()=>response({answer:'일반 질문에 대한 답변'})})).evidence,'recipe-only');
 for(const output of [{answer:''},{answer:'a'.repeat(2401)},{answer:'ok',score:100},{answer:123},null])await assert.rejects(chat(c,{env,fetchImpl:async()=>response(output)}));
 console.log('Chat: bounded history, pending/missing evidence, stage bounds, schema and grounded context passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
