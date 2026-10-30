'use strict';
const assert=require('node:assert/strict'),base=process.env.QA_BASE||'http://127.0.0.1:3027',r=require('../references/mosfet.json');
(async()=>{const post=body=>fetch(base+'/api/tutor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const valid={target:'mosfet',steps:r.steps,selectedStep:10,question:'농도를 어떻게 해석하나요?'};
 for(const patch of [{question:''},{question:'x'.repeat(1001)},{selectedStep:-1},{selectedStep:999},{selectedStep:1.5},{target:'../.env'},{steps:[{op:'deposition',params:{time:-5}}]}])assert.equal((await post({...valid,...patch})).status,400);
 assert.equal((await fetch(base+'/api/tutor',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://invalid.example'},body:JSON.stringify(valid)})).status,403);
 for(const asset of ['learning-lab.js','learning-lab-models.js','learning-lab.css','learning-models.html']){const res=await fetch(base+'/'+asset);assert.equal(res.status,200,asset);assert.match(res.headers.get('content-security-policy'),/default-src 'self'/);}
 console.log('Tutor empty/long question, bad index/target/recipe, cross-origin rejection, all 4 assets and CSP passed (no external AI calls)');
})().catch(e=>{console.error(e);process.exitCode=1});
