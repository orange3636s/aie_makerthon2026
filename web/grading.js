/* Material-balanced IoU in the active region, in fixed physical coordinates. */
(function(root){
 function raster(frame,bounds,n=180){
  const out=new Int16Array(n*n).fill(-1),groups=new Map();
  for(const p of frame.polygons){if(!groups.has(p.material))groups.set(p.material,[]);groups.get(p.material).push(p.points)}
  for(const [mat,polys] of groups)for(let row=0;row<n;row++){
   const y=bounds[2]+(row+.5)*(bounds[3]-bounds[2])/n,xs=[];
   for(const pts of polys)for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))}
   xs.sort((a,b)=>a-b);for(let k=0;k+1<xs.length;k+=2)for(let col=Math.max(0,Math.ceil((xs[k]-bounds[0])/(bounds[1]-bounds[0])*n-.5));col<n&&bounds[0]+(col+.5)*(bounds[1]-bounds[0])/n<xs[k+1];col++)out[row*n+col]=mat;
  }return out;
 }
 function compare(target,actual,roi){const a=raster(target,roi),b=raster(actual,roi),ids=new Set([...a,...b]);ids.delete(-1);const materials=[];let total=0,weights=0;
  for(const id of ids){let intersection=0,union=0,targetPixels=0,actualPixels=0;for(let i=0;i<a.length;i++){const x=a[i]===id,y=b[i]===id;if(x)targetPixels++;if(y)actualPixels++;if(x&&y)intersection++;if(x||y)union++}if(!union)continue;const iou=intersection/union,weight=id===10?.25:1;materials.push({id,iou,targetPixels,actualPixels});total+=iou*weight;weights+=weight}
  return{score:weights?Math.round(100*total/weights):0,materials,method:'Active-region material IoU; Si weight 0.25; no geometry alignment or image-pixel grading'};
 }
 const api={raster,compare};if(typeof module!=='undefined')module.exports=api;else root.SimulationGrading=api;
})(typeof window!=='undefined'?window:this);
