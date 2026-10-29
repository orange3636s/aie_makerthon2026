'use strict';
// Local-only UI regression harness. Native physics is tested separately.
(() => {
 const $=id=>document.getElementById(id),rows=[],errors=[];
 addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const until=async(fn,label,timeout=15000)=>{for(let i=0;i<timeout/50;i++){if(fn())return;await delay(50)}throw Error('Timeout '+label)};
 const check=(name,ok)=>{if(!ok||errors.length)throw Error(name+' '+errors.join(';'));rows.push(name);$('results').textContent=JSON.stringify({passed:rows.length,rows},null,2)};
 const click=id=>$(id).click();
 $('run-tests').onclick=async()=>{
  const original=window.fetch.bind(window);let offline=false;
  $('run-tests').disabled=true;$('summary').textContent='Running';rows.length=0;errors.length=0;
  try {
   await until(()=>!$('run').disabled,'initial calculation',150000);
   const cat=await(await original('/api/catalog')).json(),refs={};

   window.fetch=async(url,opts={})=>{
    if(['/api/run','/api/reverse'].includes(String(url))){
     if(offline){offline=false;throw TypeError('QA offline')}
     const body=JSON.parse(opts.body),r=structuredClone(refs[body.example||body.target]);
     if(body.steps){r.steps=body.steps;r.frames=r.frames.slice(0,body.steps.length+1);while(r.frames.length<body.steps.length+1)r.frames.push(structuredClone(r.frames.at(-1)));r.frames.forEach((f,i)=>f.stepIndex=i)}
     await delay(60);return new Response(JSON.stringify({result:r}),{status:200});
    }
    return original(url,opts);
   };
   check('Removed measurement UI and dependency',!document.querySelector('[data-analysis],[data-save],[data-history],script[src*="measurement-lab"]'));
   for(const ex of cat.examples.filter(ex=>!new URLSearchParams(location.search).has('focus')||ex.id===new URLSearchParams(location.search).get('focus'))){
    for(const key of Object.keys(refs))delete refs[key];
    refs[ex.id]=await(await original('/api/reference/'+ex.id)).json();
    if(window.reverseLab.active)click('observe-mode');
    await until(()=>!$('run').disabled,'ready');
    document.querySelector(`[data-example="${ex.id}"]`).click();
    await until(()=>!$('run').disabled&&$('title').textContent===ex.title,ex.id);
    for(const card of [...document.querySelectorAll('.frame-card')]){card.click();await Promise.resolve();check(ex.id+' step '+card.dataset.frame+' graph finite',!document.querySelector('.viewer .workbench-analysis svg').innerHTML.match(/NaN|Infinity/))}
    click('view25d');check(ex.id+' 2.5D', $('view25d').getAttribute('aria-pressed')==='true');click('view2d');
    check(ex.id+' layout',document.documentElement.scrollWidth<=innerWidth+1);
    click('reverse-mode');await until(()=>window.reverseLab.active&&!$('reverse-lab').hidden&&!$('r-answer').disabled&&document.querySelector('[data-step]'),'reverse '+ex.id);
    click('r-answer');await until(()=>document.querySelector('.rs-dialog [data-load="0"]'),'candidate list');document.querySelector('.rs-dialog [data-load="0"]').click();await until(()=>!document.querySelector('.rs-dialog').open,'candidate loaded');
    for(const card of [...document.querySelectorAll('[data-step]')]){card.click();await Promise.resolve();check(ex.id+' reverse step '+card.dataset.step,!document.querySelector('.reverse-view .workbench-analysis svg').innerHTML.match(/NaN|Infinity/))}
    click('r25d');check(ex.id+' reverse 2.5D',$('r25d').getAttribute('aria-pressed')==='true');click('r2d');
   }
   const n=document.querySelectorAll('[data-step]').length;click('r-delete');check('Delete one step',document.querySelectorAll('[data-step]').length===n-1);click('r-undo');check('Undo deletion',document.querySelectorAll('[data-step]').length===n);
   click('r-reset');check('Reset to substrate',document.querySelectorAll('[data-step]').length===1);click('r-undo');check('Undo reset',document.querySelectorAll('[data-step]').length===n);
   document.querySelector('[data-step="1"]').click();scrollTo(0,0);click('r-run');await until(()=>!$('r-run').disabled&&$('r-status').textContent.includes('계산 완료'),'run');check('Selected stage retained',document.querySelector('[data-step="1"]').getAttribute('aria-pressed')==='true');check('No forced page scroll',scrollY===0);
   offline=true;click('r-run');await until(()=>!$('r-run').disabled&&$('r-status').textContent.includes('연결'),'offline');check('Network error recovers',!$('r-run').disabled&&$('r-status').textContent.includes('연결'));
   click('r-run');await until(()=>!$('r-run').disabled&&$('r-status').textContent.includes('계산 완료'),'retry');check('Retry completes',$('r-status').textContent.includes('완료'));
   for(const panel of document.querySelectorAll('.workbench-analysis')){const b=panel.querySelector('[data-collapse]');b.click();check('Collapse graph',panel.querySelector('.wb-body').hidden);b.click();check('Expand graph',!panel.querySelector('.wb-body').hidden)}
   check('No uncaught errors',!errors.length);$('summary').textContent='PASS '+rows.length+' checks';
  }catch(e){$('summary').textContent='FAIL '+e.message;$('results').textContent=JSON.stringify({error:e.stack,passed:rows.length,rows},null,2)}
  finally{window.fetch=original;$('run-tests').disabled=false}
 };
})();
