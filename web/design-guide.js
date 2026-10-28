'use strict';
// Display-only design contours. Native results, dopants and grading inputs stay intact.
(function(root){
 const cache=new WeakMap();
 const area=pts=>Math.abs(pts.reduce((a,p,i)=>{const q=pts[(i+1)%pts.length];return a+p[0]*q[1]-q[0]*p[1]},0)/2);
 function simplify(points,tolerance){
  if(points.length<=2)return points;
  const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],norm=dx*dx+dy*dy;
  let furthest=0,index=0;
  for(let i=1;i<points.length-1;i++){const p=points[i],t=norm?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/norm)):0,d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);if(d>furthest){furthest=d;index=i}}
  if(furthest<=tolerance)return[a,b];
  return [...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)];
 }
 function ring(points,tolerance){
  const p=points.slice();if(p.length>1&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<1e-10)p.pop();
  if(p.length<3)return p;
  let split=1;for(let i=2;i<p.length;i++)if(Math.hypot(p[i][0]-p[0][0],p[i][1]-p[0][1])>Math.hypot(p[split][0]-p[0][0],p[split][1]-p[0][1]))split=i;
  return [...simplify(p.slice(0,split+1),tolerance).slice(0,-1),...simplify([...p.slice(split),p[0]],tolerance).slice(0,-1)];
 }
 function median(edges){
  const sorted=edges.slice().sort((a,b)=>a.position-b.position),half=edges.reduce((s,e)=>s+e.weight,0)/2;let sum=0;
  for(const e of sorted){sum+=e.weight;if(sum>=half)return e.position}return sorted.at(-1).position;
 }
 function straighten(points,tolerance){
  const p=ring(points,tolerance),runs=[];
  for(let i=0;i<p.length;i++){
   const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dy=b[1]-a[1],horizontal=Math.abs(dx)>=Math.abs(dy),weight=Math.hypot(dx,dy);
   if(weight<1e-12)continue;
   const edge={position:horizontal?(a[1]+b[1])/2:(a[0]+b[0])/2,weight};
   if(runs.at(-1)?.horizontal===horizontal)runs.at(-1).edges.push(edge);else runs.push({horizontal,edges:[edge]});
  }
  if(runs.length>1&&runs[0].horizontal===runs.at(-1).horizontal)runs[0].edges.push(...runs.pop().edges);
  if(runs.length<4)return null;
  const lines=runs.map(r=>({...r,position:median(r.edges)}));
  const corners=lines.map((line,i)=>{const prev=lines[(i+lines.length-1)%lines.length];return line.horizontal?[prev.position,line.position]:[line.position,prev.position]});
  if(area(corners)<1e-12)return null;
  return [...corners,corners[0]];
 }
 function build(frame,{curved=false}={}){
  if(!frame)return null;
  const key=curved?'curved':'rectilinear';let saved=cache.get(frame);if(saved?.[key])return saved[key];
  const polygons=frame.polygons.flatMap(poly=>{
   const xs=poly.points.map(p=>p[0]),ys=poly.points.map(p=>p[1]),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);
   // Resolve broad edges while retaining thin gate-dielectric outlines.
   const tolerance=Math.max(1e-7,Math.min(Math.max(w,h)*.012,Math.min(w,h)*.16));
   let points=curved?ring(poly.points,tolerance):straighten(poly.points,tolerance);
   if(!points){points=straighten(poly.points,tolerance*.2);if(!points)return[]}
   if(curved)points=[...points,points[0]];
   return[{material:poly.material,closed:true,points}];
  });
  const guide={polygons};if(!saved){saved={};cache.set(frame,saved)}saved[key]=guide;return guide;
 }
 const api={build};if(typeof module==='object'&&module.exports)module.exports=api;else root.DesignGuide=api;
})(typeof window==='object'?window:globalThis);
