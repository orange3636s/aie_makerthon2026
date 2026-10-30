'use strict';
// Camera transforms affect presentation only; simulation coordinates stay unchanged.
(function(root){
 const states=new WeakMap();
 function fit(data,bounds,reference){
  const pts=[...(data?.polygons||[]),...(reference?.polygons||[])].flatMap(p=>p.points);
  if(!pts.length)return bounds;
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(const [x,y] of pts){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
  x0=Math.max(x0,bounds[0]);x1=Math.min(x1,bounds[1]);y0=Math.max(y0,bounds[2]);y1=Math.min(y1,bounds[3]);
  const pad=Math.max(x1-x0,y1-y0)*.025;
  return [x0-pad,x1+pad,y0-pad,y1+pad];
 }
 function attach(canvas,redraw,key){
  let s=states.get(canvas);
  if(s){s.redraw=redraw;if(s.key!==key){s.zoom=1;s.x=s.y=0;s.key=key}return s}
  s={zoom:1,x:0,y:0,key,redraw};states.set(canvas,s);
  canvas.classList.add('interactive-section');canvas.tabIndex=0;
  canvas.title='휠: 확대·축소 · 드래그: 이동 · 두 번 클릭: 맞춤';
  const bar=document.createElement('div');bar.className='viewport-tools';bar.setAttribute('aria-label','단면 보기 조절');
  for(const [label,title,action] of [['−','축소',()=>zoom(.8)],['+','확대',()=>zoom(1.25)],['⌖','화면에 맞춤',reset],['⛶','크게 보기',()=>{const panel=canvas.closest('.viewer,.reverse-view');panel.classList.toggle('viewer-focus');s.redraw()}]]){
   const b=document.createElement('button');b.type='button';b.textContent=label;b.title=title;b.setAttribute('aria-label',title);b.onclick=action;bar.append(b)
  }
  canvas.parentElement.append(bar);
  function reset(){const v=window.SolidView?.get(canvas.id);if(v?.view==='3d'){v.zoom=1;v.panX=v.panY=0;v.redraw();return;}s.zoom=1;s.x=s.y=0;s.redraw()}
  function zoom(f,x=canvas.clientWidth/2,y=canvas.clientHeight/2){const v=window.SolidView?.get(canvas.id);if(v?.view==='3d'){v.zoom=Math.min(8,Math.max(.4,v.zoom*f));v.redraw();return;}const next=Math.min(8,Math.max(.65,s.zoom*f)),ratio=next/s.zoom;s.x=x-canvas.clientWidth/2-(x-canvas.clientWidth/2-s.x)*ratio;s.y=y-canvas.clientHeight/2-(y-canvas.clientHeight/2-s.y)*ratio;s.zoom=next;s.redraw()}
  canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top)},{passive:false});
  canvas.addEventListener('dblclick',reset);
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging')});
  canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;s.x+=e.clientX-drag.x;s.y+=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;s.redraw()});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{drag=null;canvas.classList.remove('dragging')});
  canvas.addEventListener('keydown',e=>{const d=25;if(e.key==='Escape'){canvas.closest('.viewer,.reverse-view')?.classList.remove('viewer-focus');s.redraw()}else if(e.key==='0')reset();else if(['+','='].includes(e.key))zoom(1.25);else if(e.key==='-')zoom(.8);else if(e.key.startsWith('Arrow')){s.x+=e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0;s.y+=e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0;s.redraw()}else return;e.preventDefault()});
  return s;
 }
 if(typeof document==='object')document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]'))document.querySelectorAll('.viewer-focus').forEach(p=>p.classList.remove('viewer-focus'))});
 const api={fit,attach};if(typeof module==='object'&&module.exports)module.exports=api;else root.SectionViewport=api;
})(typeof window==='object'?window:globalThis);
