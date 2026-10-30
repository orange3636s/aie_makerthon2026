'use strict';
(() => {
 const bubble='<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4C10.6 4 4 10.7 4 19.1c0 5.1 2.8 9.7 7.4 12.4l-1.1 6 8-3.5c.6.1 1.2.1 1.7.1 9.4 0 16-6.6 16-15S29.4 4 20 4Z" fill="currentColor"/></svg>';
 const root=document.createElement('div');root.id='pt-chat';
 root.innerHTML=`<button type="button" class="chat-launch" aria-label="AI 튜터 열기" aria-expanded="false" aria-controls="chat-panel">${bubble}</button>
 <section id="chat-panel" hidden aria-labelledby="chat-heading"><header class="chat-header"><div><strong id="chat-heading">AI 튜터</strong><span>ProcessTrace</span></div><button type="button" class="chat-close" aria-label="채팅 닫기">×</button></header>
 <div class="chat-context"><label><input type="checkbox" id="chat-attach" checked> 현재 공정 참고</label><span id="chat-context-label"></span></div>
 <div class="chat-messages" role="log" aria-label="AI 튜터 대화" aria-live="polite" aria-relevant="additions"><div class="chat-welcome"><h3>어떤 점이 궁금한가요?</h3><p>공정 원리부터 현재 레시피까지 질문하세요.</p><div class="chat-prompts"><button type="button">이 단계는 왜 필요한가요?</button><button type="button">어떤 변수를 먼저 바꿔볼까요?</button><button type="button">PVD와 ALD는 어떻게 다른가요?</button></div></div></div>
 <div class="chat-status" role="status" hidden></div>
 <form class="chat-form"><label class="chat-sr" for="chat-question">반도체 질문</label><textarea id="chat-question" maxlength="1000" rows="2" placeholder="반도체 질문을 입력하세요"></textarea><div class="chat-form-footer"><span>Enter 전송 · Shift+Enter 줄바꿈</span><button class="chat-send" type="submit" aria-label="질문 보내기">보내기 <span aria-hidden="true">↑</span></button></div></form></section>`;
 document.body.append(root);
 const $=s=>root.querySelector(s),launch=$('.chat-launch'),panel=$('#chat-panel'),input=$('#chat-question'),send=$('.chat-send'),log=$('.chat-messages'),status=$('.chat-status'),attach=$('#chat-attach');
 let controller=null,token=0,history=[],timer=null,composing=false,lastFailure=null;
 function snapshot(){
  if(!attach.checked)return {label:'일반 질문',key:'general',payload:{}};
  try{
   let c=window.ProcessLearningLab?.context();
   if(!c?.id)return {label:'화면 준비 중 · 일반 질문',key:'general',payload:{}};
   if(!window.reverseLab?.active&&window.simulationEditor?.chatContext)c={...c,...simulationEditor.chatContext()};
   const steps=structuredClone(c.steps||[]),index=c.selectedIndex??c.index??0;
   if(!Number.isInteger(index)||index<0||index>steps.length)return {label:'일반 질문',key:'general',payload:{}};
   return {label:`${c.title||c.id} · ${index?'STEP '+String(index).padStart(2,'0'):'Wafer'}${c.pending?' · 미계산':''}`,key:c.id,
    payload:{target:c.id,view:c.view||'gate',steps,selectedStep:index,pending:!!c.pending,substrateThickness:c.substrateThickness,substrateRoughness:c.substrateRoughness||0}};
  }catch{return {label:'일반 질문',key:'general',payload:{}};}
 }
 function updateContext(){const s=snapshot();$('#chat-context-label').textContent=s.label;$('#chat-context-label').title=s.label;}
 function open(){panel.hidden=false;launch.setAttribute('aria-expanded','true');launch.setAttribute('aria-label','AI 튜터 닫기');updateContext();clearInterval(timer);timer=setInterval(updateContext,600);input.focus();}
 function close(){panel.hidden=true;launch.setAttribute('aria-expanded','false');launch.setAttribute('aria-label','AI 튜터 열기');clearInterval(timer);stop();launch.focus();}
 function message(role,text,label){
  $('.chat-welcome')?.remove();const row=document.createElement('article');row.className='chat-message '+role;
  const meta=document.createElement('small');meta.textContent=label|| (role==='user'?'나':'AI 튜터');const body=document.createElement('div');body.className='chat-text';body.textContent=text;row.append(meta,body);log.append(row);
  while(log.children.length>60)log.firstElementChild.remove();log.scrollTop=log.scrollHeight;return row;
 }
 function state(active){send.type=active?'button':'submit';send.textContent=active?'중지':'보내기 ↑';send.setAttribute('aria-label',active?'답변 생성 중지':'질문 보내기');send.classList.toggle('is-stop',active);input.readOnly=active;log.setAttribute('aria-busy',String(active));}
 function clearStatus(){status.hidden=true;status.replaceChildren();lastFailure=null;}
 function error(text,retry){status.hidden=false;status.textContent=text;if(retry){const b=document.createElement('button');b.type='button';b.textContent='다시 시도';b.addEventListener('click',()=>{const request=lastFailure;if(request)ask(request.question,request.snapshot,true)});status.append(b);}}
 function stop(){if(!controller)return;token++;controller.abort();controller=null;$('.chat-loading')?.remove();state(false);error('답변 생성을 중지했습니다.',false);}
 async function ask(question,context=snapshot(),retry=false){
  if(controller||!question.trim())return;
  question=question.trim();if(question.length>1000)return;
  const id=++token;controller=new AbortController();const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(65000)]);
  clearStatus();if(!retry)message('user',question,context.label);input.value=question;state(true);
  const loading=message('assistant','답변을 준비하고 있어요.','AI 튜터');loading.classList.add('chat-loading');
  // History is scoped by target and records the exact stage attached to each question.
  const prior=history.filter(h=>h.key===context.key).slice(-8).map(({role,content})=>({role,content}));
  try{
   const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({...context.payload,question,history:prior})});
   let data;try{data=await r.json()}catch{throw Error('서버 응답을 읽지 못했습니다. 다시 시도하세요.');}
   if(!r.ok)throw Error(data.error||'AI에 연결하지 못했습니다. 다시 시도하세요.');
   if(typeof data.answer!=='string'||!data.answer.trim()||data.answer.length>2400)throw Error('답변 형식을 확인하지 못했습니다. 다시 시도하세요.');
   if(id!==token)return;
   loading.remove();message('assistant',data.answer,'AI 튜터 · '+context.label);
   history.push({key:context.key,role:'user',content:`[${context.label}] ${question}`},{key:context.key,role:'assistant',content:data.answer});history=history.slice(-32);input.value='';
  }catch(e){if(id!==token)return;loading.remove();lastFailure={question,snapshot:context};error(signal.aborted?'응답 시간이 길어지고 있습니다. 잠시 후 다시 시도하세요.':e.message,true);}
  finally{if(id===token){controller=null;state(false);if(!panel.hidden)input.focus();}}
 }
 launch.addEventListener('click',()=>panel.hidden?open():close());$('.chat-close').addEventListener('click',close);
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.stopPropagation();close();}});
 attach.addEventListener('change',updateContext);
 $('.chat-form').addEventListener('submit',e=>{e.preventDefault();if(!composing)ask(input.value);});
 send.addEventListener('click',e=>{if(controller){e.preventDefault();stop();}});
 input.addEventListener('compositionstart',()=>{composing=true});input.addEventListener('compositionend',()=>{composing=false});
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&!composing&&e.keyCode!==229){e.preventDefault();ask(input.value);}});
 $('.chat-prompts').addEventListener('click',e=>{const b=e.target.closest('button');if(b){input.value=b.textContent;input.focus();}});
})();
