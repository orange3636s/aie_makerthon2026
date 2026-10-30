// Explicit live AI smoke tests: three images, one contextual tutor, one design review.
// Outputs are reviewable evidence, not a statistical recognition-accuracy benchmark.
'use strict';
const {chromium}=require('../.runtime/browser-qa/node_modules/playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.QA_BASE||'http://127.0.0.1:3032',out='.runtime/final-ai-live';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),p=await b.newPage({viewport:{width:1440,height:900}}),report={images:[],errors:[]};p.on('pageerror',e=>report.errors.push(e.message));
try{
 const ref=require('../references/mosfet.json');fs.writeFileSync(out+'/mosfet.png',require('../scripts/reference-images.cjs').render(ref));
 await p.goto(base+'/#mosfet');await p.waitForFunction(()=>current?.frames?.length&&!busy,null,{timeout:180000});
 for(const [file,expected,kind] of [[out+'/mosfet.png','mosfet','generated numerical cross-section'],['C:/Users/psj03/AppData/Local/Temp/codex-clipboard-1108fc13-b83b-43d8-bba4-7a4ec701aff0.png','bosch','user supplied etched cross-section'],['C:/Users/psj03/AppData/Local/Temp/codex-clipboard-fe42eee6-1b9e-4b0b-a7e6-5ef5dfd35d09.png','locos','user supplied diagram and SEM composite']]){
  await p.locator('#upload-target').click();const response=p.waitForResponse(r=>r.url().endsWith('/api/classify'),{timeout:75000}),at=Date.now();await p.locator('#r-file').setInputFiles(file);const r=await response,j=await r.json();
  report.images.push({kind,expected,status:r.status(),ms:Date.now()-at,response:j});assert(r.ok(),JSON.stringify(j));assert.equal(j.recommendations.length,3);assert.equal(new Set(j.recommendations.map(x=>x.target)).size,3);assert(j.recommendations.some(x=>x.target===expected),kind+' omitted expected target');
  await p.locator('#image-recommendations button').first().waitFor();await p.screenshot({path:out+'/'+expected+'.png'});const selected=j.recommendations[0].target;await p.locator('#image-recommendations button').first().click();await p.waitForFunction(id=>reverseLab.context().id===id,selected);console.log('Image',expected,r.status(),j.recommendations.map(x=>x.target));
 }
 async function post(route,body){const at=Date.now(),r=await p.request.post(base+route,{data:body,timeout:75000}),j=await r.json();return{status:r.status(),ms:Date.now()-at,response:j}}
 report.chat=await post('/api/chat',{target:'mosfet',steps:ref.steps,selectedStep:ref.steps.length,question:'현재 MOSFET의 P 활성 농도 최고값과 총 농도 최고값을 알려주고 차이를 짧게 설명해줘.',history:[],pending:false});assert.equal(report.chat.status,200);assert(report.chat.response.answer);
 report.analysis=await post('/api/analyze',{target:'mosfet',steps:ref.steps});assert.equal(report.analysis.status,200);assert.equal(report.analysis.response.numericalEvidence.status,'server-verified');assert.equal(report.analysis.response.ai.suggestions.length,0,'correct reference must not invent missing steps');
 report.tutor=await post('/api/tutor',{target:'mosfet',steps:ref.steps,selectedStep:10,question:'이 단계의 도펀트 P는 n형인가 p형인가? 열처리 전 활성 농도와 총 농도의 차이를 설명해줘.'});assert.equal(report.tutor.status,200);
 assert.deepEqual(report.errors,[]);
}catch(e){report.failure=e.stack;throw e}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
