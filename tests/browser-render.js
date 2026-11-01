'use strict';
// Local-only real UI/canvas/WebGL regression; no mocked solver responses.
(() => {
 const q=id=>document.getElementById(id),errors=[],report=[];
 addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 const until=async(fn,label)=>{for(let i=0;i<1200;i++){if(fn())return;await pause(50)}throw Error('Timeout: '+label)};
 const tick=()=>new Promise(r=>{const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();r()};channel.port2.postMessage(0)});
 function pixels(canvas){const small=document.createElement('canvas');small.width=128;small.height=80;const c=small.getContext('2d',{willReadFrequently:true});c.drawImage(canvas,0,0,128,80);const a=c.getImageData(0,0,128,80).data;let colored=0;for(let i=0;i<a.length;i+=4)if(a[i]+a[i+1]+a[i+2]<680&&a[i+3])colored++;return {colored,small};}
 function assert(ok,label){if(!ok)throw Error(label);if(errors.length)throw Error(errors.join('; '));}
 function thumb(canvas,label){const card=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src=canvas.toDataURL();img.style.width='100%';caption.textContent=label;card.style.margin='0';card.append(img,caption);q('qa-gallery').append(card);}
 q('run-tests').onclick=async()=>{
  q('run-tests').disabled=true;report.length=0;errors.length=0;q('qa-gallery').replaceChildren();
  const started=performance.now();let frames=0,renders=0;
  try{
   await until(()=>!busy&&current,'initial result');
   const examples=(await(await fetch('/api/catalog')).json()).examples;
   const start=new URLSearchParams(location.search).get('start');
   for(const ex of examples.slice(Math.max(0,examples.findIndex(e=>e.id===start)))){
    await select(ex.id);await until(()=>!busy&&current&&selected.id===ex.id,'example '+ex.id);
    const cards=[...document.querySelectorAll('#timeline .frame-card')];let count=0;
    assert(cards.length===current.frames.length,ex.id+' timeline/frame mismatch');
    for(const [i,card] of cards.entries()){
     card.click();await tick();
     const data=current.frames[i];assert(data.polygons.every(p=>p.points.every(v=>v.every(Number.isFinite))),ex.id+' nonfinite geometry');
     q('view2d').click();
     for(const axis of ['Y','X','Z']){
      document.querySelector('#observation [data-axis="'+axis+'"]').click();await tick();
      const result=pixels(q('section'));renders++;
      if(axis==='Y')assert(result.colored>15,ex.id+' step '+i+' empty 2D');
      if(axis==='Y'&&[0,Math.floor(cards.length/2),cards.length-1].includes(i))thumb(result.small,ex.id+' · '+i+' · 2D');
     }
     q('view25d').click();await tick();
     await until(()=>q('section').dataset.renderer==='webgl',ex.id+' WebGL');
     const result=pixels(q('section'));renders++;assert(result.colored>15,ex.id+' step '+i+' empty 3D');
     if([0,Math.floor(cards.length/2),cards.length-1].includes(i))thumb(result.small,ex.id+' · '+i+' · 3D');
     const disclosure=card.parentElement.querySelector('.flow-disclosure');disclosure.click();await tick();
     assert(disclosure.getAttribute('aria-expanded')==='true',ex.id+' expand '+i);
     const form=q('obs-step-form'),fr=form.getBoundingClientRect();
     for(const field of form.querySelectorAll('input:not([type=range]),select')){if(!field.getClientRects().length||field.closest('details:not([open])'))continue;const r=field.getBoundingClientRect();assert(r.left>=fr.left-2&&r.right<=fr.right+2,ex.id+' overflowing input '+field.id);}
     disclosure.click();await tick();assert(disclosure.getAttribute('aria-expanded')==='false',ex.id+' collapse '+i);
     count++;frames++;q('qa-summary').textContent=`진행 · ${ex.id} ${i+1}/${cards.length} · ${frames} 단계 / ${renders} 렌더`;
    }
    const split=document.querySelector('#observation .explode-toggle');split.click();await tick();assert(pixels(q('section')).colored>15,ex.id+' exploded');document.querySelector('#observation .explode-reset').click();
    assert(document.documentElement.scrollWidth<=innerWidth+1,ex.id+' page overflow');
    report.push({id:ex.id,frames:count});q('qa-results').textContent=JSON.stringify({frames,renders,report,errors},null,2);
   }
   q('qa-summary').textContent=`PASS · ${report.length} 예제 / ${frames} 단계 / ${renders} 렌더 · ${Math.round((performance.now()-started)/1000)}초`;
  }catch(e){q('qa-summary').textContent='FAIL · '+e.message;q('qa-results').textContent=JSON.stringify({frames,renders,report,errors,stack:e.stack},null,2);}
  finally{q('run-tests').disabled=false;}
 };
})();
