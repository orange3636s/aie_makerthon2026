'use strict';
// Selection controls the drawing; the separate disclosure controls the editor.
(() => {
 const q=id=>document.getElementById(id),slots={};let pending=false;
 function park(id){const s=slots[id];if(s&&s.body.parentElement!==s.parking)s.parking.append(s.body);}
 function refresh(){for(const [id,s] of Object.entries(slots)){
  const key=location.hash;if(s.key!==key){s.open=null;s.key=key;}
  const selector=id==='observation'?'.frame-card':'.flow-step';
  const cards=[...s.list.querySelectorAll(selector)];
  const selected=cards.find(c=>c.classList.contains('selected'));
  const index=c=>c.dataset.frame??c.dataset.step;
  if(selected&&s.selectedIndex!==index(selected)){s.open=null;s.selectedIndex=index(selected);}
  for(const card of cards){
   let row=card.parentElement;
   if(id==='observation'&&!row.classList.contains('process-row')){row=document.createElement('div');card.before(row);row.append(card);}
   if(!row.classList.contains('process-row'))row.classList.add('process-row');
   let toggle=row.querySelector(':scope > .flow-disclosure');
   if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.className='flow-disclosure';toggle.textContent='⌄';row.append(toggle);}
   const isOpen=card===selected&&s.open===index(card);
   if(row.classList.contains('expanded')!==isOpen)row.classList.toggle('expanded',isOpen);
   toggle.setAttribute('aria-label',`${card.textContent.trim()} 조건 ${isOpen?'접기':'펼치기'}`);
   toggle.setAttribute('aria-expanded',String(isOpen));toggle.setAttribute('aria-controls',s.body.id);
   card.removeAttribute('aria-expanded');
   toggle.onclick=e=>{e.stopPropagation();const n=index(card),was=s.open===n;card.click();s.selectedIndex=n;s.open=was?null:n;refresh();s.list.querySelector(`[data-${id==='observation'?'frame':'step'}="${n}"]`)?.parentElement.querySelector('.flow-disclosure')?.focus({preventScroll:true});};
   if(isOpen&&s.body.parentElement!==row)row.append(s.body);
  }
  if(!selected||s.open!==index(selected))park(id);
 }}
 for(const [id,hostSelector,listId,formId] of [['observation','.controls','timeline','obs-step-form'],['reverse','.reverse-controls','r-flow','r-form']]){
  const host=document.querySelector(hostSelector),form=q(formId),list=q(listId);if(!host||!form||!list)continue;
  const panel=list.closest('.process-panel'),parking=document.createElement('div'),body=document.createElement('div');
  parking.hidden=true;parking.className='recipe-parking';body.className='inline-recipe';body.id=id+'-inline-recipe';host.append(parking,panel);
  if(id==='reverse')body.append(q('r-editor-title').closest('.panel-heading'),form,q('r-status'));
  else {body.append(form,q('run-status'));host.querySelector(':scope > h2').textContent='Process flow';}
  parking.append(body);slots[id]={host,list,parking,body,open:null};panel.classList.add('integrated-flow');
 }
 window.FlowWorkspace={park,refresh};document.body.classList.add('integrated-workspace');refresh();
 const observer=new MutationObserver(()=>{if(!pending){pending=true;queueMicrotask(()=>{pending=false;refresh()});}});
 for(const s of Object.values(slots))observer.observe(s.list,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
})();
