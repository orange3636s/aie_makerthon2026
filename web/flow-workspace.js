'use strict';
// Move the existing validated editors into the selected process card, not copies.
(() => {
 const q=id=>document.getElementById(id),slots={};
 function init(){
  for(const [id,hostSelector,listId,formId] of [['observation','.controls','timeline','obs-step-form'],['reverse','.reverse-controls','r-flow','r-form']]){
   const host=document.querySelector(hostSelector),form=q(formId),list=q(listId);if(!host||!form||!list)continue;
   const processPanel=list.closest('.process-panel'),parking=document.createElement('div'),body=document.createElement('div');parking.hidden=true;parking.className='recipe-parking';body.className='inline-recipe';host.append(parking);host.append(processPanel);
   if(id==='reverse'){body.append(q('r-editor-title').closest('.panel-heading'));body.append(form,q('r-status'));}
   else {body.append(form,q('run-status'));host.querySelector(':scope > h2').textContent='Process flow';}
   parking.append(body);slots[id]={host,list,parking,body};processPanel.classList.add('integrated-flow');
  }
  document.body.classList.add('integrated-workspace');refresh();
  const obs=new MutationObserver(()=>{if(!pending){pending=true;queueMicrotask(()=>{pending=false;refresh()})}});for(const s of Object.values(slots))obs.observe(s.list,{childList:true,attributes:true,subtree:true,attributeFilter:['class']});
 }
 let pending=false;
 function park(id){const s=slots[id];if(s&&s.body.parentElement!==s.parking)s.parking.append(s.body);}
 function refresh(){for(const [id,s] of Object.entries(slots)){
  const selected=s.list.querySelector(id==='observation'?'.frame-card.selected':'.flow-step.selected');if(!selected)continue;
  const parent=selected.parentElement;
  if(s.body.parentElement!==parent||selected.nextElementSibling!==s.body)selected.after(s.body);
  selected.setAttribute('aria-expanded','true');s.list.querySelectorAll(id==='observation'?'.frame-card:not(.selected)':'.flow-step:not(.selected)').forEach(b=>b.setAttribute('aria-expanded','false'));
  if(s.selected!==selected){s.selected=selected;const box=s.host.getBoundingClientRect(),card=selected.getBoundingClientRect();if(s.host.scrollHeight>s.host.clientHeight&&(card.top<box.top+60||card.bottom>box.bottom-80))s.host.scrollTop+=card.top-box.top-65;}
 }}
 window.FlowWorkspace={park,refresh};init();
})();
