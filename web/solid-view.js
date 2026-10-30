'use strict';
// A finite extrusion of the calculated material cross-section. No invented 3D solver.
(function(root){
 const states=new Map(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function intervals(polys,axis,at){const hits=[];for(const p of polys){const q=p.points;for(let i=0,j=q.length-1;i<q.length;j=i++){const a=q[j],b=q[i];if((a[axis]>at)!==(b[axis]>at))hits.push(a[1-axis]+(at-a[axis])*(b[1-axis]-a[1-axis])/(b[axis]-a[axis]));}}hits.sort((a,b)=>a-b);const out=[];for(let i=0;i+1<hits.length;i+=2)if(hits[i+1]-hits[i]>1e-8)out.push([hits[i],hits[i+1]]);return out;}
 function groups(data){const g=new Map();for(const p of data.polygons||[]){if(!g.has(p.material))g.set(p.material,[]);g.get(p.material).push(p)}return g;}
 function section(data,bounds,axis,position,depth){
  if(axis==='Y')return {data,bounds,labels:['X','Z']};
  const polygons=[];for(const [material,ps] of groups(data))for(const [a,b] of intervals(ps,axis==='X'?0:1,position)){
   const points=axis==='X'?[[-depth/2,a],[depth/2,a],[depth/2,b],[-depth/2,b]]:[[a,-depth/2],[b,-depth/2],[b,depth/2],[a,depth/2]];polygons.push({material,points,closed:true});
  }
  return {data:{...data,polygons,concentration:null,photoMask:null,metrics:{}},bounds:axis==='X'?[-depth/2,depth/2,bounds[2],bounds[3]]:[bounds[0],bounds[1],-depth/2,depth/2],labels:axis==='X'?['Y','Z']:['X','Y']};
 }
 function get(id){return states.get(id)}
 function mount(canvas,redraw){
  let s=states.get(canvas.id);if(s){s.redraw=redraw;return s;}
  s={id:canvas.id,axis:'Y',fraction:.5,depth:.8,view:'2d',yaw:-.55,pitch:.35,zoom:1,panX:0,panY:0,exploded:false,explodeMode:'layer',explodeGap:.12,redraw};states.set(canvas.id,s);
  const box=canvas.closest('.viewer,.reverse-view'),bar=document.createElement('div');bar.className='solid-controls';bar.innerHTML='<div class="slice-axis" role="group" aria-label="절단 축">'+['X','Y','Z'].map(a=>`<button type="button" data-axis="${a}" aria-pressed="${a==='Y'}">${a} 단면</button>`).join('')+'</div><input class="slice-position" type="range" min="0" max="1000" value="500" aria-label="절단 위치"><output class="slice-value">0 nm</output><label class="solid-depth">깊이 <input type="number" min="100" max="2000" step="10" value="800" aria-label="3D 확장 깊이 nm"> nm</label><button type="button" class="live-toggle" aria-pressed="false">▷ Live</button><span class="solid-model" title="계산된 2D 단면을 일정 깊이로 확장한 3D 모델">단면 기반 3D</span>';
  const explode=document.createElement('div');explode.className='explode-controls';explode.hidden=true;
  explode.innerHTML='<button type="button" class="explode-toggle" aria-pressed="false">분리 보기</button><div class="explode-options" hidden><select aria-label="분리 기준"><option value="layer">층별</option><option value="material">재료별</option></select><label>표시 간격 <input type="range" min="20" max="300" step="10" value="120" aria-label="분리 간격 nm"></label><output>120 nm</output><button type="button" class="explode-reset">원래 구조</button></div>';
  bar.append(explode);
  const syncExplode=()=>{explode.querySelector('.explode-toggle').setAttribute('aria-pressed',s.exploded);explode.querySelector('.explode-options').hidden=!s.exploded;s.redraw()};
  explode.querySelector('.explode-toggle').onclick=()=>{s.exploded=!s.exploded;syncExplode()};
  explode.querySelector('select').onchange=e=>{s.explodeMode=e.target.value;s.redraw()};
  explode.querySelector('input').oninput=e=>{s.explodeGap=+e.target.value/1000;explode.querySelector('output').textContent=e.target.value+' nm';s.redraw()};
  explode.querySelector('.explode-reset').onclick=()=>{s.exploded=false;syncExplode()};
  box.querySelector('.panel-heading').after(bar);s.bar=bar;
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
 function reset(s){s.yaw=-.55;s.pitch=.35;s.zoom=1;s.panX=s.panY=0;}
 function position(s,b){return s.axis==='X'?b[0]+s.fraction*(b[1]-b[0]):s.axis==='Z'?b[2]+s.fraction*(b[3]-b[2]):(s.fraction-.5)*s.depth;}
 function prepare(canvas,data,bounds,options,redraw){if(options.mini||!['section','r-current'].includes(canvas.id)||!data)return null;const s=mount(canvas,redraw);s.view=options.extrude?'3d':'2d';s.data=data;s.bounds=bounds;s.recipe=canvas.id==='section'?window.simulationEditor?.recipe():window.reverseLab?.recipe?.();
  for(const node of s.bar.querySelectorAll('.slice-axis,.slice-position,.slice-value'))node.hidden=s.view==='3d';
  s.bar.querySelector('.explode-controls').hidden=s.view!=='3d';
  const liveButton=s.bar.querySelector('.live-toggle');liveButton.disabled=s.view==='3d'&&s.exploded;
  if(liveButton.disabled&&s.live){s.live=false;cancelAnimationFrame(s.raf);liveButton.setAttribute('aria-pressed','false');liveButton.textContent='▷ Live';}
  const pos=position(s,bounds);s.bar.querySelector('output').textContent=Math.round(pos*1000)+' nm';s.bar.querySelector('.slice-position').disabled=false;s.bar.querySelector('.solid-depth').hidden=s.view!=='3d';s.bar.querySelector('.solid-model').hidden=s.view!=='3d';canvas.title=s.view==='3d'?'드래그: 회전 · Shift+드래그: 이동 · 휠: 확대/축소 · 0: 맞춤':'드래그: 이동 · 휠: 확대/축소';
  if(s.view==='3d')return {solid:s};return {...section(data,bounds,s.axis,pos,s.depth),state:s,position:pos};
 }
 function render(canvas,s,style){
  if(window.SolidGPU?.render(canvas,s,style))return;
  const r=canvas.getBoundingClientRect(),w=Math.max(80,r.width),h=Math.max(80,r.height),dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.fillStyle='#fff';c.fillRect(0,0,w,h);
  const rawBounds=s.bounds,clipped=s.data.polygons.map(p=>({...p,points:ProcessExtrusion.clipPolygon(p.points,rawBounds)})).filter(p=>p.points.length>=3),parts=SolidGeometry.parts(clipped),offsets=SolidGeometry.offsets(parts,s.explodeMode,s.exploded?s.explodeGap:0);
  const b=[...rawBounds];b[3]+=Math.max(0,...offsets);
  const cx=(b[0]+b[1])/2,cz=(b[2]+b[3])/2,scale=s.zoom*Math.min((w-100)/Math.hypot(b[1]-b[0],s.depth),(h-85)/Math.hypot(b[3]-b[2],s.depth));
  const transform=([x,y,z])=>{x-=cx;z-=cz;const a=x*Math.cos(s.yaw)-y*Math.sin(s.yaw),d=x*Math.sin(s.yaw)+y*Math.cos(s.yaw);return [w/2+a*scale+s.panX,h/2-(z*Math.cos(s.pitch)-d*Math.sin(s.pitch))*scale+s.panY,d*Math.cos(s.pitch)+z*Math.sin(s.pitch)]};
  s.project=transform;
  const faces=[];
  for(let partIndex=0;partIndex<parts.length;partIndex++){
   const id=parts[partIndex].material,polys=parts[partIndex].polygons.map(p=>({...p,points:p.points.map(([x,z])=>[x,z+offsets[partIndex]])}));
   for(const y of [-s.depth/2,s.depth/2]){const paths=polys.map(p=>p.points.map(([x,z])=>transform([x,y,z])));faces.push({id,paths,z:paths.flat().reduce((sum,p)=>sum+p[2],0)/paths.flat().length,light:y<0?1:.8});}
   for(const p of polys)for(let i=0;i<p.points.length;i++){const a=p.points[i],q=p.points[(i+1)%p.points.length];if(Math.hypot(a[0]-q[0],a[1]-q[1])<1e-7)continue;const pts=[transform([a[0],-s.depth/2,a[1]]),transform([q[0],-s.depth/2,q[1]]),transform([q[0],s.depth/2,q[1]]),transform([a[0],s.depth/2,a[1]])];faces.push({id,paths:[pts],z:pts.reduce((v,p)=>v+p[2],0)/4,light:.85});}
  }
  faces.sort((a,b)=>b.z-a.z);for(const f of faces){c.beginPath();for(const ps of f.paths){ps.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath()}const hex=style(f.id).color;c.fillStyle=shadeColor(hex,f.light);c.fill('evenodd');c.strokeStyle=shadeColor(hex,.78);c.lineWidth=.35;c.stroke();}
  c.font='12px ProcessSans, sans-serif';
  for(const [name,v,color] of [['X',[.15,0,0],'#c55c44'],['Y',[0,.15,0],'#157f77'],['Z',[0,0,.15],'#536eb1']]){const o=transform([cx,0,cz]),e=transform([cx+v[0],v[1],cz+v[2]]);c.strokeStyle=c.fillStyle=color;c.beginPath();c.moveTo(w-70,h-55);c.lineTo(w-70+(e[0]-o[0])*.7,h-55+(e[1]-o[1])*.7);c.stroke();c.fillText(name,w-70+(e[0]-o[0])*.8,h-55+(e[1]-o[1])*.8);}
  if(s.live&&!s.exploded)particles(c,s,w,h,(x,z)=>transform([x,0,z]));
 }
 function shadeColor(hex,f){return '#'+hex.slice(1).match(/../g).map(x=>Math.round(parseInt(x,16)*f).toString(16).padStart(2,'0')).join('');}
 function particles(c,s,w,h,project){
  const row=s.recipe,p=row?.params||{},b=s.bounds;if(!row)return;const t=(performance.now()-s.start)/1000,dep=row.op==='deposition',etch=row.op==='etch',impl=row.op==='diffusion'&&p.method==='Ion implantation';
  if(!dep&&!etch&&!impl){c.fillStyle='#476771';c.font='11px ProcessSans';c.fillText('Live · 단계 관찰',18,20);return;}
  const ps=s.data.polygons,topAt=x=>{let top=b[2];for(const poly of ps)for(const [a,z] of intervals([poly],0,x))top=Math.max(top,z);return top;};
  c.fillStyle=impl?'#c05e7f':etch?'#d28c42':'#268c9b';const n=48,sticking=p.method==='PVD'?1:clamp(p.sticking||.2,.01,1);
  for(let i=0;i<n;i++){const seed=(i*.61803398875)%1,x=b[0]+seed*(b[1]-b[0]),surface=topAt(x),phase=(t*.45+i/n)%1;let z=surface+(b[3]-surface+.15)*(1-phase),xx=x;if(dep&&p.method!=='PVD')xx+=Math.sin(phase*13+i)*.015*(1-sticking);const xy=project(xx,z);c.beginPath();c.arc(xy[0],xy[1],2.2,0,Math.PI*2);c.fill();if(phase>.9){c.globalAlpha=(1-phase)*10;c.beginPath();c.arc(xy[0],xy[1],4,0,Math.PI*2);c.stroke();c.globalAlpha=1;}}
  c.fillStyle='#476771';c.font='11px ProcessSans';c.fillText(`Live · ${dep?(p.method==='PVD'?'타겟 원자 이동':'기상종 이동·표면 부착'):impl?'이온 주입':'식각종 이동'} · 개념 애니메이션`,18,20);
 }
 function overlay(canvas,c,px,py){const s=get(canvas.id);if(s?.live&&s.view==='2d'&&s.axis==='Y')particles(c,s,canvas.clientWidth,canvas.clientHeight,(x,z)=>[px(x),py(z)]);}
 const api={intervals,section,prepare,render,get,overlay,particles};if(typeof module==='object'&&module.exports)module.exports=api;else root.SolidView=api;
})(typeof window==='object'?window:globalThis);
