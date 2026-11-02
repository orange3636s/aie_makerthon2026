// Measure native contact cavities, excluding field air and spacer seams.
const {raster}=require('../web/grading.js');
function measureContactFill(data,n=420){
 const indices=data.steps.map((s,i)=>/ contact fill$/.test(s.label||'')?i:-1).filter(i=>i>=0);
 if(!indices.length)return null;
 return indices.flatMap((index,tier)=>{
 const pattern=data.steps.slice(0,index).findLast(s=>s.op==='photo'&&['Pattern','Patterning'].includes(s.params.action)).params;
 const pre=data.frames[index],post=data.frames.at(-1);
 // The section removed by this tier's CMP is no longer part of its contact.
 const planarized=data.steps[index+1]?.op==='cmp'?data.frames[index+2]?.metrics?.cutHeightUm:undefined;
 const top=Math.min(pre.highest-.015,Number.isFinite(planarized)?planarized:Infinity);
 const b=[-.72,.72,Math.min(0,pre.lowest),top],a=raster(pre,b,n),z=raster(post,b,n);
 const centers=pattern.pattern==='Double'?[-pattern.pitch/2,pattern.pitch/2]:[-pattern.pitch,0,pattern.pitch];
 const contacts=centers.map(center=>({center,cavityPixels:0,voidPixels:0,metalPixels:0}));
 for(const c of contacts){
  // Only voids reachable from the top opening are contact cavities. Enclosed
  // gate/channel pockets existed before contact etch and must not be counted.
  const seen=new Uint8Array(n*n),queue=[];
  const within=i=>Math.abs(b[0]+(i%n+.5)*(b[1]-b[0])/n-c.center)<pattern.width/2;
  for(let x=0;x<n;x++){const i=(n-1)*n+x;if(a[i]===-1&&within(i)){seen[i]=1;queue.push(i)}}
  for(let k=0;k<queue.length;k++){
   const i=queue[k];c.cavityPixels++;if(z[i]===-1)c.voidPixels++;if([70,72,80].includes(z[i]))c.metalPixels++;
   for(const j of [i-n,i+n,...(i%n?[i-1]:[]),...(i%n<n-1?[i+1]:[])])if(j>=0&&j<n*n&&!seen[j]&&a[j]===-1&&within(j)){seen[j]=1;queue.push(j)}
  }
 }
 return contacts.map(c=>({...c,tier:tier+1,voidFraction:c.cavityPixels?c.voidPixels/c.cavityPixels:1,metalFraction:c.cavityPixels?c.metalPixels/c.cavityPixels:0}));
 });
}
module.exports=measureContactFill;
if(require.main===module){const fs=require('fs');console.log(JSON.stringify(measureContactFill(JSON.parse(fs.readFileSync(process.argv[2])))))}
