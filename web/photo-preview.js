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
  const width=bounds[1]-bounds[0],surface=data.highest??Math.max(...data.polygons.flatMap(q=>q.points.map(p=>p[1]))),y=surface+width*.12,t=width*.014;
  const solid=[];let end=bounds[0];for(const [a,b] of open){if(a>end)solid.push([end,a]);end=b;}if(end<bounds[1])solid.push([end,bounds[1]]);
  return {open,solid,y,t,surface,top:y+t+width*.07,arrows:!!p.arrows,species:p.species};
 }
 function context(row,rows,frame){
  if(row?.op==='diffusion'&&row.params.method==='Ion implantation'){
   const p=row.params;
   if(p.implant_mask&&p.implant_mask!=='Existing')return {pattern:p.implant_mask,width:p.implant_width,pitch:p.implant_pitch,offset:p.implant_offset,arrows:true,species:p.species};
   for(let i=rows.length-1;i>=0;i--){const s=rows[i];if(s.op==='photo'&&s.params.action==='Strip')break;if(s.op==='photo'&&['Pattern','Patterning','Exposure'].includes(s.params.action)){const coat=rows.slice(0,i).findLast(x=>x.op==='photo'&&x.params.action==='Coat');return {...s.params,tone:s.params.action==='Pattern'?s.params.tone:coat?.params.tone,arrows:true,species:p.species};}}
   return {pattern:'Central',width:100,pitch:1,offset:0,arrows:true,species:p.species};
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
  if(p.arrows){c.strokeStyle=p.species==='B'?'#CB7099':p.species==='P'?'#428AD0':'#D3AA43';c.lineWidth=1.15;for(const [a,b] of p.open)for(const ratio of [.25,.5,.75]){const x=px(a+(b-a)*ratio),end=py(p.surface+.008);c.beginPath();c.moveTo(x,py(p.y+p.t+.025));c.lineTo(x,end);c.lineTo(x-3,end-5);c.moveTo(x,end);c.lineTo(x+3,end-5);c.stroke();}}
  if(!mini){c.font='11px ProcessSans, sans-serif';c.fillStyle='#64748B';c.textAlign='left';c.fillText(p.species?p.species+' implantation':p.arrows?'Mask / UV · 도식':'Mask preview',px(p.solid[0]?.[0]??p.open[0][0]),py(p.top)+8);}
 }
 const api={windows,build,context,paint};if(typeof module==='object'&&module.exports)module.exports=api;else root.PhotoPreview=api;
})(typeof window==='object'?window:globalThis);
