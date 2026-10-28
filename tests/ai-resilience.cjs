'use strict';
const assert=require('node:assert/strict'),{explain}=require('../gemini.cjs'),memoFactory=require('../ai-cache.cjs');
const report={findings:[]},env={GEMINI_API_KEY:'test'},good=()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({summary:'일치',suggestions:[]})}]}}]})});
(async()=>{
 let n=0,delays=[];const opts={env,random:()=>0,sleep:async ms=>delays.push(ms),fetchImpl:async()=>++n<3?{ok:false,status:503,json:async()=>({})}:good()};
 assert.equal((await explain(report,opts)).summary,'일치');assert.equal(n,3);assert.deepEqual(delays,[1000,2000]);
 n=0;await assert.rejects(explain(report,{...opts,fetchImpl:async()=>{n++;return{ok:false,status:401,json:async()=>({})}}}),/인증/);assert.equal(n,1);
 n=0;await assert.rejects(explain(report,{...opts,fetchImpl:async()=>{n++;return{ok:false,status:429,json:async()=>({error:{message:'Quota exceeded daily limit: 0'}})}}}),/한도/);assert.equal(n,1);
 n=0;await assert.rejects(explain(report,{...opts,fetchImpl:async()=>{n++;return{ok:false,status:429,headers:{get:()=> '60'},json:async()=>({})}}}),/제한/);assert.equal(n,1);
 n=0;await assert.rejects(explain(report,{...opts,fetchImpl:async()=>{n++;return{ok:false,status:503,json:async()=>({})}}}),/재시도/);assert.equal(n,3);
 let time=0,calls=0;const memo=memoFactory({ttl:10,now:()=>time});const work=async()=>{calls++;return 7};
 assert.deepEqual(await Promise.all([memo('a',work),memo('a',work)]),[7,7]);assert.equal(calls,1);await memo('a',work);assert.equal(calls,1);time=11;await memo('a',work);assert.equal(calls,2);
 await assert.rejects(memo('b',async()=>{throw Error('temporary')}));assert.equal(await memo('b',work),7);
 console.log('AI retry/backoff, hard quota, Retry-After, bounded retries, concurrent deduplication, cache expiry and failure recovery passed');
})().catch(e=>{console.error(e);process.exitCode=1});
