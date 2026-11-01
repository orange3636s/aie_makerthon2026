'use strict';
(function(root){
 function windows(p,bounds){
  if(!p||!['width','pitch','offset'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k]))||p.width<=0||p.pitch<=0)return [];
  const centers=p.pattern==='Central'?[p.offset]:p.pattern==='Double'?[p.offset-p.pitch/2,p.offset+p.pitch/2]:p.pattern==='Triple'?[p.offset-p.pitch,p.offset,p.offset+p.pitch]:Array.from({length:65},(_,i)=>p.offset+(i-32)*p.pitch);
  const spans=centers.map(c=>[Math.max(bounds[0],c-p.width/2),Math.min(bounds[1],c+p.width/2)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]),out=[];
  for(const [a,b] of spans){const last=out.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else out.push([a,b]);}return out;
 }
 function build(p,bounds,data){
  if(!p||!bounds||!data)return null;let open=windows(p,bounds);if(!open.length)return null;
  if(p.species&&p.tone==='Negative'){const inverse=[];let x=bounds[0];for(const [a,b] of open){if(a>x)inverse.push([x,a]);x=b;}if(x<bounds[1])inverse.push([x,bounds[1]]);open=inverse;}
  const width=bounds[1]-bounds[0],surface=data.highest??Math.max(...data.polygons.flatMap(q=>q.points.map(p=>p[1]))),y=surface+(p.implant?.05:width*.12),t=p.implant?.1:width*.014;
  const solid=[];let end=bounds[0];for(const [a,b] of open){if(a>end)solid.push([end,a]);end=b;}if(end<bounds[1])solid.push([end,bounds[1]]);
  const result={open,solid,y,t,surface,top:y+t+width*.07,arrows:!!p.arrows,species:p.species,implant:!!p.implant};
  if(result.implant){result.rays=[];const xs=new Set([...Array.from({length:11},(_,i)=>bounds[0]+width*(i+.5)/11),...solid.map(([a,b])=>(a+b)/2),...open.flatMap(([a,b])=>[.25,.5,.75].map(r=>a+(b-a)*r))]);
   for(const x of [...xs].sort((a,b)=>a-b)){const hit=impact(result,data,x);if(hit)result.rays.push({x,start:result.top,end:hit.end,blocked:hit.blocked});}
  }
  return result;
 }
 function surfaceAt(data,x){
  const hits=[];
  for(const polygon of data?.polygons||[]){const ys=[],points=polygon.points;
   for(let i=0;i<points.length;i++){const [a,b]=[points[i],points[(i+1)%points.length]];if((a[0]<=x&&x<b[0])||(b[0]<=x&&x<a[0]))ys.push(a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]));}
   ys.sort((a,b)=>a-b);if(ys.length>=2)hits.push({top:ys.at(-1),bottom:ys.at(-2),material:polygon.material});
  }
  return hits.sort((a,b)=>b.top-a.top)[0]||null;
 }
 function impact(mask,data,x){
  if(mask?.solid.some(([a,b])=>x>=a&&x<=b))return {end:mask.y+mask.t,blocked:true};
  const hit=surfaceAt(data,x);if(!hit)return null;
  const blocked=hit.material!==10;
  return {end:blocked?hit.top+.003:hit.top-Math.min(.035,Math.max(0,hit.top-hit.bottom)*.2),blocked};
 }
 function rays(mask){return mask.rays||mask.open.flatMap(([a,b])=>[.25,.5,.75].map(f=>({x:a+(b-a)*f,start:mask.y+mask.t+.025,end:mask.surface+.008,blocked:false})));}
 function slice(mask,axis,at,depth,data){
  if(!mask||axis==='Y')return mask;
  if(axis==='Z')return at>=mask.y&&at<=mask.y+mask.t?{...mask,y:-depth/2,t:depth,top:depth/2,arrows:false}:null;
  const covered=mask.solid.some(([a,b])=>at>=a&&at<=b),hit=mask.implant?impact(mask,data,at):{end:mask.surface+.008,blocked:covered};
  return {...mask,solid:covered?[[-depth/2,depth/2]]:[],open:covered?[]:[[-depth/2,depth/2]],rays:hit?Array.from({length:5},(_,i)=>({x:depth*((i+.5)/5-.5),start:mask.top,end:hit.end,blocked:hit.blocked})):[],arrows:mask.arrows};
 }
 function context(row,rows,frame){
  if(row?.op==='diffusion'&&row.params.method==='Ion implantation'){
   const p=row.params;
   if(p.implant_mask&&p.implant_mask!=='Existing')return {pattern:p.implant_mask,width:p.implant_width,pitch:p.implant_pitch,offset:p.implant_offset,arrows:true,species:p.species,implant:true};
   // Existing gate/PR masks are real geometry, not a second floating photo mask.
   return {pattern:'Central',width:100,pitch:1,offset:0,arrows:true,species:p.species,implant:true};
  }
  if(row?.op!=='photo')return null;const p=row.params;
  if(['Patterning','Pattern','Exposure'].includes(p.action))return {...p,arrows:p.action==='Exposure'};
  if(p.action!=='Develop')return null;
  for(let i=rows.length-1;i>=0;i--){const s=rows[i];if(s.op!=='photo')continue;if(['Coat','Strip'].includes(s.params.action))break;if(['Patterning','Exposure'].includes(s.params.action))return {...s.params,arrows:true};}
  return frame?.photoMask?{...frame.photoMask,arrows:true}:null;
 }
 function paint(c,p,px,py,extra,mini=false){
  if(!p)return;
  for(const [a,b] of p.solid){const x=px(a),r=px(b),y=py(p.y+p.t),bottom=py(p.y);
   if(extra){c.fillStyle='#B8BEC7';c.beginPath();c.moveTo(x,y);c.lineTo(x+extra,y-extra);c.lineTo(r+extra,y-extra);c.lineTo(r,y);c.closePath();c.fill();c.fillStyle='#777F8C';c.beginPath();c.moveTo(r,y);c.lineTo(r+extra,y-extra);c.lineTo(r+extra,bottom-extra);c.lineTo(r,bottom);c.closePath();c.fill();}
   c.fillStyle='#959DA9';c.fillRect(x,y,r-x,bottom-y);
  }
  if(p.arrows){c.lineWidth=1.15;for(const ray of rays(p)){c.strokeStyle=ray.blocked?'#7D8798':p.species==='B'?'#CB7099':p.species==='P'?'#428AD0':'#D3AA43';const x=px(ray.x),end=py(ray.end);c.beginPath();c.moveTo(x,py(ray.start));c.lineTo(x,end);c.lineTo(x-3,end-5);c.moveTo(x,end);c.lineTo(x+3,end-5);c.stroke();if(ray.blocked){c.beginPath();c.moveTo(x-4,end);c.lineTo(x+4,end);c.stroke();}}}
  if(!mini){c.font='11px ProcessSans, sans-serif';c.fillStyle='#64748B';c.textAlign='left';c.fillText(p.species?p.species+' implantation':p.arrows?'Mask / UV · 도식':'Mask preview',px(p.solid[0]?.[0]??p.open[0]?.[0]??0),py(p.top)+8);}
 }
 const api={windows,build,context,paint,surfaceAt,impact,rays,slice};if(typeof module==='object'&&module.exports)module.exports=api;else root.PhotoPreview=api;
})(typeof window==='object'?window:globalThis);
