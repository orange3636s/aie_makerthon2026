/* First-party local QA fixture, activated explicitly by its visible button. */
(() => {
 const button=document.createElement('button');button.id='run-workflows';button.textContent='전체 역설계 · 파라미터 · Live 검사';document.getElementById('run-tests').after(button);
 const q=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const until=async(fn,label)=>{for(let i=0;i<1800;i++){if(fn())return;await pause(50)}throw Error('Timeout: '+label)};
 const assert=(ok,label)=>{if(!ok)throw Error(label)};
 const visible=e=>e.getClientRects().length&&e.offsetWidth&&!e.closest('details:not([open])');
 button.onclick=async()=>{
  button.disabled=true;const report={examples:[],errors:[]};
  const onerror=e=>report.errors.push(e.message||String(e.reason));addEventListener('error',onerror);addEventListener('unhandledrejection',onerror);
  try{
   await until(()=>!busy&&current&&window.reverseLab,'initialization');await document.fonts.ready;assert(document.fonts.check('14px ProcessSans'),'font unavailable');
   for(const ex of catalog){
    await reverseLab.select(ex.id,true);await reverseLab.loadCandidate({targetId:ex.id,name:'검증용 예제',steps:reverseLab.context().reference.steps});
    await until(()=>!reverseLab.busy,'load '+ex.id);
    const n=reverseLab.context().steps.length,row={id:ex.id,stages:n+1,inputs:0,live:[],edited:false};
    for(let i=0;i<=n;i++){
     const card=document.querySelector(`#r-flow [data-step="${i}"]`);assert(card,ex.id+' missing step '+i);card.click();await pause(0);
     let disclosure=document.querySelector(`#r-flow [data-step="${i}"]`).parentElement.querySelector('.flow-disclosure');
     assert(disclosure.getAttribute('aria-expanded')==='false',ex.id+' selection must not expand '+i);disclosure.click();await pause(0);
     const ctx=reverseLab.context();assert(ctx.selectedIndex===i&&SolidView.get('r-current').data===ctx.frame,ex.id+' selected frame mismatch '+i);
     for(const details of q('reverse-fields').querySelectorAll('details'))details.open=true;
     for(const input of [...q('reverse-fields').querySelectorAll('input[type=number]')].filter(visible)){
      assert(input.validity.valid,ex.id+' invalid parameter '+input.id+'='+input.value);row.inputs++;
      const css=getComputedStyle(input),c=document.createElement('canvas').getContext('2d');c.font=css.font;
      assert(input.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)>=c.measureText(input.value).width,ex.id+' clipped value '+input.id);
     }
     document.querySelector(`#r-flow [data-step="${i}"]`).parentElement.querySelector('.flow-disclosure').click();await pause(0);assert(document.querySelector(`#r-flow [data-step="${i}"]`).parentElement.querySelector('.flow-disclosure').getAttribute('aria-expanded')==='false',ex.id+' collapse '+i);
    }
    const index=reverseLab.context().steps.findIndex(s=>['deposition','etch'].includes(s.op)||s.op==='diffusion'&&s.params.method==='Ion implantation')+1;
    if(index){
     document.querySelector(`#r-flow [data-step="${index}"]`).click();
     for(const mode of ['2d','25d']){
      q('r'+mode).click();if(mode==='2d')document.querySelector('.reverse-view [data-axis="Y"]').click();const live=document.querySelector('.reverse-view .live-toggle');live.click();assert(live.getAttribute('aria-pressed')==='true',ex.id+' live start');
      await pause(80);reverseLab.redraw();const before=q('r-current').toDataURL();await pause(220);reverseLab.redraw();const after=q('r-current').toDataURL();assert(before!==after,ex.id+' '+mode+' frozen animation');
      live.click();assert(!SolidView.get('r-current').live,ex.id+' live stop');row.live.push(mode);
     }
     q('r2d').click();const card=document.querySelector(`#r-flow [data-step="${index}"]`);card.click();await pause(0);document.querySelector(`#r-flow [data-step="${index}"]`).parentElement.querySelector('.flow-disclosure').click();
     const input=[...q('reverse-fields').querySelectorAll('input[type=number]')].find(visible);
     if(input){const old=input.value,value=Math.min(+input.max,Math.max(+input.min,Number(old)*1.05+.01));input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));assert(reverseLab.context().pending,ex.id+' edit must invalidate results');input.value=old;input.dispatchEvent(new Event('input',{bubbles:true}));row.edited=true;}
    }
    assert(document.documentElement.scrollWidth<=innerWidth+2,ex.id+' document overflow');report.examples.push(row);q('qa-summary').textContent='진행 · '+ex.id+' · '+report.examples.length+'/24';q('qa-results').textContent=JSON.stringify(report,null,2);
   }
   assert(!report.errors.length,report.errors.join('; '));q('qa-summary').textContent='PASS · '+report.examples.length+' 역설계 / '+report.examples.reduce((n,r)=>n+r.stages,0)+' 단계 / '+report.examples.reduce((n,r)=>n+r.inputs,0)+' 입력값 / '+report.examples.reduce((n,r)=>n+r.live.length,0)+' Live';
  }catch(e){report.failure=e.stack;q('qa-summary').textContent='FAIL · '+e.message;}
  finally{q('qa-results').textContent=JSON.stringify(report,null,2);button.disabled=false;removeEventListener('error',onerror);removeEventListener('unhandledrejection',onerror);}
 };
})();
