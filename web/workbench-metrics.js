'use strict';
// Read-only metrology of the solved 2D section. Coordinates are native µm.
(function(root){
 function intervals(frame,x,id){
  const groups=new Map();
  for(const p of frame?.polygons||[]){if(id!=null&&p.material!==Number(id))continue;const ys=groups.get(p.material)||[];groups.set(p.material,ys);
   const pts=p.points||[];for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const a=pts[j],b=pts[i];if((a[0]<=x&&b[0]>x)||(b[0]<=x&&a[0]>x))ys.push(a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]));
   }
  }
  const spans=[];for(const ys of groups.values()){ys.sort((a,b)=>a-b);for(let i=0;i+1<ys.length;i+=2)if(ys[i+1]-ys[i]>1e-9)spans.push([ys[i],ys[i+1]])}
  spans.sort((a,b)=>a[0]-b[0]);const merged=[];for(const s of spans){const p=merged.at(-1);if(p&&s[0]<=p[1]+1e-9)p[1]=Math.max(p[1],s[1]);else merged.push([...s])}return merged;
 }
 function clipped(frame,x,material,bounds){return intervals(frame,x,material).map(([a,b])=>[Math.max(bounds[2],a),Math.min(bounds[3],b)]).filter(([a,b])=>b>a)}
 function thickness(frame,x,material,bounds){return clipped(frame,x,material,bounds).reduce((n,[a,b])=>n+b-a,0)*1000}
 function profile(frame,bounds,kind='surface',material=10,count=161){
  if(!frame||!bounds||bounds[1]<=bounds[0])return[];
  return Array.from({length:count},(_,i)=>{const x=bounds[0]+(bounds[1]-bounds[0])*(i+.5)/count,spans=clipped(frame,x,kind==='thickness'?material:null,bounds);return [x*1000,kind==='thickness'?spans.reduce((a,[b,c])=>a+c-b,0)*1000:spans.length?spans.at(-1)[1]*1000:null]});
 }
 function concentration(frame,x,field='net_total'){
  const d=frame?.concentration,a=d?.fields?.[field];if(!a||!d.nx||!d.ny||!(d.dx>0))return[];
  const col=Math.floor((x-d.origin[0])/d.dx);if(col<0||col>=d.nx)return[];
  // Use the highest semiconductor surface as the depth origin, not a metal/oxide cap.
  const si=[...intervals(frame,x,10),...intervals(frame,x,13)];if(!si.length)return[];
  const top=Math.max(...si.map(s=>s[1]));const rows=[];
  for(let j=d.ny-1;j>=0;j--){const k=j*d.nx+col,y=d.origin[1]+(j+.5)*d.dx,inside=si.some(([lo,hi])=>y>=lo&&y<=hi),value=a[k];rows.push([(top-y)*1000,d.mask[k]&&inside&&Number.isFinite(value)&&Math.abs(value)>0?Math.log10(Math.abs(value)):null]);}
  return rows.filter(r=>r[0]>=-d.dx*500);
 }
 function stats(points){const p=points.filter(r=>Number.isFinite(r[1]));if(!p.length)return null;const ys=p.map(r=>r[1]);return {min:Math.min(...ys),max:Math.max(...ys),range:Math.max(...ys)-Math.min(...ys),mean:ys.reduce((a,b)=>a+b,0)/ys.length}}
 function sample(frame,bounds,kind,material,x,field){return kind==='doping'?concentration(frame,x,field):profile(frame,bounds,kind,material)}
 function compare(a,b){const pairs=a.map((p,i)=>[p,b[i]]).filter(([p,q])=>q&&Number.isFinite(p[1])&&Number.isFinite(q[1])&&Math.abs(p[0]-q[0])<1e-6);return pairs.length?Math.sqrt(pairs.reduce((s,[p,q])=>s+(p[1]-q[1])**2,0)/pairs.length):null}
 const api={intervals,clipped,thickness,profile,concentration,stats,sample,compare};if(typeof module==='object'&&module.exports)module.exports=api;else root.WorkbenchMetrics=api;
})(typeof window==='object'?window:globalThis);
