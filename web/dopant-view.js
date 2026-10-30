'use strict';
(function(root){
 const cache=new WeakMap();
 function field(data){const d=data?.concentration;if(!d)return null;const active=d.fields?.net_active;return d.info?.operation!=='implant'&&active?.some(v=>Math.abs(v)>=1e14)?'net_active':'net_total';}
 function sample(d,x,z,key){if(!d?.fields?.[key])return 0;const ix=Math.floor((x-d.origin[0])/d.dx),iy=Math.floor((z-d.origin[1])/d.dx);if(ix<0||iy<0||ix>=d.nx||iy>=d.ny)return 0;const i=iy*d.nx+ix;return d.mask[i]?d.fields[key][i]:0;}
 function rgb(value,base=[228,232,238]){const a=Math.abs(value);if(a<1e14)return base;const level=Math.max(0,Math.min(1,(Math.log10(a)-14)/6)),alpha=.98*level**1.25,tint=value>=0?[18,85,205]:[194,24,91];return base.map((b,i)=>Math.round(b*(1-alpha)+tint[i]*alpha));}
 function texture(data,bounds,color){if(!data.concentration)return null;const key=field(data),signature=bounds.join('|')+color+key;let items=cache.get(data);if(!items){items=new Map();cache.set(data,items);}if(items.has(signature))return items.get(signature);
  const c=document.createElement('canvas');c.width=512;c.height=Math.max(128,Math.min(1024,Math.round(512*(bounds[3]-bounds[2])/(bounds[1]-bounds[0]))));const ctx=c.getContext('2d'),im=ctx.createImageData(c.width,c.height),base=color.slice(1).match(/../g).map(v=>parseInt(v,16));
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const v=sample(data.concentration,bounds[0]+(x+.5)/c.width*(bounds[1]-bounds[0]),bounds[3]-(y+.5)/c.height*(bounds[3]-bounds[2]),key),i=4*(y*c.width+x),r=rgb(v,base);im.data.set([...r,255],i);}
  ctx.putImageData(im,0,0);items.set(signature,c);return c;
 }
 function slice(data,bounds,axis,position,depth){const source=data.concentration;if(!source)return null;const dx=source.dx,nx=Math.max(1,Math.ceil((bounds[1]-bounds[0])/dx)),ny=Math.max(1,Math.ceil((bounds[3]-bounds[2])/dx)),fields=Object.fromEntries(Object.keys(source.fields).map(k=>[k,Array(nx*ny).fill(0)])),mask=Array(nx*ny).fill(0);
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const u=bounds[0]+(i+.5)*dx,v=bounds[2]+(j+.5)*dx,x=axis==='X'?position:u,z=axis==='X'?v:position,n=j*nx+i;for(const k of Object.keys(fields))fields[k][n]=sample(source,x,z,k);mask[n]=Math.abs(axis==='X'?u:v)<=depth/2?1:0;}
  return {...source,origin:[bounds[0],bounds[2]],dx,nx,ny,fields,mask};
 }
 const api={field,sample,rgb,texture,slice};if(typeof module==='object'&&module.exports)module.exports=api;else root.DopantView=api;
})(typeof window==='object'?window:globalThis);
