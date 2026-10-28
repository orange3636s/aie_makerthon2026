/* Run via tests/prepare-browser.cjs and the /qa.html page. Native integration
 * is tested separately; deterministic UI failures here replace network replies. */
'use strict';
(() => {
const output=document.getElementById('results');
let rows=[],w=window,d=document,originalFetch,fault=null,calls=[];
const runtimeErrors=[];window.addEventListener('error',e=>runtimeErrors.push(e.message));window.addEventListener('unhandledrejection',e=>runtimeErrors.push(String(e.reason)));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let n=0;n<300;n++){if(fn())return;await delay(100)}throw Error('Timeout: '+label)}
function check(name,pass,detail=''){if(runtimeErrors.length){pass=false;detail=runtimeErrors.join('; ')}rows.push({name,pass:!!pass,detail});output.textContent=JSON.stringify({passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass).length,rows},null,2);if(!pass)throw Error(name+': '+detail)}
const $=id=>d.getElementById(id);
async function click(id){$(id).click();await delay(50)}
function input(id,value,event='input'){const e=$(id);e.value=String(value);e.dispatchEvent(new w.Event(event,{bubbles:true}));}
const shown=e=>!!e&&e.getClientRects().length>0;
async function enter(id){await w.reverseLab.select(id,true);await until(()=>!$('r-answer').disabled,'reference '+id)}
async function answer(){await click('r-answer');await click('r-load-answer')}
async function observe(id){if(w.reverseLab.active){await click('observe-mode');await until(()=>!$('run').disabled,'exit reverse')}w.location.hash=id;await delay(100);await until(()=>$('run').disabled===false&&w.location.hash==='#'+id,'observation '+id)}
function card(n){d.querySelector(`[data-step="${n}"]`).click()}
document.getElementById('run-tests').onclick=async()=>{
 document.getElementById('run-tests').disabled=true;rows=[];output.textContent='Preparing browser scenarios…';
 try{
  const catalog=await(await fetch('/api/catalog')).json(),recipes=await(await fetch('/api/reverse-catalog')).json();
  const references={};for(const id of ['photo-lithography','finfet','mosfet','cfet','charge-trap']){const response=await fetch('/api/reference/'+id);if(!response.ok)throw Error('Missing fixture: '+id);references[id]=await response.json();if(!references[id].frames)throw Error('Invalid fixture: '+id)}
  await until(()=>$('run')&&!$('run').disabled&&d.querySelector('.frame-card'),'initial native run');
  originalFetch=w.fetch.bind(w);
  w.fetch=async(url,options={})=>{
   const route=String(url);calls.push(route);
   if(route==='/api/analyze')return new w.Response(JSON.stringify({error:'테스트: AI 연결 실패'}),{status:503});
   if(route==='/api/classify'){await delay(250);return new w.Response(JSON.stringify({identification:'적층 채널 단면',confidence:.9,ambiguous:false,recommendations:[{target:'mbcfet',title:'MBCFET',category:'소자'},{target:'fin',title:'Fin',category:'구조'},{target:'sadp',title:'SADP',category:'Photo'}]}),{status:200})}
   if(route==='/api/run'||route==='/api/reverse'){
    if(fault==='network'){fault=null;throw new TypeError('test offline')}
    const p=JSON.parse(options.body),id=p.example||p.target,key=id+(p.view&&p.view!=='gate'?'?view='+p.view:p.params?.section?.includes('S/D')?'?view=sd':'');
    let r=structuredClone(references[key]||references['photo-lithography']);r.params=p.params||{};r.elapsed=.1;r.example=id;
    if(route==='/api/reverse'){
     r.frames=r.frames.slice(0,p.steps.length+1);
     while(r.frames.length<p.steps.length+1)r.frames.push(structuredClone(r.frames.at(-1)));
     r.steps=p.steps;for(let k=0;k<r.frames.length;k++)r.frames[k].stepIndex=k;
     r.failure=null;
     if(fault==='solver'){fault=null;r.failure={step:2,message:'테스트: 공정 조건을 확인하세요.'};r.frames=r.frames.slice(0,2)}
    }
    await delay(100);return new w.Response(JSON.stringify({result:r}),{status:200});
   }
   return originalFetch(url,options);
  };
  check('Observation selected mode is announced',$('observe-mode').getAttribute('aria-pressed')==='true');
  check('Chemical names use subscripts',!d.querySelector('#timeline').textContent.includes('SiO2'));
  check('Observation active concentration default',$('doping-field').value==='net_active');
  await observe('finfet');await until(()=>d.querySelector('#fields input'),'Fin fields');
  check('Devices use one integrated view',$('section-views').hidden&&!d.querySelector('[data-section]'));
  check('Integrated device has doping controls',!$('doping-field').hidden);
  const stepCard=d.querySelectorAll('.frame-card')[1];stepCard.click();await delay(60);
  check('Clicking observation flow opens step editor',!$('obs-step-form').hidden&&!!$('obs-p-width'));
  input('obs-p-width',.9);w.scrollTo(0,0);await click('obs-step-run');await until(()=>!$('obs-step-run').disabled,'step calculation');
  check('Observation edit keeps current step',$('obs-step-title').textContent.includes('STEP 1'));
  check('Observation edit keeps scroll',w.scrollY===0);
  await click('obs-basic');check('Basic controls remain available',!$('condition-form').hidden);
  await enter('photo-lithography');await answer();
  const n=recipes.targets.find(t=>t.id==='photo-lithography').recipe.length;
  check('Canonical flow contains substrate plus recipe',d.querySelectorAll('[data-step]').length===n+1);
  const photoAt=recipes.targets.find(t=>t.id==='photo-lithography').recipe.findIndex(x=>x.op==='photo'&&x.params.action!=='Strip')+1;card(photoAt);
  input('rp-tone','Negative','change');
  check('Edited polarity updates flow title',d.querySelector(`[data-step="${photoAt}"] strong`).textContent.includes('Negative PR'));
  check('Editing clears old evaluation',$('r-score').hidden&&$('r-grade').disabled);
  const beforeDelete=d.querySelectorAll('[data-step]').length;await click('r-delete');
  check('Delete removes one step',d.querySelectorAll('[data-step]').length===beforeDelete-1);await click('r-undo');
  check('Undo restores removed step',d.querySelectorAll('[data-step]').length===beforeDelete);
  card(2);const priorOrder=[...d.querySelectorAll('[data-step] strong')].map(x=>x.textContent).join('|');await click('r-right');await click('r-undo');
  check('Undo restores order',[...d.querySelectorAll('[data-step] strong')].map(x=>x.textContent).join('|')===priorOrder);
  await click('r-reset');check('Reset starts from substrate',d.querySelectorAll('[data-step]').length===1);await click('r-undo');
  check('Reset can be recovered',d.querySelectorAll('[data-step]').length===beforeDelete);
  card(1);w.scrollTo(0,0);const oldScroll=w.scrollY;await click('r-run');await until(()=>!$('r-run').disabled,'reverse calculation');
  check('Calculate retains viewed step',d.querySelector('[data-step="1"]').getAttribute('aria-pressed')==='true');
  check('Calculate retains vertical scroll',Math.abs(w.scrollY-oldScroll)<=1,`${oldScroll} → ${w.scrollY}`);
  check('Reverse export is recipe',$('export-json').textContent==='레시피 저장');
  fault='network';await click('r-run');await until(()=>!$('r-run').disabled,'network recovery');
  check('Network error is actionable',$('r-status').textContent.includes('연결'));check('Run unlocks after error',!$('r-run').disabled);
  await click('r-run');await until(()=>!$('r-run').disabled,'retry');check('Retry succeeds',$('r-status').textContent.includes('계산 완료'));
  fault='solver';await click('r-run');await until(()=>!$('r-run').disabled,'solver failure');
  check('Partial solver failure identifies step',$('r-status').textContent.includes('STEP 2'));check('Partial result cannot be graded',$('r-grade').disabled);
  await answer();await click('r-grade');await until(()=>$('review-content').textContent.includes('실패'),'AI failure fallback');
  check('Analysis fallback retains findings',$('review-content').textContent.includes('누락이나 조건 차이가 없습니다'));
  check('Analysis dialog labelled',$('review-dialog').getAttribute('aria-labelledby')==='review-title');await click('review-done');
  await click('upload-target');
  const pickerGroups=[...d.querySelectorAll('.target-group summary>span:first-child')].map(x=>x.textContent);
  check('Target picker shares library order',pickerGroups.join('|')===w.ProcessUI.groups.filter(x=>pickerGroups.includes(x)).join('|'));
  check('Target picker contains every library example',d.querySelectorAll('[data-target]').length===catalog.examples.length);
  check('Image dialog labelled',$('image-dialog').getAttribute('aria-labelledby')==='image-title');await click('image-close');
  await click('r-reset');
  async function addOp(op){await click('r-add');d.querySelector(`[data-op="${op}"]`).click();await delay(30)}
  await addOp('photo');input('rp-tone','Negative','change');input('rp-pattern','Double','change');
  check('Photo exposes PR polarity and mask',!!$('rp-tone')&&!!$('rp-pattern')&&$('rp-tone').value==='Negative');
  await addOp('etch');check('Etch exposes anisotropy and rate',!!$('rp-isotropic')&&!!$('rp-rate'));
  await addOp('deposition');input('rp-method','ALD','change');check('ALD exposes cycles and GPC',!!$('rp-cycles')&&!!$('rp-gpc')&&!$('rp-exponent'));
  input('rp-cycles',2.5);await click('r-run');check('Fractional ALD cycles cannot calculate',$('r-grade').disabled&&!$('rp-cycles').checkValidity());
  input('rp-cycles','');input('rp-method','CVD','change');check('Changing deposition method clears hidden invalid draft',!!$('rp-sticking')&&!!$('rp-exponent')&&!$('rp-cycles'));
  await addOp('diffusion');check('Implant exposes dose and species',!!$('rp-dose')&&!!$('rp-species'));
  input('rp-dose','');input('rp-method','Anneal','change');check('Anneal exposes temperature and duration',!!$('rp-temperature')&&!!$('rp-time')&&!$('rp-dose'));
  await addOp('cmp');check('CMP needs no invented parameters',!$('reverse-fields').querySelector('input,select'));
  const saveFn=w.Storage.prototype.setItem;w.Storage.prototype.setItem=()=>{throw Error('test quota')};await click('r-delete');w.Storage.prototype.setItem=saveFn;
  check('Unavailable draft storage gives recovery guidance',$('toast').textContent.includes('레시피 저장'));await click('r-undo');
  await click('r-reset');for(let i=0;i<64;i++)await addOp('photo');check('Flow stops at 64 operations',$('r-add').disabled&&d.querySelectorAll('[data-step]').length===65);await click('r-reset');
  const cfg=await(await originalFetch('/api/config')).json();
  if(cfg.imageAnalysis){
   const canvas=d.createElement('canvas');canvas.width=canvas.height=20;const blob=await new Promise(r=>canvas.toBlob(r));
   const transfer=new w.DataTransfer();transfer.items.add(new w.File([blob],'test-structure.png',{type:'image/png'}));$('r-file').files=transfer.files;$('r-file').dispatchEvent(new w.Event('change'));
   await until(()=>!!d.querySelector('#image-recommendations button'),'image recommendation');
   check('Three image learning recommendations',d.querySelectorAll('#image-recommendations button').length===3);
   check('Recommendation reasons omitted',!d.querySelector('#image-recommendations').textContent.includes('추천 이유'));
   check('Image recommendation expands the matching theme',d.querySelector('[data-target="mbcfet"]').closest('details').open);
   d.querySelector('[data-target="mbcfet"]').click();await until(()=>$('title').textContent==='MBCFET'&&!$('r-answer').disabled,'select recommendation');
   check('Image target selection starts clean',d.querySelectorAll('[data-step]').length===1);
   const secondTransfer=new w.DataTransfer();secondTransfer.items.add(new w.File([blob],'test-again.png',{type:'image/png'}));$('r-file').files=secondTransfer.files;$('r-file').dispatchEvent(new w.Event('change'));await until(()=>$('image-dialog').open,'second image');await click('image-close');await delay(350);
   check('Closing image analysis ignores late response',!$('image-dialog').open);
  }
  await click('r25d');check('2.5D pressed state',$('r25d').getAttribute('aria-pressed')==='true'&&$('r2d').getAttribute('aria-pressed')==='false');
  for(const id of ['photo-lithography','cfet','charge-trap','mosfet','finfet']){
   const width=w.innerWidth;await enter(id);await answer();await delay(80);
   check(width+'px: no page overflow',d.documentElement.scrollWidth<=w.innerWidth+1,`${d.documentElement.scrollWidth}/${w.innerWidth}`);
   check(width+'px: usable delete button',d.querySelector('.flow-remove').getBoundingClientRect().width>=32);
   check(width+'px: both structures visible',shown($('r-target'))&&shown($('r-current')));
   for(const id2 of ['r-run','r-answer','r-reset','r-grade']){const r=$(id2).getBoundingClientRect();check(width+'px: '+id2+' fits',r.left>=-1&&r.right<=w.innerWidth+1,JSON.stringify({left:r.left,right:r.right}))}
   await click('r-grade');await until(()=>$('review-dialog').open,'dialog');
   check(width+'px: analysis fits viewport',$('review-dialog').getBoundingClientRect().width<=w.innerWidth);await click('review-done');
  }
  await observe('photo-lithography');d.querySelector('.frame-card').click();w.scrollTo(0,0);await click('play');await delay(1900);
  check('Playback never scrolls document',w.scrollY===0);await click('play');
  check('Observation export label restored',$('export-json').textContent==='결과 저장');
  check('No uncaught browser errors',runtimeErrors.length===0);
  document.getElementById('summary').textContent='COMPLETE: '+rows.length+' passed';
 }catch(e){document.getElementById('summary').textContent='FAILED: '+e.message;output.textContent=JSON.stringify({error:e.stack,rows},null,2)}
 finally{document.getElementById('run-tests').disabled=false}
};
document.getElementById('layout-test').onclick=async()=>{
 try{const width=innerWidth;await enter('cfet');await answer();check(width+'px CFET: no page overflow',document.documentElement.scrollWidth<=innerWidth+1);for(const id of ['r-run','r-answer','r-reset','r-grade']){const r=$(id).getBoundingClientRect();check(width+'px '+id+' within viewport',r.left>=-1&&r.right<=innerWidth+1)}await click('r-grade');check(width+'px modal fits',$('review-dialog').getBoundingClientRect().width<=innerWidth);document.getElementById('summary').textContent='LAYOUT PASS '+width+'px';}catch(e){document.getElementById('summary').textContent='LAYOUT FAILED '+e.message}
};
})();
