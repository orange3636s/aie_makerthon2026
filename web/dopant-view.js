'use strict';
(function(root){
 const cache=new WeakMap();
 function field(data){const d=data?.concentration;if(!d)return null;const active=d.fields?.net_active;return d.info?.operation!=='implant'&&active?.some(v=>Math.abs(v)>=1e14)?'net_active':'net_total';}
 function sample(d,x,z,key){if(!d?.fields?.[key]?.length||!d.origin||!d.mask||!(d.dx>0))return 0;const ix=Math.floor((x-d.origin[0])/d.dx),iy=Math.floor((z-d.origin[1])/d.dx);if(ix<0||iy<0||ix>=d.nx||iy>=d.ny)return 0;const i=iy*d.nx+ix;return d.mask[i]&&Number.isFinite(d.fields[key][i])?d.fields[key][i]:0;}
 function surfaceSample(d,x,z,key){const v=sample(d,x,z,key);if(v||!d?.origin||!d.mask||!(d.dx>0))return v;const i=Math.floor((x-d.origin[0])/d.dx),j=Math.floor((z-d.origin[1])/d.dx);if(i>=0&&j>=0&&i<d.nx&&j<d.ny&&d.mask[j*d.nx+i])return 0;for(const [a,b] of [[0,-.51],[0,.51],[-.51,0],[.51,0],[-.51,-.51],[.51,-.51]]){const n=sample(d,x+a*d.dx,z+b*d.dx,key);if(n)return n;}return 0;}
 function rgb(value,base=[228,232,238]){const a=Math.abs(value);if(a<1e14)return base;const level=Math.max(0,Math.min(1,(Math.log10(a)-14)/6)),alpha=.14+.84*level**1.25,tint=value>=0?[18,85,205]:[194,24,91];return base.map((b,i)=>Math.round(b*(1-alpha)+tint[i]*alpha));}
 function texture(data,bounds,color,requestedField,material=10){if(!data.concentration)return null;const key=requestedField||field(data),doping=data.materialDoping?.[material],signature=bounds.join('|')+color+key+material;let items=cache.get(data);if(!items){items=new Map();cache.set(data,items);}if(items.has(signature))return items.get(signature);
  const c=document.createElement('canvas');c.width=512;c.height=Math.max(128,Math.min(1024,Math.round(512*(bounds[3]-bounds[2])/(bounds[1]-bounds[0]))));const ctx=c.getContext('2d'),im=ctx.createImageData(c.width,c.height),base=color.slice(1).match(/../g).map(v=>parseInt(v,16));
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const v=doping?(doping.type==='p'?-1:1)*doping.concentration:material===11?0:surfaceSample(data.concentration,bounds[0]+(x+.5)/c.width*(bounds[1]-bounds[0]),bounds[3]-(y+.5)/c.height*(bounds[3]-bounds[2]),key),i=4*(y*c.width+x),r=rgb(!doping&&key.startsWith('B_')?-v:v,base);im.data.set([...r,255],i);}
  ctx.putImageData(im,0,0);items.set(signature,c);return c;
 }
 function slice(data,bounds,axis,position,depth){const source=data.concentration;if(!source)return null;const dx=source.dx,nx=Math.max(1,Math.ceil((bounds[1]-bounds[0])/dx)),ny=Math.max(1,Math.ceil((bounds[3]-bounds[2])/dx)),fields=Object.fromEntries(Object.keys(source.fields).map(k=>[k,Array(nx*ny).fill(0)])),mask=Array(nx*ny).fill(0);
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const u=bounds[0]+(i+.5)*dx,v=bounds[2]+(j+.5)*dx,x=axis==='X'?position:u,z=axis==='X'?v:position,n=j*nx+i;for(const k of Object.keys(fields))fields[k][n]=sample(source,x,z,k);mask[n]=Math.abs(axis==='X'?u:v)<=depth/2?1:0;}
  return {...source,origin:[bounds[0],bounds[2]],dx,nx,ny,fields,mask};
 }
 function legend(data){
  const d=data?.substrateDoping||data?.concentration?.background;if(!d)return '';
  const tone=v=>'rgb('+rgb(v).join(',')+')',levels=[1e14,1e16,1e18,1e20];
  const ramp=sign=>'linear-gradient(90deg,'+levels.map(v=>tone(sign*v)).join(',')+')';
  const name=d.type==='p'?'p형 · B':d.type==='n'?'n형 · P':'진성';
  const gate=data.materialDoping?.[11];
  return `<div class="dopant-legend" role="group" aria-label="도핑 종류와 농도 범례"><span class="dopant-wafer">기판 <b>${name}</b>${d.type==='intrinsic'?'':` · ${d.concentration.toExponential(1)} cm⁻³`}${data.concentration?.background?.upperBodyType?' · 상부 pFET 몸체 n형':''}</span>${gate?`<span class="dopant-wafer">Poly Si 게이트 <b>${gate.type}${gate.concentration>=1e18?'+':'형'}</b> · ${gate.concentration.toExponential(2)} cm⁻³ · 증착 중 도핑</span>`:""}<span class="dopant-ramp"><b>p형 · B</b><i style="background:${ramp(-1)}"></i></span><span class="dopant-ramp"><b>n형 · P</b><i style="background:${ramp(1)}"></i></span><span class="dopant-scale">${field(data)==='net_active'?'활성':'총'} 순농도 · 10¹⁴–10²⁰ cm⁻³ · 연한색: 저농도 / 진한색: 고농도 · +: 고농도</span></div>`;
 }
 const api={field,sample,surfaceSample,rgb,texture,slice,legend};if(typeof module==='object'&&module.exports)module.exports=api;else root.DopantView=api;
})(typeof window==='object'?window:globalThis);
