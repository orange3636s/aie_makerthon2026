/* Orthographic extrusion with nearest-surface occlusion, independent of IDs. */
(function(root){
 function clipPolygon(points,bounds){
  let out=points.slice();
  for(const [axis,edge,sign] of [[0,bounds[0],1],[0,bounds[1],-1],[1,bounds[2],1],[1,bounds[3],-1]]){
   const input=out;out=[];if(!input.length)break;
   let a=input.at(-1),aIn=sign*(a[axis]-edge)>=0;
   for(const b of input){const bIn=sign*(b[axis]-edge)>=0;
    if(aIn!==bIn){const t=(edge-a[axis])/(b[axis]-a[axis]);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])])}
    if(bIn)out.push(b);a=b;aIn=bIn;
   }
  }
  return out.length>=3?[...out,out[0]]:[];
 }
 function project(front,width,height,depth){
  const out=new Uint8ClampedArray(front.length),distance=new Uint16Array(width*height);distance.fill(depth+1);
  for(let y=height-1;y>=0;y--)for(let x=0;x<width;x++){
   const i=y*width+x,k=i*4;
   if(front[k+3]){out.set(front.subarray(k,k+4),k);distance[i]=0;continue}
   if(!x||y+1>=height)continue;
   const previous=i+width-1,d=distance[previous]+1;if(d>depth)continue;
   distance[i]=d;const p=previous*4;
   const light=d===1?(front[(i+width)*4+3]>.5?.88:.66):1;
   out[k]=Math.round(out[p]*light);out[k+1]=Math.round(out[p+1]*light);out[k+2]=Math.round(out[p+2]*light);out[k+3]=out[p+3];
  }
  return out;
 }
 function draw(c,groups,px,py,w,h,depth,color){
  const scale=Math.min(window.devicePixelRatio||1,1.5),width=Math.ceil(w*scale),height=Math.ceil(h*scale);
  const layer=document.createElement('canvas');layer.width=width;layer.height=height;
  const ctx=layer.getContext('2d',{willReadFrequently:true});ctx.scale(scale,scale);
  for(const [id,polys] of groups){ctx.fillStyle=color(id);ctx.beginPath();for(const p of polys){p.points.forEach((v,i)=>i?ctx.lineTo(px(v[0]),py(v[1])):ctx.moveTo(px(v[0]),py(v[1])));ctx.closePath()}ctx.fill('evenodd')}
  const bitmap=ctx.getImageData(0,0,width,height);bitmap.data.set(project(bitmap.data,width,height,Math.round(depth*scale)));ctx.putImageData(bitmap,0,0);
  c.drawImage(layer,0,0,w,h);
 }
 const api={project,draw,clipPolygon};if(typeof module==='object'&&module.exports)module.exports=api;else root.ProcessExtrusion=api;
})(typeof window==='object'?window:globalThis);
