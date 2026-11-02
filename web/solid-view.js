'use strict';
// A finite extrusion of the calculated material cross-section. No invented 3D solver.
(function(root){
 const states=new Map(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function intervals(polys,axis,at){const hits=[];for(const p of polys){const q=p.points;for(let i=0,j=q.length-1;i<q.length;j=i++){const a=q[j],b=q[i];if((a[axis]>at)!==(b[axis]>at))hits.push(a[1-axis]+(at-a[axis])*(b[1-axis]-a[1-axis])/(b[axis]-a[axis]));}}hits.sort((a,b)=>a-b);const out=[];for(let i=0;i+1<hits.length;i+=2)if(hits[i+1]-hits[i]>1e-8)out.push([hits[i],hits[i+1]]);return out;}
 function groups(data){const g=new Map();for(const p of data.polygons||[]){if(!g.has(p.material))g.set(p.material,[]);g.get(p.material).push(p)}return g;}
 function section(data,bounds,axis,position,depth,withDoping=true){
  if(axis==='Y')return {data,bounds,labels:['X','Z']};
  const polygons=[];for(const [material,ps] of groups(data))for(const [a,b] of intervals(ps,axis==='X'?0:1,position)){
   const points=axis==='X'?[[-depth/2,a],[depth/2,a],[depth/2,b],[-depth/2,b]]:[[a,-depth/2],[b,-depth/2],[b,depth/2],[a,depth/2]];polygons.push({material,points,closed:true});
  }
  const nextBounds=axis==='X'?[-depth/2,depth/2,bounds[2],bounds[3]]:[bounds[0],bounds[1],-depth/2,depth/2];
  return {data:{...data,polygons,concentration:withDoping?root.DopantView?.slice(data,nextBounds,axis,position,depth)||null:null,photoMask:null,exposure:null,metrics:{}},bounds:nextBounds,labels:axis==='X'?['Y','Z']:['X','Y']};
 }
 function get(id){return states.get(id)}
 // Resolve the saved geometry at the same physical slice as the current device.
 function referenceSection(frame,model,bounds,axis,at,depth){
  if(!frame)return null;
  return model?root.ChannelCutaway.section(model,axis,at,depth,intervals):section(frame,bounds,axis,at,depth,false).data;
 }
 function modelParts(frame,model,bounds,depth){
  if(model)return model.parts.flatMap(p=>SolidGeometry.parts(p.polygons).map(body=>({...body,lo:p.lo,hi:p.hi})));
  const clipped=frame.polygons.map(p=>({...p,points:ProcessExtrusion.clipPolygon(p.points,bounds)})).filter(p=>p.points.length>=3);
  return SolidGeometry.parts(clipped).map(body=>({...body,lo:-depth/2,hi:depth/2}));
 }
 function paintReference(c,s){
  if(!s.reference||s.isMinimap)return;
  const parts=s.referenceBodies,offsets=SolidGeometry.offsets(parts,s.explodeMode,s.exploded?s.explodeGap:0,s.coreId);
  c.save();c.strokeStyle='#a85b00';c.lineWidth=1.25;c.setLineDash([5,4]);
  for(const [i,part] of parts.entries()){
   // Draw the end facing the camera. Rear outlines would obscure the channel.
   const world=(u,v,z)=>s.referenceCore?[v,u,z+offsets[i]]:[u,v,z+offsets[i]];
   const near=s.projectWorld(world(0,part.lo,0))[2]<s.projectWorld(world(0,part.hi,0))[2]?part.lo:part.hi;
   for(const ring of part.polygons){
    c.beginPath();
    ring.points.forEach(([u,z],j)=>{const [x,y]=s.projectWorld(world(u,near,z));if(j)c.lineTo(x,y);else c.moveTo(x,y);});
    c.closePath();c.stroke();
   }
  }
  c.restore();
 }
 function mount(canvas,redraw){
  let s=states.get(canvas.id);if(s){s.redraw=redraw;return s;}
  s={id:canvas.id,axis:'Y',fraction:.5,depth:.8,view:'2d',yaw:-.48,pitch:.46,zoom:1,panX:0,panY:0,exploded:false,explodeMode:'layer',explodeGap:.25,redraw};states.set(canvas.id,s);
  const box=canvas.closest('.viewer,.reverse-view'),bar=document.createElement('div');bar.className='solid-controls';bar.innerHTML='<div class="slice-axis" role="group" aria-label="절단 축">'+['X','Y','Z'].map(a=>`<button type="button" data-axis="${a}" aria-pressed="${a==='Y'}">${a} 단면</button>`).join('')+'</div><input class="slice-position" type="range" min="0" max="1000" value="500" aria-label="절단 위치"><output class="slice-value">0 nm</output><label class="solid-depth">깊이 <input type="number" min="100" max="2000" step="10" value="800" aria-label="3D 확장 깊이 nm"> nm</label><button type="button" class="live-toggle" aria-pressed="false">▷ Live</button><span class="solid-model" title="계산된 2D 단면을 일정 깊이로 확장한 3D 모델">단면 기반 3D</span>';
  const explode=document.createElement('div');explode.className='explode-controls';explode.hidden=true;
  explode.innerHTML='<button type="button" class="explode-toggle" aria-pressed="false">분리 보기</button><div class="explode-options" hidden><select aria-label="분리 기준"><option value="layer">기능별</option><option value="material">재료별</option></select><label>표시 간격 <input type="range" min="60" max="600" step="10" value="250" aria-label="분리 간격 nm"></label><output>250 nm</output><button type="button" class="explode-reset">원래 구조</button></div>';
  const mode=document.createElement('button');mode.type='button';mode.className='channel-toggle';mode.hidden=true;
  mode.title='게이트 절개와 전체 공정 단면 전환 · 절개 높이와 길이는 계산 단면에서 추출하며 폭 방향은 교육용 가정입니다.';
  mode.onclick=()=>{s.fullProcess=!!s.core;s.redraw();};
  bar.append(mode,explode);
  const syncExplode=()=>{explode.querySelector('.explode-toggle').setAttribute('aria-pressed',s.exploded);explode.querySelector('.explode-options').hidden=!s.exploded;s.redraw()};
  explode.querySelector('.explode-toggle').onclick=()=>{s.exploded=!s.exploded;syncExplode()};
  explode.querySelector('select').onchange=e=>{s.explodeMode=e.target.value;s.redraw()};
  explode.querySelector('input').oninput=e=>{s.explodeGap=+e.target.value/1000;explode.querySelector('output').textContent=e.target.value+' nm';s.redraw()};
  explode.querySelector('.explode-reset').onclick=()=>{s.exploded=false;syncExplode()};
  box.querySelector('.panel-heading').after(bar);s.bar=bar;
  s.explodeSummary=document.createElement('div');s.explodeSummary.className='explode-groups';s.explodeSummary.hidden=true;bar.after(s.explodeSummary);
  bar.querySelectorAll('[data-axis]').forEach(b=>b.onclick=()=>{s.axis=b.dataset.axis;s.fraction=.5;bar.querySelector('.slice-position').value=500;bar.querySelectorAll('[data-axis]').forEach(x=>x.setAttribute('aria-pressed',x===b));s.redraw()});
  bar.querySelector('.slice-position').oninput=e=>{s.fraction=+e.target.value/1000;s.redraw()};
  bar.querySelector('.solid-depth input').onchange=e=>{const v=+e.target.value;if(!Number.isFinite(v)||v<100||v>2000){e.target.value=s.depth*1000;return;}s.depth=v/1000;s.redraw()};
  bar.querySelector('.live-toggle').onclick=e=>{s.live=!s.live;e.currentTarget.setAttribute('aria-pressed',s.live);e.currentTarget.textContent=s.live?'Ⅱ Live':'▷ Live';s.start=performance.now();if(s.live)tick();else {cancelAnimationFrame(s.raf);s.redraw()}};
  function tick(){if(!s.live)return;if(canvas.getClientRects().length&&!document.hidden)s.redraw();s.raf=requestAnimationFrame(tick)}
  let drag;
  canvas.addEventListener('pointerdown',e=>{if(s.view!=='3d'||e.button!==0)return;e.stopImmediatePropagation();drag={x:e.clientX,y:e.clientY,shift:e.shiftKey};canvas.setPointerCapture(e.pointerId)},{capture:true});
  canvas.addEventListener('pointermove',e=>{if(!drag||s.view!=='3d')return;e.stopImmediatePropagation();const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.shift){s.panX+=dx;s.panY+=dy}else{s.yaw+=dx*.008;s.pitch=clamp(s.pitch+dy*.008,-1.3,1.3)}drag.x=e.clientX;drag.y=e.clientY;s.redraw()},{capture:true});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null,{capture:true});
  canvas.addEventListener('wheel',e=>{if(s.view!=='3d')return;e.preventDefault();e.stopImmediatePropagation();s.zoom=clamp(s.zoom*Math.exp(-e.deltaY*.0015),.4,8);s.redraw()},{capture:true,passive:false});
  canvas.addEventListener('dblclick',e=>{if(s.view!=='3d')return;e.stopImmediatePropagation();reset(s);s.redraw()},{capture:true});
  canvas.addEventListener('keydown',e=>{if(s.view!=='3d')return;let used=true;if(e.key==='ArrowLeft')s.yaw-=.1;else if(e.key==='ArrowRight')s.yaw+=.1;else if(e.key==='ArrowUp')s.pitch=clamp(s.pitch-.1,-1.3,1.3);else if(e.key==='ArrowDown')s.pitch=clamp(s.pitch+.1,-1.3,1.3);else if(['+','='].includes(e.key))s.zoom=clamp(s.zoom*1.2,.4,8);else if(e.key==='-')s.zoom=clamp(s.zoom/1.2,.4,8);else if(e.key==='0')reset(s);else used=false;if(used){e.preventDefault();e.stopImmediatePropagation();s.redraw()}},{capture:true});
  return s;
 }
 function defaultYaw(s){return s.core&&['finfet','gaafet','mbcfet','cfet'].includes(s.coreId)?-1.02:-.48;}
 function reset(s){s.yaw=defaultYaw(s);s.pitch=.46;s.zoom=1;s.panX=s.panY=0;}
 function position(s,b){return s.axis==='X'?b[0]+s.fraction*(b[1]-b[0]):s.axis==='Z'?b[2]+s.fraction*(Math.max(b[3],s.mask?.top??b[3])-b[2]):(s.fraction-.5)*s.depth;}
 function minimap(canvas,s){
  if(!s.mini){const wrap=document.createElement('div');wrap.className='section-minimap';const mini=document.createElement('canvas');mini.id=canvas.id+'-minimap';mini.tabIndex=0;mini.setAttribute('role','slider');mini.setAttribute('aria-label','3D 미니맵 절단 위치');mini.setAttribute('aria-valuemin','0');mini.setAttribute('aria-valuemax','100');const label=document.createElement('div');wrap.append(mini,label);canvas.parentElement.append(wrap);s.mini={wrap,canvas:mini,label};
   let dragging=false;
   const move=e=>{const m=s.mini.state;if(!m?.projectWorld)return;const b=s.bounds,c=[(b[0]+b[1])/2,0,(b[2]+b[3])/2],lo=[...c],hi=[...c],a=s.axis==='X'?0:s.axis==='Y'?1:2;lo[a]=a===0?b[0]:a===1?-s.depth/2:b[2];hi[a]=a===0?b[1]:a===1?s.depth/2:b[3];const u=m.projectWorld(lo),v=m.projectWorld(hi),r=mini.getBoundingClientRect(),dx=v[0]-u[0],dy=v[1]-u[1];s.fraction=clamp(((e.clientX-r.left-u[0])*dx+(e.clientY-r.top-u[1])*dy)/(dx*dx+dy*dy),0,1);s.bar.querySelector('.slice-position').value=s.fraction*1000;s.redraw();};
   mini.onpointerdown=e=>{e.preventDefault();e.stopPropagation();dragging=true;mini.setPointerCapture(e.pointerId);move(e);};mini.onpointermove=e=>{if(dragging)move(e)};mini.onpointerup=mini.onpointercancel=()=>dragging=false;
   mini.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();s.fraction=e.key==='Home'?0:e.key==='End'?1:clamp(s.fraction+(['ArrowRight','ArrowUp'].includes(e.key)?.02:-.02),0,1);s.bar.querySelector('.slice-position').value=s.fraction*1000;s.redraw();};
  }
  s.mini.wrap.hidden=s.view!=='2d';if(s.mini.wrap.hidden)return;
  const m={...s,id:s.mini.canvas.id,view:'3d',isMinimap:true,miniMapPlane:{axis:s.axis,at:position(s,s.bounds)},live:false,mask:s.mask,mini:null,exploded:false,zoom:.95,panX:0,panY:0,yaw:-.65,pitch:.45,redraw:s.redraw};s.mini.state=m;
  s.mini.label.textContent=s.axis+' 단면 · '+Math.round(position(s,s.bounds)*1000)+' nm';s.mini.canvas.setAttribute('aria-valuenow',String(Math.round(s.fraction*100)));s.mini.canvas.setAttribute('aria-valuetext',s.mini.label.textContent);
  render(s.mini.canvas,m,materialStyle);
 }
 function prepare(canvas,data,bounds,options,redraw){if(!data&&states.get(canvas.id)?.mini)states.get(canvas.id).mini.wrap.hidden=true;if(options.mini||!['section','r-current'].includes(canvas.id)||!data)return null;const s=mount(canvas,redraw);s.view=options.extrude?'3d':'2d';s.data=data;s.bounds=bounds;s.recipe=canvas.id==='section'?window.simulationEditor?.recipe():window.reverseLab?.recipe?.();
  s.doping=options.doping!==false;
  s.mask=PhotoPreview.build(options.maskPreview||data.photoMask||data.exposure,bounds,data);
  const deviceChanged=s.coreId!==options.deviceId;
  if(s.coreSource!==data||s.coreDepth!==s.depth||deviceChanged){
   if(deviceChanged)s.fullProcess=undefined;
   s.coreSource=data;s.coreDepth=s.depth;s.coreId=options.deviceId;
   s.coreModel=window.ChannelCutaway?.build(data,options.deviceId,s.depth,intervals);
  }
  const coreButton=s.bar.querySelector('.channel-toggle'),canShow=!!s.coreModel&&!s.mask&&!s.live;
  coreButton.hidden=!canShow;
  const wasCore=!!s.core;
  s.core=canShow&&(s.fullProcess===undefined?options.finalStep:!s.fullProcess)?s.coreModel:null;
  const reference=options.reference||null,rawRef=options.referenceFrame||reference;
  const refKey=[options.deviceId,s.depth,!!s.core,...bounds].join('|');
  if(s.reference!==reference||s.referenceFrame!==rawRef||s.referenceKey!==refKey){
   s.reference=reference;s.referenceFrame=rawRef;s.referenceKey=refKey;
   s.referenceCore=s.core&&reference?(rawRef===data?s.core:root.ChannelCutaway?.build(rawRef,options.deviceId,s.depth,intervals)):null;
   s.referenceBodies=null;
  }
  if(reference&&s.view==='3d'&&!s.referenceBodies)s.referenceBodies=modelParts(reference,s.referenceCore,bounds,s.depth);
  if(deviceChanged||wasCore!==!!s.core)s.yaw=defaultYaw(s);
  coreButton.textContent=s.core?'전체 공정 보기':'게이트 절개 보기';
  const modelLabel=s.bar.querySelector('.solid-model');
  modelLabel.textContent=s.core?s.core.caption:'단면 기반 3D';
  modelLabel.title=s.core?'계산 단면의 채널·막 두께와 게이트 길이로 재구성한 절개입니다. 폭과 절개 길이는 교육용 가정입니다.':'계산된 2D 단면을 일정 깊이로 확장한 3D 모델';
  if(s.core){bounds=s.core.bounds;s.bounds=bounds;}
  if(s.mask){bounds=[...bounds];bounds[3]=Math.max(bounds[3],s.mask.top);s.bounds=bounds;}
  for(const node of s.bar.querySelectorAll('.slice-axis,.slice-position,.slice-value'))node.hidden=s.view==='3d';
  s.bar.querySelector('.explode-controls').hidden=s.view!=='3d';
  s.explodeSummary.hidden=s.view!=='3d'||!s.exploded;
  const liveButton=s.bar.querySelector('.live-toggle');liveButton.disabled=s.view==='3d'&&s.exploded;
  if(liveButton.disabled&&s.live){s.live=false;cancelAnimationFrame(s.raf);liveButton.setAttribute('aria-pressed','false');liveButton.textContent='▷ Live';}
  const pos=position(s,bounds);s.bar.querySelector('output').textContent=Math.round(pos*1000)+' nm';s.bar.querySelector('.slice-position').disabled=false;s.bar.querySelector('.solid-depth').hidden=s.view!=='3d';modelLabel.hidden=s.view!=='3d'&&!s.core;canvas.title=s.view==='3d'?'드래그: 회전 · Shift+드래그: 이동 · 휠: 확대/축소 · 0: 맞춤':'드래그: 이동 · 휠: 확대/축소';
  minimap(canvas,s);
  if(s.view==='3d')return {solid:s};
  const comparison=referenceSection(reference,s.referenceCore,bounds,s.axis,pos,s.depth);
  if(s.core){
   const cut=ChannelCutaway.section(s.core,s.axis,pos,s.depth,intervals);
   const field=s.axis==='Y'?data.concentration:root.DopantView?.slice(data,cut.bounds,s.axis,pos,s.depth);
   return {...cut,data:{...data,polygons:cut.polygons,concentration:field},reference:comparison,state:s,position:pos,maskSlice:null};
  }
  return {...section(data,bounds,s.axis,pos,s.depth),reference:comparison,state:s,position:pos,maskSlice:PhotoPreview.slice(s.mask,s.axis,pos,s.depth,data)};
 }
 function render(canvas,s,style){
  if(window.SolidGPU?.render(canvas,s,style))return;
  canvas.dataset.renderer='canvas';
  const r=canvas.getBoundingClientRect(),w=Math.max(80,r.width),h=Math.max(80,r.height),dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.fillStyle='#fff';c.fillRect(0,0,w,h);
  const rawBounds=s.bounds,parts=modelParts(s.data,s.core,rawBounds,s.depth),plan=SolidGeometry.layout(parts,s.explodeMode,s.exploded?s.explodeGap:0,s.coreId),offsets=plan.shifts;
  showGroups(s,plan.labels);
  const b=[...rawBounds];b[3]=Math.max(b[3]+Math.max(0,...offsets),!s.exploded&&s.mask?s.mask.top:-Infinity);
  const cx=(b[0]+b[1])/2,cz=(b[2]+b[3])/2,scale=s.zoom*Math.min((w-(s.isMinimap?20:100))/Math.hypot(b[1]-b[0],s.depth),(h-(s.isMinimap?20:85))/Math.hypot(b[3]-b[2],s.depth));
  const transform=([x,y,z])=>{x-=cx;z-=cz;const a=x*Math.cos(s.yaw)-y*Math.sin(s.yaw),d=x*Math.sin(s.yaw)+y*Math.cos(s.yaw);return [w/2+a*scale+s.panX,h/2-(z*Math.cos(s.pitch)-d*Math.sin(s.pitch))*scale+s.panY,d*Math.cos(s.pitch)+z*Math.sin(s.pitch)]};
  s.project=transform;s.projectWorld=transform;
  const faces=[];
  for(let partIndex=0;partIndex<parts.length;partIndex++){
   const id=parts[partIndex].material,polys=parts[partIndex].polygons.map(p=>({...p,points:p.points.map(([x,z])=>[x,z+offsets[partIndex]])}));
   const part=parts[partIndex],lo=s.core?part.lo:-s.depth/2,hi=s.core?part.hi:s.depth/2;
   const point=(u,v,z)=>transform(s.core?[v,u,z]:[u,v,z]);
   for(const y of [lo,hi]){const paths=polys.map(p=>p.points.map(([x,z])=>point(x,y,z)));faces.push({id,paths,z:paths.flat().reduce((sum,p)=>sum+p[2],0)/paths.flat().length,light:y<0?1:.8,cap:y,offset:offsets[partIndex]});}
   for(const p of polys)for(let i=0;i<p.points.length;i++){const a=p.points[i],q=p.points[(i+1)%p.points.length];if(Math.hypot(a[0]-q[0],a[1]-q[1])<1e-7)continue;const pts=[point(a[0],lo,a[1]),point(q[0],lo,q[1]),point(q[0],hi,q[1]),point(a[0],hi,a[1])];faces.push({id,paths:[pts],z:pts.reduce((v,p)=>v+p[2],0)/4,light:.85,planeY:s.core&&Math.abs(a[0]-q[0])<1e-8?a[0]:undefined,offset:offsets[partIndex]});}
  }
  if(s.mask&&!s.exploded)for(const [a,e] of s.mask.solid){const m=s.mask;for(const y of [-s.depth/2,s.depth/2]){const ps=[[a,y,m.y],[e,y,m.y],[e,y,m.y+m.t],[a,y,m.y+m.t]].map(transform);faces.push({id:-1,paths:[ps],z:ps.reduce((v,p)=>v+p[2],0)/4,light:1});}for(const z of [m.y,m.y+m.t]){const ps=[[a,-s.depth/2,z],[e,-s.depth/2,z],[e,s.depth/2,z],[a,s.depth/2,z]].map(transform);faces.push({id:-1,paths:[ps],z:ps.reduce((v,p)=>v+p[2],0)/4,light:.85});}}
  faces.sort((a,b)=>b.z-a.z);for(const f of faces){c.beginPath();for(const ps of f.paths){ps.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath()}const doping=s.doping&&s.data.materialDoping?.[f.id],hex=doping?'#'+DopantView.rgb((doping.type==='p'?-1:1)*doping.concentration).map(v=>v.toString(16).padStart(2,'0')).join(''):f.id===-1?'#959DA9':style(f.id).color;c.fillStyle=shadeColor(hex,f.light);c.fill('evenodd');
   const planeY=s.core?f.planeY:f.cap;
   if(s.doping&&s.data.concentration&&[10,11,13].includes(f.id)&&planeY!==undefined){const tex=DopantView.texture(s.data,rawBounds,hex,undefined,f.id),a=transform([rawBounds[0],planeY,rawBounds[3]+f.offset]),e=transform([rawBounds[1],planeY,rawBounds[3]+f.offset]),d=transform([rawBounds[0],planeY,rawBounds[2]+f.offset]);c.save();c.clip('evenodd');c.transform((e[0]-a[0])/tex.width,(e[1]-a[1])/tex.width,(d[0]-a[0])/tex.height,(d[1]-a[1])/tex.height,a[0],a[1]);c.drawImage(tex,0,0);c.restore();}
   c.strokeStyle=shadeColor(hex,.78);c.lineWidth=.35;c.stroke();}
  if(s.mask?.arrows&&!s.exploded)for(const ray of PhotoPreview.rays(s.mask)){const u=transform([ray.x,0,ray.start]),v=transform([ray.x,0,ray.end]);c.strokeStyle=ray.blocked?'#7D8798':s.mask.species==='B'?'#c2185b':s.mask.species?'#1255cd':'#c99b35';c.beginPath();c.moveTo(u[0],u[1]);c.lineTo(v[0],v[1]);c.lineTo(v[0]-3,v[1]-6);c.moveTo(v[0],v[1]);c.lineTo(v[0]+3,v[1]-6);c.stroke();}
  if(s.miniMapPlane){const {axis,at}=s.miniMapPlane,a=axis==='X'?0:axis==='Y'?1:2,others=[0,1,2].filter(i=>i!==a),ranges=[[b[0],b[1]],[-s.depth/2,s.depth/2],[b[2],b[3]]];c.beginPath();for(const [n,[j,k]] of [[0,0],[1,0],[1,1],[0,1]].entries()){const p=[0,0,0];p[a]=at;p[others[0]]=ranges[others[0]][j];p[others[1]]=ranges[others[1]][k];const q=transform(p);n?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]);}c.closePath();c.fillStyle='#e19c364d';c.fill();c.strokeStyle='#b46b15';c.stroke();}
  c.font='12px ProcessSans, sans-serif';
  for(const [name,v,color] of [['X',[.15,0,0],'#c55c44'],['Y',[0,.15,0],'#157f77'],['Z',[0,0,.15],'#536eb1']]){const o=transform([cx,0,cz]),e=transform([cx+v[0],v[1],cz+v[2]]);c.strokeStyle=c.fillStyle=color;c.beginPath();c.moveTo(w-70,h-55);c.lineTo(w-70+(e[0]-o[0])*.7,h-55+(e[1]-o[1])*.7);c.stroke();c.fillText(name,w-70+(e[0]-o[0])*.8,h-55+(e[1]-o[1])*.8);}
  paintReference(c,s);
  if(s.live&&!s.exploded)particles(c,s,w,h,(x,z)=>transform([x,0,z]));
 }
 function shadeColor(hex,f){return '#'+hex.slice(1).match(/../g).map(x=>Math.round(parseInt(x,16)*f).toString(16).padStart(2,'0')).join('');}
 function particles(c,s,w,h,project){
  const row=s.recipe,p=row?.params||{},b=s.bounds;if(!row)return;const t=(performance.now()-s.start)/1000,dep=row.op==='deposition',etch=row.op==='etch',impl=row.op==='diffusion'&&p.method==='Ion implantation',light=row.op==='photo'&&['Exposure','Develop'].includes(p.action);
  if(!dep&&!etch&&!impl&&!light){c.fillStyle='#476771';c.font='11px ProcessSans';c.fillText('Live · 단계 관찰',18,20);return;}
  const ps=s.data.polygons,topAt=x=>{let top=b[2];for(const poly of ps)for(const [a,z] of intervals([poly],0,x))top=Math.max(top,z);return top;};
  c.fillStyle=light?'#d3aa43':impl?(p.species==='B'?'#c05e7f':'#428ad0'):etch?'#d28c42':'#268c9b';const n=48,sticking=p.method==='PVD'?1:clamp(p.sticking||.2,.01,1);
  for(let i=0;i<n;i++){const seed=(i*.61803398875)%1,x=b[0]+seed*(b[1]-b[0]),blocked=s.mask?.solid.some(([a,e])=>x>=a&&x<=e),surface=impl?(PhotoPreview.impact(s.mask,s.data,x)?.end??topAt(x)):blocked?s.mask.y+s.mask.t:topAt(x),phase=(t*.45+i/n)%1;let z=surface+(Math.max(b[3],s.mask?.top||b[3])-surface+.15)*(1-phase),xx=x;if(dep&&p.method!=='PVD')xx+=Math.sin(phase*13+i)*.015*(1-sticking);const xy=project(xx,z);c.beginPath();c.arc(xy[0],xy[1],2.2,0,Math.PI*2);c.fill();if(phase>.9){c.globalAlpha=(1-phase)*10;c.beginPath();c.arc(xy[0],xy[1],4,0,Math.PI*2);c.stroke();c.globalAlpha=1;}}
  c.fillStyle='#476771';c.font='11px ProcessSans';c.fillText(`Live · ${dep?(p.method==='PVD'?'타겟 원자 이동':'기상종 이동·표면 부착'):impl?'이온 주입':light?'노광 · 마스크 차폐':'식각종 이동'} · 개념 애니메이션`,18,20);
 }
 function overlay(canvas,c,px,py){const s=get(canvas.id);if(s?.live&&s.view==='2d'&&s.axis==='Y')particles(c,s,canvas.clientWidth,canvas.clientHeight,(x,z)=>[px(x),py(z)]);}
 function showGroups(s,labels){
  if(!s.exploded||s.isMinimap||!s.explodeSummary)return;
  const caption=labels.length>1?'아래부터　'+labels.join(' · '):labels[0]||'';
  if(s.explodeSummary.textContent!==caption)s.explodeSummary.textContent=caption;
 }
 const api={showGroups,intervals,section,referenceSection,prepare,render,get,overlay,particles};if(typeof module==='object'&&module.exports)module.exports=api;else root.SolidView=api;
})(typeof window==='object'?window:globalThis);
