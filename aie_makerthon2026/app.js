'use strict';
const $ = id => document.getElementById(id);
const materials = {0:{name:'Mask',color:'#8191aa'},1:{name:'Polymer',color:'#f0b76c'},4:{name:'ILD',color:'#607d9b'},5:{name:'Metal contact',color:'#f2b56a'},10:{name:'Si',color:'#3e83d3'},11:{name:'Poly-Si gate',color:'#dc8dba'},13:{name:'SiGe',color:'#bb8dff'},16:{name:'Si₃N₄',color:'#9c9aec'},30:{name:'SiO₂',color:'#62ded3'},32:{name:'HfO₂',color:'#f4d66c'},79:{name:'TiN gate',color:'#d78ed7'}};
const icons={trench:'▥',sf6:'↧',wet:'◈',epi:'▰',regrowth:'▤',fin:'♧',bosch:'≋',gds:'▦',locos:'◒',mosfet:'▣',finfet:'⋒'};
const tips={trench:'부착 확률이 높으면 입구 근처에서 입자가 먼저 소모될 수 있어요. 바닥과 입구를 함께 살펴보세요.',sf6:'산소 플럭스만 먼저 바꿔 보세요. 같은 시간에서 측벽 보호와 식각 진행의 균형을 비교할 수 있어요.',wet:'결정면의 식각 속도 차이는 단면의 경사로 나타나요. (111) 상대 속도를 바꿔 관찰하세요.',epi:'(111)/(100) 속도비를 바꾸면 성장하는 면의 형상이 달라져요. 같은 시간의 결과를 비교하세요.',regrowth:'재증착 계수를 0으로 둔 결과와 비교해 보세요. 층 사이의 측방 식각과 부산물의 영향을 살펴봅니다.',fin:'온도를 올리고 같은 시간으로 계산해 보세요. 얇은 산화막 변화는 2D 보기가 더 읽기 쉬워요.'};
Object.assign(tips,{bosch:'보호막 → 바닥 개방 → 식각의 반복을 재생하세요. 회당 시간과 반복 횟수를 따로 바꿔 측벽을 비교할 수 있습니다.',gds:'단면이 아닌 마스크 평면도입니다. 원본에 블러를 적용했을 때 모서리와 선폭이 어떻게 달라지는지 비교하세요.',locos:'질화막 끝 주변의 산화막을 초기 상태와 비교하세요. 얇은 경계 변화는 현재 격자의 해상도에 제한됩니다.',mosfet:'게이트 길이와 스페이서 두께를 바꿔 접촉 개구와의 간격을 관찰하세요. 도핑과 전기 특성은 계산에 포함되지 않습니다.',finfet:'게이트 중앙의 횡단면입니다. STI 위로 드러난 fin의 상부와 두 측벽을 high-k·게이트가 감싸는지 관찰하세요. S/D는 이 단면 밖에 있습니다.'});
function representation(){const m=selected?.mode;return m==='geometry'?'ViennaPS · 기하 공정 모델':m==='mask'?'ViennaPS · GDS 마스크 변환':'ViennaPS · 공정 물리 모델'}
function viewNote(){return mode==='2.5d'?'2D 단면의 표시용 깊이 · 3D 계산 아님':selected?.mode==='geometry'?'기하 공정 결과 · 도핑·전기 특성 미포함':selected?.mode==='mask'?'GDS 평면도 · 노광 블러 근사':'실제 계산된 재료 경계'}
let catalog=[],selected=null,current=null,frame=0,busy=false,mode='2d',timer=null,toastTimer=null;
const references=new Map(),lastResults=new Map();
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500)}
function status(text,error=false){$('run-status').textContent=text;$('run-status').classList.toggle('error',error)}
function stop(){clearInterval(timer);timer=null;$('play').textContent='▶ 과정 재생'}
function setBusy(value){busy=value;stop();document.querySelectorAll('#examples button,#condition-form input,#reset,#run,#timeline button').forEach(e=>e.disabled=value);$('run').innerHTML=value?'<span>◌</span> 계산하고 있어요':'<span>▶</span> 시뮬레이션 실행';$('loading').hidden=!value;for(const id of ['play','pin-reference','export-json','download-image'])$(id).disabled=value||!current;}
function defaults(spec){return Object.fromEntries(spec.fields.map(f=>[f.key,f.default]))}
function values(){return Object.fromEntries(selected.fields.map(f=>[f.key,Number($('number-'+f.key).value)]))}
function dirty(){const changed=!!current&&JSON.stringify(values())!==JSON.stringify(current.params);$('pending').hidden=!changed;return changed}
function nav(){ $('examples').innerHTML=catalog.map((s,i)=>`${i===0?'<div class="nav-group">기본 공정 · 9</div>':s.id==='mosfet'?'<div class="nav-group">소자 공정 모듈 · 2</div>':''}<button class="nav-item ${s.id===selected.id?'active':''}" data-example="${s.id}" aria-pressed="${s.id===selected.id}" title="${s.title}"><span class="nav-icon">${icons[s.id]}</span><span><span class="nav-name">${s.title}</span><span class="nav-desc">${s.subtitle}</span></span><span class="nav-end">›</span></button>`).join('');document.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.example))); }
async function select(id){if(busy)return;stop();selected=catalog.find(s=>s.id===id);current=lastResults.get(id)||null;nav();$('title').textContent=selected.title;$('subtitle').textContent=selected.subtitle;$('category').textContent=selected.group;$('description').textContent=selected.description;$('hint').textContent=tips[id];$('model-note').textContent=selected.note;$('source').href=selected.source;$('compare').checked=false;
 history.replaceState(null,'','#'+id);$('model-badge').textContent=representation();$('view-note').textContent=viewNote();$('axis-type').textContent=id==='gds'?'MASK · X–Y':id==='finfet'?'GATE CENTER · X–Y':'X–Y';$('provenance').textContent=selected.mode==='geometry'?'◉ ViennaPS 기하 공정 · 치수 기반 형상 계산':selected.mode==='mask'?'◉ 동봉된 GDS layer 0 · 원본과 블러 결과':'◉ 재료 경계는 ViennaPS의 중간 계산 결과입니다.';
 const params=current?current.params:defaults(selected);
 $('fields').innerHTML=selected.fields.map(f=>`<div class="field"><div class="field-top"><label for="number-${f.key}">${f.label}</label><div class="number-wrap"><input id="number-${f.key}" type="number" min="${f.min}" max="${f.max}" step="${f.step}" value="${params[f.key]}" required><span>${f.unit}</span></div></div><input id="range-${f.key}" aria-label="${f.label} 조절" type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${params[f.key]}"><div class="range-labels"><span>${f.min}</span><span>${f.max}</span></div></div>`).join('');
 selected.fields.forEach(f=>{const n=$('number-'+f.key),r=$('range-'+f.key);r.addEventListener('input',()=>{n.value=r.value;dirty()});n.addEventListener('input',()=>{r.value=n.value;dirty()})});
 $('pending').hidden=true;
 if(current){frame=current.frames.length-1;updateAll();status('마지막 계산 결과를 불러왔습니다.');$('loading').hidden=true;}else{frame=0;$('timeline').innerHTML='<div class="empty-timeline">새 예제의 공정 단계를 계산하고 있습니다.</div>';$('legend').textContent='';$('frame-label').textContent='계산 준비';$('step-count').textContent='0 / 0';for(const id of ['metric-low','metric-high','metric-frames','metric-time'])$(id).textContent='—';$('insight-title').textContent='이번 공정의 관찰 포인트';$('insight').textContent=tips[id];drawMain();await run();}
}
async function request(path,options){const response=await fetch(path,options);const data=await response.json();if(!response.ok)throw Error(data.error||'요청을 처리하지 못했습니다.');return data}
async function run(){if(busy)return;if(!$('condition-form').reportValidity())return;const params=values(),id=selected.id;setBusy(true);let elapsed=0;status('ViennaPS가 중간 단면을 계산하고 있습니다.');const tick=setInterval(()=>status(`계산 중 · ${++elapsed}초 경과`),1000);
 try{const job=await request('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({example:id,params})});let result;
  for(let i=0;i<160;i++){const info=await request('/api/jobs/'+job.job);if(info.state==='error')throw Error(info.error);if(info.state==='done'){result=info.result;break;}await new Promise(r=>setTimeout(r,600));}
  if(!result)throw Error('계산 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
  current=result;lastResults.set(id,result);if(!references.has(id))references.set(id,result);frame=result.frames.length-1;clearInterval(tick);setBusy(false);updateAll();status(result.cached?'동일 조건의 계산 결과를 불러왔습니다.':`계산 완료 · ${result.elapsed.toFixed(2)}초`);$('pending').hidden=true;
 }catch(e){clearInterval(tick);setBusy(false);status(e.message,true);toast(e.message);if(current)updateAll();}
}
function combinedBounds(result,reference){if(!reference)return result.bounds;return [Math.min(result.bounds[0],reference.bounds[0]),Math.max(result.bounds[1],reference.bounds[1]),Math.min(result.bounds[2],reference.bounds[2]),Math.max(result.bounds[3],reference.bounds[3])]}
function refFrame(){const ref=references.get(selected.id);if(!ref||!current)return null;const progress=current.frames[frame].progress;return ref.frames.reduce((best,f)=>Math.abs(f.progress-progress)<Math.abs(best.progress-progress)?f:best,ref.frames[0]);}
function draw(canvas,data,bounds,options={}){
 const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(rect.width,80),h=Math.max(rect.height,50);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');c.scale(dpr,dpr);c.fillStyle='#f8fafc';c.fillRect(0,0,w,h);
 if(!data||!bounds){c.fillStyle='#536981';c.font='12px Segoe UI';c.textAlign='center';c.fillText('조건을 선택하고 실행해 주세요',w/2,h/2);return}
 const mini=!!options.mini,margin=mini?6:43,top=mini?7:39,bottom=mini?6:35;
 const extra=options.extrude&&!mini?28:0;
 const scale=Math.min((w-margin*2-extra)/(bounds[1]-bounds[0]),(h-top-bottom-extra)/(bounds[3]-bounds[2]));
 const centerX=(bounds[0]+bounds[1])/2,centerY=(bounds[2]+bounds[3])/2;
 const px=x=>w/2-extra/2+(x-centerX)*scale,py=y=>(h+top-bottom)/2+extra/2-(y-centerY)*scale;
 if(!mini){
  c.strokeStyle='#dce5ef';c.lineWidth=.7;c.fillStyle='#526b84';c.font='9px Segoe UI';
  const step=Math.pow(10,Math.floor(Math.log10((bounds[1]-bounds[0])/4)))*((bounds[1]-bounds[0])/Math.pow(10,Math.floor(Math.log10((bounds[1]-bounds[0])/4)))/4>5?5:1);
  const raw=(bounds[1]-bounds[0])/5,pow=Math.pow(10,Math.floor(Math.log10(raw))),gridStep=Math.ceil(raw/pow)*pow;
  for(let x=Math.ceil(bounds[0]/gridStep)*gridStep;x<=bounds[1];x+=gridStep){const xp=px(x);c.beginPath();c.moveTo(xp,top);c.lineTo(xp,h-bottom);c.stroke();c.textAlign='center';c.fillText(Number(x.toFixed(3)),xp,h-bottom+17)}
  for(let y=Math.ceil(bounds[2]/gridStep)*gridStep;y<=bounds[3];y+=gridStep){const yp=py(y);if(yp<top||yp>h-bottom)continue;c.beginPath();c.moveTo(margin-7,yp);c.lineTo(w-margin+7,yp);c.stroke();c.textAlign='right';c.fillText(Number(y.toFixed(3)),margin-13,yp+3)}
  c.fillStyle='#526b84';c.textAlign='right';c.fillText(`x (${current?current.unit:'µm'})`,w-margin+8,h-9);
  c.textAlign='left';c.fillText(`y (${current?current.unit:'µm'})`,12,top-10);
 }
 c.save();c.beginPath();c.rect(mini?0:margin-7,mini?0:top,w-(mini?0:(margin-7)*2),h-(mini?0:top+bottom));c.clip();
 const grouped=new Map();for(const poly of data.polygons){if(!grouped.has(poly.material))grouped.set(poly.material,[]);grouped.get(poly.material).push(poly)}
 if(extra){for(const [id,polys] of grouped){const color=(materials[id]||{color:'#a0b0c0'}).color;c.globalAlpha=.45;c.fillStyle=color;c.strokeStyle=color;for(const poly of polys){for(let i=0;i<poly.points.length-1;i++){const a=poly.points[i],b=poly.points[i+1];c.beginPath();c.moveTo(px(a[0]),py(a[1]));c.lineTo(px(b[0]),py(b[1]));c.lineTo(px(b[0])+extra,py(b[1])-extra);c.lineTo(px(a[0])+extra,py(a[1])-extra);c.closePath();c.fill()}c.beginPath();poly.points.forEach((p,i)=>i?c.lineTo(px(p[0])+extra,py(p[1])-extra):c.moveTo(px(p[0])+extra,py(p[1])-extra));c.stroke()}}c.globalAlpha=1;}
 for(const [id,polys] of grouped){const color=(materials[id]||{color:'#a0b0c0'}).color;c.fillStyle=color;c.strokeStyle=color;c.lineWidth=mini?.65:1.15;c.beginPath();for(const poly of polys){poly.points.forEach((p,i)=>i?c.lineTo(px(p[0]),py(p[1])):c.moveTo(px(p[0]),py(p[1])));if(poly.closed)c.closePath()}c.fill('evenodd');c.stroke();}
 if(options.reference){c.strokeStyle='#a85b00';c.lineWidth=1.4;c.setLineDash([5,4]);for(const poly of options.reference.polygons){c.beginPath();poly.points.forEach((p,i)=>i?c.lineTo(px(p[0]),py(p[1])):c.moveTo(px(p[0]),py(p[1])));c.stroke()}c.setLineDash([]);}
 c.restore();
}
function drawMain(){const reference=$('compare').checked?references.get(selected?.id):null;draw($('section'),current?.frames[frame],current?combinedBounds(current,reference):null,{extrude:mode==='2.5d',reference:reference?refFrame():null});}
function updateFrame(){if(!current)return;const f=current.frames[frame];$('frame-label').textContent=f.label;$('step-count').textContent=`${String(frame+1).padStart(2,'0')} / ${String(current.frames.length).padStart(2,'0')}`;$('metric-low').innerHTML=`${f.lowest.toFixed(current.unit==='nm'?1:3)}<em>${current.unit}</em>`;$('metric-high').innerHTML=`${f.highest.toFixed(current.unit==='nm'?1:3)}<em>${current.unit}</em>`;document.querySelectorAll('.frame-card').forEach((el,i)=>{el.classList.toggle('selected',i===frame);el.setAttribute('aria-pressed',String(i===frame))});drawMain();}
function updateAll(){if(!current)return;$('download-image').disabled=false;$('export-json').disabled=false;$('play').disabled=false;$('pin-reference').disabled=false;$('metric-frames').innerHTML=`${current.frames.length}<em>단계</em>`;$('metric-time').innerHTML=`${current.elapsed.toFixed(2)}<em>s</em>`;
 const ids=[...new Set(current.frames.flatMap(f=>f.polygons.map(p=>p.material)))];$('legend').innerHTML=ids.map(id=>{const m=materials[id]||{name:'Material '+id,color:'#a0b0c0'};return `<span class="legend-item"><i style="background:${m.color}"></i>${m.name}</span>`}).join('');
 $('timeline').innerHTML=current.frames.map((f,i)=>`<button class="frame-card" data-frame="${i}" aria-label="${i+1}단계 ${f.label}" aria-pressed="false"><canvas aria-hidden="true"></canvas><span class="frame-index">${String(i+1).padStart(2,'0')}</span><span class="frame-name">${f.label}</span></button>`).join('');
 document.querySelectorAll('.frame-card').forEach((el,i)=>{draw(el.querySelector('canvas'),current.frames[i],current.bounds,{mini:true});el.addEventListener('click',()=>{stop();frame=i;updateFrame()})});
 const change=current.frames.at(-1).lowest-current.frames[0].lowest;$('insight-title').textContent='실행 결과에서 무엇이 달라졌나요?';$('insight').textContent=`초기 구조와 비교해 표면 최저점이 ${Math.abs(change).toFixed(current.unit==='nm'?2:3)} ${current.unit} ${change>=0?'상승':'하강'}했습니다. ${current.example==='regrowth'?'이 예제는 측방 변화가 중요하므로 적층 사이의 경계도 확인하세요.':'한 가지 조건만 바꾸고 기준 단면과 겹쳐 비교해 보세요.'}`;
 $('reference-status').textContent='예제별 기준 결과 저장됨';$('phase-note').textContent=selected.mode==='geometry'?'공정 순서별 상태입니다. 시간 간격은 균일하지 않습니다.':selected.mode==='mask'?'GDS 원본 → 블러·임계값 적용':'시간 간격으로 저장한 계산 상태입니다.';
 if(selected.group==='DEVICE'){$('insight-title').textContent=selected.id==='finfet'?'게이트 중심 횡단면 · S/D는 화면 밖에 위치':'게이트·스페이서·접촉 형상 · 도핑은 생략';$('insight').textContent=selected.note;}
 if(selected.id==='gds'){$('insight-title').textContent='마스크 평면의 패턴 경계를 비교하세요';$('insight').textContent='블러 길이는 µm 단위로 입력하며 내부 격자로 환산됩니다. 이것은 GDS layer 0의 기하 변환이며 공정 진행 시간이나 식각 깊이가 아닙니다.';}
 updateFrame();
}
function download(blob,name){const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
$('condition-form').addEventListener('submit',e=>{e.preventDefault();run()});
$('reset').addEventListener('click',()=>{selected.fields.forEach(f=>{$('number-'+f.key).value=f.default;$('range-'+f.key).value=f.default});dirty();status('기본 조건으로 바꿨습니다. 실행하면 결과를 갱신합니다.')});
$('compare').addEventListener('change',()=>{drawMain();$('reference-status').textContent=$('compare').checked?'주황 점선: 기준의 같은 진행률':'예제별 기준 결과 저장됨'});
$('pin-reference').addEventListener('click',()=>{references.set(selected.id,current);drawMain();toast('현재 결과를 비교 기준으로 저장했습니다.')});
for(const [id,next] of [['view2d','2d'],['view25d','2.5d']])$(id).addEventListener('click',()=>{mode=next;$('view2d').classList.toggle('active',next==='2d');$('view25d').classList.toggle('active',next==='2.5d');$('view2d').setAttribute('aria-pressed',String(next==='2d'));$('view25d').setAttribute('aria-pressed',String(next==='2.5d'));$('view-note').textContent=viewNote();drawMain()});
$('play').addEventListener('click',()=>{if(timer){stop();return}if(!current)return;if(frame>=current.frames.length-1)frame=0;updateFrame();$('play').textContent='Ⅱ 일시정지';timer=setInterval(()=>{if(frame>=current.frames.length-1){stop();return}frame++;updateFrame();document.querySelector('.frame-card.selected')?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'})},850)});
$('download-image').addEventListener('click',()=>{$('section').toBlob(blob=>{if(blob)download(blob,`simulation-${selected.id}-step-${frame+1}.png`)});});
$('export-json').addEventListener('click',()=>{if(current)download(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}),`simulation-${selected.id}.json`)});
$('help').addEventListener('click',()=>$('guide').showModal());$('close-help').addEventListener('click',()=>$('guide').close());$('guide').addEventListener('click',e=>{if(e.target===$('guide'))$('guide').close()});
new ResizeObserver(()=>{drawMain();if(current)document.querySelectorAll('.frame-card').forEach((el,i)=>draw(el.querySelector('canvas'),current.frames[i],current.bounds,{mini:true}))}).observe($('section').parentElement);
(async()=>{try{const info=await request('/api/catalog');catalog=info.examples;$('library-count').textContent=catalog.length;$('engine').innerHTML=info.engine+'<small>CPU · 2D 시뮬레이션</small>';const requested=location.hash.slice(1);await select(catalog.some(s=>s.id===requested)?requested:'trench')}catch(e){$('loading').hidden=true;status('서버에 연결하지 못했습니다. 시작 파일을 실행해 주세요.',true);toast(e.message)}})();
