'use strict';
const $ = id => document.getElementById(id);
const materials = window.SIMULATION_MATERIALS;
const tips={};
function materialStyle(id){return materials[id]||{name:'Material '+id,color:'#BBC7DA'}}
function shade(hex, factor){return '#'+hex.slice(1).match(/../g).map(s=>Math.round(parseInt(s,16)*factor).toString(16).padStart(2,'0')).join('')}
function representation(){const m=selected?.mode;return m==='geometry'?'공정 모델 · 기하 공정 모델':m==='mask'?'공정 모델 · GDS 마스크 변환':'공정 모델 · 공정 물리 모델'}
function viewNote(){return mode==='2.5d'?'2D 단면의 표시용 깊이 · 3D 계산 아님':selected?.mode==='geometry'?'기하 공정 결과 · 도핑·전기 특성 미포함':selected?.mode==='mask'?'GDS 평면도 · 노광 블러 근사':'실제 계산된 재료 경계'}
let catalog=[],selected=null,current=null,frame=0,busy=false,mode='2d',timer=null,toastTimer=null;
const references=new Map(),lastResults=new Map();
function trimResults(map,limit=3){while(map.size>limit){const key=[...map.keys()].find(k=>!map.get(k)?.customFlow);if(key===undefined)break;map.delete(key)}}
let calculationGeneration=0,calculationJob=null,calculationTick=null,calculationController=null;
function cancelJob(id){return id?request('/api/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({job:id})}).catch(()=>{}):Promise.resolve();}
function cancelCalculation(){const previewCancellation=window.ParameterPreview?.cancelAll();calculationGeneration++;calculationController?.abort();calculationController=null;clearInterval(calculationTick);calculationTick=null;const old=calculationJob;calculationJob=null;if(busy)setBusy(false);return Promise.all([previewCancellation,cancelJob(old)]);}
async function calculateJob(path,payload,mine){
 const controller=new AbortController();calculationController=controller;const requestId=crypto.randomUUID();calculationJob=requestId;
 const job=await request(path,{method:'POST',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(190000)]),headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,requestId})});
 if(mine!==calculationGeneration){await cancelJob(job.job);return null;}calculationJob=job.job||null;let result=job.result;
 for(let i=0;!result&&i<260;i++){if(mine!==calculationGeneration)return null;const info=await request('/api/jobs/'+job.job);if(mine!==calculationGeneration)return null;if(info.state==='cancelled')return null;if(info.state==='error')throw Error(info.error);if(info.state==='done')result=info.result;else await new Promise(r=>setTimeout(r,600));}
 if(mine!==calculationGeneration)return null;calculationJob=null;if(!result)throw Error('계산 응답 시간이 초과됐습니다.');return result;
}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500)}
function status(text,error=false){$('run-status').textContent=text;$('run-status').classList.toggle('error',error)}
function stop(){clearInterval(timer);timer=null;$('play').textContent='▶ 과정 재생'}
function setBusy(value){busy=value;for(const id of ['observe-mode','reverse-mode','upload-target'])if($(id))$(id).disabled=value;stop();document.querySelectorAll('#condition-form input,#condition-form select,#reset,#run,#timeline button,#section-views button,#obs-step-form input,#obs-step-form select,#obs-step-run,#obs-basic,#obs-step').forEach(e=>e.disabled=value);$('run').innerHTML=value?'<span>◌</span> 계산 중…':'<span>▶</span> 공정 계산';$('loading').hidden=!value;for(const id of ['play','pin-reference','export-json','download-image'])$(id).disabled=value||!current;if(selected)fieldVisibility();}
function shortNumber(v){return typeof v==='number'&&(Math.abs(v)>=1e6||(Math.abs(v)>0&&Math.abs(v)<.0001))?v.toExponential().replace('e+','e'):String(v)}
function defaults(spec){return Object.fromEntries(spec.fields.map(f=>[f.key,f.default]))}
function values(){return Object.fromEntries(selected.fields.map(f=>[f.key,f.options?f.options.find(v=>String(v)===$('number-'+f.key).value):($('number-'+f.key).value===''?'':ProcessUI.inputValue(f,Number($('number-'+f.key).value)))]))}
function updateBasicEstimate(){ProcessEstimate.render($('basic-estimate'),ProcessEstimate.example(selected,values()))}
function dirty(){updateBasicEstimate();const changed=!!current&&JSON.stringify(values())!==JSON.stringify(current.params);$('pending').hidden=!changed;return changed}
let openTheme=null;
function nav(){
 const groups=ProcessUI.groups.filter(g=>catalog.some(s=>ProcessUI.level(s)===g));
 $('examples').innerHTML=groups.map((group,i)=>{
  const list=catalog.filter(s=>ProcessUI.level(s)===group),open=group===openTheme;
  return `<section class="theme-group"><button class="theme-toggle" aria-expanded="${open}" aria-controls="theme-${i}" data-theme="${group}"><span>${group}</span><span class="theme-meta">${list.length}<span class="chevron" aria-hidden="true">⌄</span></span></button><div id="theme-${i}" class="theme-items" ${open?'':'hidden'}>${list.map(s=>`<button class="nav-item ${s.id===selected.id?'active':''}" data-example="${s.id}" aria-pressed="${s.id===selected.id}"><span class="nav-name">${s.title}</span>${s.id===selected.id?'<span class="selected-dot" aria-hidden="true"></span>':''}</button>`).join('')}</div></section>`;
 }).join('');
 document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>{openTheme=openTheme===b.dataset.theme?null:b.dataset.theme;nav();if(window.reverseLab?.busy)document.querySelectorAll('[data-example]').forEach(el=>el.disabled=true)}));
 document.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.example)));
}
async function select(id){if(window.reverseLab?.busy)return;const cancellation=cancelCalculation(),selectionGeneration=calculationGeneration;await cancellation;if(selectionGeneration!==calculationGeneration)return;if(window.reverseLab?.active)return window.reverseLab.select(id);stop();selected=catalog.find(s=>s.id===id);if(!selected)return;$('export-json').textContent='결과 저장';openTheme=ProcessUI.level(selected);current=lastResults.get(id)||null;frame=current?Math.max(0,Math.min(frame,current.frames.length-1)):0;nav();$('theme-label').textContent=ProcessUI.level(selected)+' / PROCESS FLOW';$('model-link').textContent='공정 모델';$('model-link').href='/tutorial#'+id;$('title').textContent=selected.title;$('subtitle').textContent=selected.subtitle;$('category').textContent=selected.group;$('description').textContent=selected.description;$('hint').textContent=tips[id];$('model-note').textContent=ProcessUI.displayText(selected.note);$('source').href=selected.source;$('compare').checked=false;
 history.replaceState(null,'','#'+id);$('model-badge').textContent=representation();$('view-note').textContent=viewNote();$('axis-type').textContent=id==='gds'?'MASK · X–Y':id==='finfet'?'GATE CENTER · X–Y':'X–Y';$('provenance').textContent=selected.mode==='geometry'?'◉ 공정 모델 기하 공정 · 치수 기반 형상 계산':selected.mode==='mask'?'◉ 동봉된 GDS layer 0 · 원본과 블러 결과':'◉ 재료 경계는 공정 모델의 중간 계산 결과입니다.';
 window.simulationEditor?.reset();const params=current?current.params:defaults(selected);
 $('fields').innerHTML=ProcessUI.groupControls(selected.fields,raw=>{const f=ProcessUI.displayField(raw);return f.options?`<div class="field"><label for="number-${f.key}">${ProcessUI.text(f.label)}</label><select id="number-${f.key}">${f.options.map(v=>`<option value="${v}" ${v===params[f.key]?'selected':''}>${ProcessUI.label(v)}</option>`).join('')}</select></div>`:`<div class="field"><div class="field-top"><label for="number-${f.key}">${ProcessUI.text(f.label)}</label><div class="number-wrap"><input id="number-${f.key}" type="number" min="${f.min}" max="${f.max}" step="${ProcessUI.integer(f)?1:'any'}" value="${shortNumber(ProcessUI.displayValue(raw,params[f.key]))}" required><span>${f.unit}</span></div></div><input id="range-${f.key}" aria-label="${ProcessUI.text(f.label)} 조절" type="range" min="${f.min}" max="${f.max}" step="${f.key.includes('dose')?'any':f.step}" value="${ProcessUI.displayValue(raw,params[f.key])}"><div class="range-labels"><span>${shortNumber(f.min)}</span><span>${shortNumber(f.max)}</span></div>${ProcessUI.hint(raw)?`<p class="field-help">${ProcessUI.hint(raw)}</p>`:''}</div>`});
 selected.fields.forEach(f=>{const n=$('number-'+f.key),r=$('range-'+f.key);if(!r){n.addEventListener('change',()=>{dirty();fieldVisibility()});return}r.addEventListener('input',()=>{n.value=shortNumber(Number(r.value));dirty()});n.addEventListener('input',()=>{r.value=n.value;dirty()})});
 fieldVisibility();updateBasicEstimate();$('pending').hidden=true;
 if(current){frame=current.previewFrame??current.frames.length-1;updateAll();status('마지막 계산 결과를 불러왔습니다.');$('loading').hidden=true;}else{frame=0;window.FlowWorkspace?.park('observation');$('timeline').innerHTML='<div class="empty-timeline">새 예제의 공정 단계를 계산하고 있습니다.</div>';$('legend').textContent='';$('frame-label').textContent='계산 준비';$('step-count').textContent='0 / 0';for(const id of ['metric-low','metric-high','metric-frames','metric-time'])$(id).textContent='—';$('insight-title').textContent='이번 공정의 관찰 포인트';$('insight').textContent=tips[id];drawMain();await run();}
}
function fieldVisibility(){const p=values(),clean=ProcessUI.normalizeInactive(selected.fields,p);selected.fields.forEach(f=>{const n=$('number-'+f.key),r=$('range-'+f.key),hidden=f.key==='section'||!ProcessUI.active(f,p);n.closest('.field').hidden=hidden;n.disabled=busy||hidden;if(r)r.disabled=busy||hidden;if(clean[f.key]!==p[f.key]){n.value=ProcessUI.displayValue(f,clean[f.key]);if(r)r.value=n.value}});renderSectionViews()}
function renderSectionViews(){
 const field=selected?.fields.find(f=>f.key==='section'),holder=$('section-views');holder.hidden=!field;if(!field){holder.replaceChildren();return}
 const labels={'게이트 단면':'게이트 구조','n형 S/D·콘택':'n형 S/D 도핑·컨택','p형 S/D·콘택':'p형 S/D 도핑·컨택'};
 holder.innerHTML=field.options.map(v=>`<button type="button" data-section="${v}" aria-pressed="${$('number-section').value===v}" ${busy?'disabled':''}>${labels[v]||v}</button>`).join('')+'<small>게이트 횡단면 / 독립 S/D 학습 단면</small>';
 holder.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(busy)return;$('number-section').value=b.dataset.section;fieldVisibility();dirty();run()});
}
async function request(path,options={}){try{const response=await fetch(path,{...options,signal:options.signal||AbortSignal.timeout(190000)});let data;try{data=await response.json()}catch{throw Error('서버 응답을 읽지 못했습니다. 잠시 후 다시 실행하세요.')}if(!response.ok)throw Error(data.error||'요청을 처리하지 못했습니다.');return data}catch(e){if(e.name==='TimeoutError')throw Error('응답 시간이 초과됐습니다. 잠시 후 다시 실행하세요.');if(e instanceof TypeError)throw Error('서버 연결이 끊겼습니다. 연결을 확인한 뒤 다시 실행하세요.');throw e}}
async function run(){if(busy||!selected)return;if(!$('condition-form').reportValidity())return;const params=values(),id=selected.id,hadResult=!!current&&current.params.section===params.section,mine=++calculationGeneration;setBusy(true);let elapsed=0;status('단계별 단면 계산 중…');calculationTick=setInterval(()=>{if(mine===calculationGeneration)status(`계산 중 · ${++elapsed}초 경과`)},1000);
 try{const result=await calculateJob('/api/run',{example:id,params},mine);if(!result||mine!==calculationGeneration)return;
  current=result;lastResults.set(id,result);trimResults(lastResults);if(!result.failure&&!references.has(ProcessUI.referenceKey(id,result.params)))references.set(ProcessUI.referenceKey(id,result.params),result);trimResults(references);frame=hadResult?Math.min(frame,result.frames.length-1):(result.previewFrame??result.frames.length-1);updateAll();status(result.failure?`STEP ${result.failure.step} · ${result.failure.message}`:result.cached?'저장된 계산 결과':`계산 완료 · ${result.elapsed.toFixed(2)}초`,!!result.failure);$('pending').hidden=true;
 }catch(e){if(mine!==calculationGeneration)return;status(e.message,true);toast(e.message);if(current)updateAll();else {window.FlowWorkspace?.park('observation');$('timeline').innerHTML='<div class="empty-timeline">계산을 완료하지 못했습니다. <button type="button" id="retry-calculation">다시 계산</button></div>';$('retry-calculation').onclick=()=>run();}}
 finally{if(mine===calculationGeneration){clearInterval(calculationTick);calculationTick=null;setBusy(false);window.simulationEditor?.result();}}
}
function combinedBounds(result,reference){if(!reference)return result.bounds;return [Math.min(result.bounds[0],reference.bounds[0]),Math.max(result.bounds[1],reference.bounds[1]),Math.min(result.bounds[2],reference.bounds[2]),Math.max(result.bounds[3],reference.bounds[3])]}
function refFrame(){const ref=references.get(ProcessUI.referenceKey(selected.id,current?.params));if(!ref||!current)return null;const progress=current.frames[frame].progress;return ref.frames.reduce((best,f)=>Math.abs(f.progress-progress)<Math.abs(best.progress-progress)?f:best,ref.frames[0]);}
function dopingFieldFor(data){return window.DopantView?.field(data)||'net_total'}
function draw(canvas,data,bounds,options={}){
 // A loading placeholder clears the bitmap even if the next frame is cached.
 if(!options.mini||!data||!bounds)draw.thumbnailCache?.delete(canvas);
 const source={data,bounds,options};
 const redraw=()=>draw(canvas,source.data,source.bounds,source.options);
 const solid=window.SolidView?.prepare(canvas,data,bounds,options,redraw);
 if(solid?.solid){window.SectionViewport?.attach(canvas,()=>draw(canvas,data,bounds,options),selected?.id||'');SolidView.render(canvas,solid.solid,materialStyle);return;}
 if(solid){data=solid.data;bounds=solid.bounds;options={...options,axisLabels:solid.labels};if(solid.state.axis!=='Y'){options.maskPreview=null;if(options.reference)options.reference=SolidView.section(options.reference,source.bounds,solid.state.axis,solid.position,solid.state.depth).data;}}
 if(options.mini&&!canvas.getClientRects().length)return;
 const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(rect.width,80),h=Math.max(rect.height,50);
 if(options.mini&&data&&bounds){
  const cache=draw.thumbnailCache||(draw.thumbnailCache=new WeakMap()),key=[w,h,dpr,...bounds,options.doping,options.dopingField].join('|'),old=cache.get(canvas);
  if(old?.data===data&&old.key===key)return;
  cache.set(canvas,{data,key});
 }
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');c.scale(dpr,dpr);c.fillStyle='#ffffff';c.fillRect(0,0,w,h);
 if(!data||!bounds){c.fillStyle='#536981';c.font='12px ProcessSans, Segoe UI';c.textAlign='center';c.fillText('조건을 선택하고 실행해 주세요',w/2,h/2);return}
 if(!options.mini&&!options.fitted&&window.SectionViewport)bounds=SectionViewport.fit(data,bounds,options.reference);
 const overlay=PhotoPreview.build(options.maskPreview||data.photoMask||data.exposure,bounds,data);
 if(overlay)bounds=[bounds[0],bounds[1],bounds[2],Math.max(bounds[3],overlay.top)];
 const axisUnit=options.unit||selected?.unit||current?.unit||'µm',axisField={unit:axisUnit};
 const mini=!!options.mini,margin=mini?6:36,top=mini?7:25,bottom=mini?6:42;
 const extra=options.extrude&&!mini?Math.min(70,w*.12,Math.max(0,(h-top-bottom)*.2)):0;
 const camera=!mini&&window.SectionViewport?SectionViewport.attach(canvas,redraw,selected?.id||''):{zoom:1,x:0,y:0};
 const scale=camera.zoom*Math.min((w-margin*2-extra)/(bounds[1]-bounds[0]),(h-top-bottom-extra)/(bounds[3]-bounds[2]));
 const centerX=(bounds[0]+bounds[1])/2,centerY=(bounds[2]+bounds[3])/2;
 const px=x=>w/2-extra/2+(x-centerX)*scale+camera.x,py=y=>(h+top-bottom)/2+extra/2-(y-centerY)*scale+camera.y;
 if(!mini){
  c.strokeStyle='#edf0f5';c.lineWidth=.7;c.fillStyle='#526b84';c.font='10px ProcessSans, Segoe UI';
  const step=Math.pow(10,Math.floor(Math.log10((bounds[1]-bounds[0])/4)))*((bounds[1]-bounds[0])/Math.pow(10,Math.floor(Math.log10((bounds[1]-bounds[0])/4)))/4>5?5:1);
  const raw=(bounds[1]-bounds[0])/5,pow=Math.pow(10,Math.floor(Math.log10(raw))),gridStep=Math.ceil(raw/pow)*pow;
  for(let x=Math.ceil(bounds[0]/gridStep)*gridStep;x<=bounds[1];x+=gridStep){const xp=px(x);c.beginPath();c.moveTo(xp,top);c.lineTo(xp,h-bottom);c.stroke();c.textAlign='center';c.fillText(ProcessUI.displayValue(axisField,Number(x.toFixed(6))),xp,h-bottom+17)}
  for(let y=Math.ceil(bounds[2]/gridStep)*gridStep;y<=bounds[3];y+=gridStep){const yp=py(y);if(yp<top||yp>h-bottom)continue;c.beginPath();c.moveTo(margin-7,yp);c.lineTo(w-margin+7,yp);c.stroke();c.textAlign='right';c.fillText(ProcessUI.displayValue(axisField,Number(y.toFixed(6))),margin-13,yp+3)}
  c.fillStyle='#526b84';c.textAlign='right';c.fillText(`${options.axisLabels?.[0]||'x'} (${ProcessUI.displayUnit(axisUnit)})`,w-margin+8,h-5);
  c.textAlign='left';c.fillText(`${options.axisLabels?.[1]||'y'} (${ProcessUI.displayUnit(axisUnit)})`,12,top-10);
 }
 c.save();c.beginPath();c.rect(mini?0:margin-7,mini?0:top,w-(mini?0:(margin-7)*2),h-(mini?0:top+bottom));c.clip();
 const grouped=new Map();for(const original of data.polygons){const poly=window.ProcessExtrusion?.clipPolygon?{...original,points:ProcessExtrusion.clipPolygon(original.points,bounds)}:original;if(poly.points.length<3)continue;if(!grouped.has(poly.material))grouped.set(poly.material,[]);grouped.get(poly.material).push(poly)}
 if(extra&&window.ProcessExtrusion){window.ProcessExtrusion.draw(c,grouped,px,py,w,h,extra,id=>materialStyle(id).color)}
 else if(extra){
  function inside(point,polys){let hit=false;for(const poly of polys){const pts=poly.points;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit}}return hit}
  const occupied=point=>[...grouped.values()].some(polys=>inside(point,polys));
  // Draw the back section, then only exposed top/right surfaces. Internal
  // material interfaces must not become opaque walls covering the channels.
  for(const [id,polys] of grouped){c.fillStyle=shade(materialStyle(id).color,.82);c.beginPath();for(const poly of polys){poly.points.forEach((p,i)=>i?c.lineTo(px(p[0])+extra,py(p[1])-extra):c.moveTo(px(p[0])+extra,py(p[1])-extra));c.closePath()}c.fill('evenodd')}
  const epsilon=(bounds[1]-bounds[0])*1e-6,faces=[];
  for(const [id,polys] of grouped){for(const poly of polys){for(let i=0;i<poly.points.length-1;i++){
   const a=poly.points[i],b=poly.points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<epsilon)continue;
   const nx=-dy/len,ny=dx/len,mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
   const plus=occupied([mx+nx*epsilon,my+ny*epsilon]),minus=occupied([mx-nx*epsilon,my-ny*epsilon]);if(plus===minus)continue;
   const sign=plus?-1:1;if(sign*(nx+ny)<=0)continue;
   faces.push({id,a,b,light:sign*ny>0?.88:.64,depth:mx+my});
  }}}
  // Painter order follows the viewing direction, not arbitrary material IDs.
  // Otherwise buried high-ID gates paint over the low-ID top metal surface.
  faces.sort((a,b)=>a.depth-b.depth);
  for(const {id,a,b,light} of faces){c.fillStyle=shade(materialStyle(id).color,light);c.beginPath();c.moveTo(px(a[0]),py(a[1]));c.lineTo(px(b[0]),py(b[1]));c.lineTo(px(b[0])+extra,py(b[1])-extra);c.lineTo(px(a[0])+extra,py(a[1])-extra);c.closePath();c.fill();}
 }

 for(const [id,polys] of grouped){const color=materialStyle(id).color;c.fillStyle=color;c.strokeStyle=shade(color,.74);c.lineWidth=mini?.45:.8;c.lineJoin='round';c.beginPath();for(const poly of polys){poly.points.forEach((p,i)=>i?c.lineTo(px(p[0]),py(p[1])):c.moveTo(px(p[0]),py(p[1])));if(poly.closed)c.closePath()}c.fill('evenodd');c.stroke();}

 if(options.doping&&data.concentration){
  const silicon=[...(grouped.get(10)||[]),...(grouped.get(13)||[])];
  // The same concentration raster and material base colors feed both 2D and 3D.
  for(const id of [10,13]){const polys=grouped.get(id)||[];if(!polys.length)continue;
   c.save();c.beginPath();for(const poly of polys){poly.points.forEach((p,i)=>i?c.lineTo(px(p[0]),py(p[1])):c.moveTo(px(p[0]),py(p[1])));c.closePath()}c.clip('evenodd');
   const texture=DopantView.texture(data,bounds,materialStyle(id).color,options.dopingField);c.imageSmoothingEnabled=true;
   c.drawImage(texture,px(bounds[0]),py(bounds[3]),(bounds[1]-bounds[0])*scale,(bounds[3]-bounds[2])*scale);c.restore();
  }
  for(const poly of silicon){c.beginPath();poly.points.forEach((p,i)=>i?c.lineTo(px(p[0]),py(p[1])):c.moveTo(px(p[0]),py(p[1])));c.closePath();c.strokeStyle='#718096';c.lineWidth=mini?.4:.8;c.stroke()}
 }
 if(data.metrics?.development){
  const dev=data.metrics.development,pr=grouped.get(0)||[];c.save();c.beginPath();for(const poly of pr){poly.points.forEach((p,i)=>i?c.lineTo(px(p[0]),py(p[1])):c.moveTo(px(p[0]),py(p[1])));c.closePath()}c.clip('evenodd');c.fillStyle=`rgba(190,137,221,${.18+.32*dev.fraction})`;for(const [a,b] of dev.intervals)c.fillRect(px(a),py(bounds[3]),(b-a)*scale,(bounds[3]-bounds[2])*scale);c.restore();
 }
 PhotoPreview.paint(c,overlay,px,py,extra,mini);
 if(!mini)window.SolidView?.overlay(canvas,c,px,py);
 // Reference contours are drawn once on the front 2D plane, never extruded.
 if(options.reference){c.strokeStyle='#a85b00';c.lineWidth=1.4;c.setLineDash([5,4]);for(const poly of options.reference.polygons){c.beginPath();poly.points.forEach((p,i)=>i?c.lineTo(px(p[0]),py(p[1])):c.moveTo(px(p[0]),py(p[1])));c.stroke()}c.setLineDash([]);}
 c.restore();
 if(window.ParameterPreview?.active(canvas.id)){c.fillStyle='#315bd6';c.font='600 11px ProcessSans, sans-serif';c.fillText('미리보기',50,17)}
}
function drawMain(){
 renderSectionViews();
 const data=window.ParameterPreview?.frame('section',current?.frames[frame])||current?.frames[frame],hasDoping=!!data?.concentration,field=dopingFieldFor(data);
 $('doping-tools').hidden=true;
 const saved=references.get(ProcessUI.referenceKey(selected?.id,current?.params)),reference=$('compare').checked&&saved?.params?.section===current?.params?.section?saved:null;
 draw($('section'),data,current?combinedBounds(current,reference):null,{maskPreview:window.simulationEditor?.maskPreview(),extrude:mode==='2.5d',reference:reference?refFrame():null,doping:$('show-doping').checked,dopingField:field});
}
// Reveal only within the horizontal timeline; never move the document viewport.
function revealFrame(){const holder=$('timeline'),card=holder.querySelector('.frame-card.selected');if(!card)return;const a=holder.getBoundingClientRect(),b=card.getBoundingClientRect();if(b.left<a.left)holder.scrollLeft+=b.left-a.left;else if(b.right>a.right)holder.scrollLeft+=b.right-a.right;}

function updateFrame(){if(!current)return;const f=current.frames[frame];$('legend').innerHTML=[...new Set(f.polygons.map(p=>p.material))].map(id=>{const m=materialStyle(id);return `<span class="legend-item" data-material="${id}"><i style="background:${m.color}"></i>${m.name}</span>`}).join('');$('legend').insertAdjacentHTML('beforeend',DopantView.legend(f));$('frame-label').textContent=ProcessUI.text(f.label);$('step-count').textContent=`${String(frame+1).padStart(2,'0')} / ${String(current.frames.length).padStart(2,'0')}`;$('metric-low').innerHTML=`${ProcessUI.displayValue(current,f.lowest).toFixed(1)}<em>${ProcessUI.displayUnit(current.unit)}</em>`;$('metric-high').innerHTML=`${ProcessUI.displayValue(current,f.highest).toFixed(1)}<em>${ProcessUI.displayUnit(current.unit)}</em>`;document.querySelectorAll('.frame-card').forEach((el,i)=>{el.classList.toggle('selected',i===frame);el.setAttribute('aria-pressed',String(i===frame))});drawMain();window.simulationEditor?.result();}
function updateAll(){if(!current)return;window.simulationEditor?.result();$('download-image').disabled=false;$('export-json').disabled=false;$('play').disabled=false;$('pin-reference').disabled=false;$('metric-frames').innerHTML=`${current.frames.length}<em>단계</em>`;$('metric-time').innerHTML=`${current.elapsed.toFixed(2)}<em>s</em>`;
 window.FlowWorkspace?.park('observation');
 $('timeline').innerHTML=current.frames.map((f,i)=>`<button class="frame-card" data-frame="${i}" aria-label="${i+1}단계 ${i===0?'Wafer':ProcessUI.text(f.label)}" aria-pressed="false"><canvas aria-hidden="true"></canvas><span class="frame-index">${String(i+1).padStart(2,'0')}</span><span class="frame-name">${i===0?'Wafer':ProcessUI.text(f.label)}</span></button>`).join('');
 document.querySelectorAll('.frame-card').forEach((el,i)=>{draw(el.querySelector('canvas'),current.frames[i],current.bounds,{mini:true,doping:true,dopingField:'net_total'});el.addEventListener('click',()=>{stop();frame=i;updateFrame();window.simulationEditor?.selectFrame(i)})});
 const change=current.frames.at(-1).lowest-current.frames[0].lowest;$('insight-title').textContent='실행 결과에서 무엇이 달라졌나요?';$('insight').textContent=`초기 구조와 비교해 표면 최저점이 ${Math.abs(ProcessUI.displayValue(current,change)).toFixed(1)} ${ProcessUI.displayUnit(current.unit)} ${change>=0?'상승':'하강'}했습니다. ${current.example==='regrowth'?'이 예제는 측방 변화가 중요하므로 적층 사이의 경계도 확인하세요.':'한 가지 조건만 바꾸고 기준 단면과 겹쳐 비교해 보세요.'}`;
 $('reference-status').textContent='예제별 기준 결과 저장됨';$('phase-note').textContent=selected.mode==='geometry'?'공정 순서별 상태입니다. 시간 간격은 균일하지 않습니다.':selected.mode==='mask'?'GDS 원본 → 블러·임계값 적용':'시간 간격으로 저장한 계산 상태입니다.';
 if(selected.group==='소자'){$('insight-title').textContent=selected.description||'소자 단면';$('insight').textContent=ProcessUI.displayText(selected.note);}
 if(selected.id==='gds'){$('insight-title').textContent='마스크 평면의 패턴 경계를 비교하세요';$('insight').textContent='블러 길이는 nm 단위로 입력하며 내부 격자로 환산됩니다. 이것은 GDS layer 0의 기하 변환이며 공정 진행 시간이나 식각 깊이가 아닙니다.';}
 updateFrame();
}
function download(blob,name){const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
$('condition-form').addEventListener('submit',e=>{e.preventDefault();run()});
$('reset').addEventListener('click',()=>{selected.fields.forEach(f=>{$('number-'+f.key).value=f.options?f.default:shortNumber(ProcessUI.displayValue(f,f.default));if($('range-'+f.key))$('range-'+f.key).value=ProcessUI.displayValue(f,f.default)});fieldVisibility();dirty();status('초기 조건으로 바꿨습니다. 실행하면 결과를 갱신합니다.')});
$('show-doping').addEventListener('change',drawMain);
$('compare').addEventListener('change',()=>{drawMain();$('reference-status').textContent=$('compare').checked?'주황 점선: 기준의 같은 진행률':'예제별 기준 결과 저장됨'});
$('pin-reference').addEventListener('click',()=>{references.set(ProcessUI.referenceKey(selected.id,current.params),current);drawMain();toast('현재 결과를 비교 기준으로 저장했습니다.')});
for(const [id,next] of [['view2d','2d'],['view25d','2.5d']])$(id).addEventListener('click',()=>{mode=next;$('view2d').classList.toggle('active',next==='2d');$('view25d').classList.toggle('active',next==='2.5d');$('view2d').setAttribute('aria-pressed',String(next==='2d'));$('view25d').setAttribute('aria-pressed',String(next==='2.5d'));$('view-note').textContent=viewNote();drawMain()});
$('play').addEventListener('click',()=>{if(timer){stop();return}if(!current)return;if(frame>=current.frames.length-1)frame=0;updateFrame();$('play').textContent='Ⅱ 일시정지';timer=setInterval(()=>{if(frame>=current.frames.length-1){stop();return}frame++;updateFrame();revealFrame()},850)});
$('download-image').addEventListener('click',()=>{$('section').toBlob(blob=>{if(blob)download(blob,`ProcessTrace-${selected.id}-step-${frame+1}.png`)});});
$('export-json').addEventListener('click',()=>{if(window.reverseLab?.active){window.reverseLab.save();return}if(current)download(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}),`ProcessTrace-${selected.id}.json`)});
new ResizeObserver(()=>{drawMain();if(current)document.querySelectorAll('.frame-card').forEach((el,i)=>draw(el.querySelector('canvas'),current.frames[i],current.bounds,{mini:true,doping:true,dopingField:'net_total'}))}).observe($('section').parentElement);
(async()=>{try{const info=await request('/api/catalog');catalog=info.examples;$('example-total').textContent=catalog.length;$('library-count').textContent=catalog.length;$('engine').innerHTML=info.engine;const requested=location.hash.slice(1);await select(catalog.some(s=>s.id===requested)?requested:'mosfet')}catch(e){$('loading').hidden=true;status('서버에 연결하지 못했습니다. 시작 파일을 실행해 주세요.',true);toast(e.message)}})();

window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(!busy&&id!==selected?.id&&catalog.some(s=>s.id===id))select(id)});

$('library-toggle').onclick=()=>{const collapsed=document.body.classList.toggle('library-collapsed');$('library-toggle').setAttribute('aria-expanded',String(!collapsed));$('library-toggle').setAttribute('aria-label',collapsed?'예제 목록 펼치기':'예제 목록 접기');};

if(window.matchMedia('(max-width:650px)').matches)$('library-toggle').click();

document.fonts?.ready.then(()=>{if(current)drawMain();window.reverseLab?.redraw();});
