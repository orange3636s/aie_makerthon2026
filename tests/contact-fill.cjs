// Measure native contact cavities, excluding field air and spacer seams.
const {raster}=require('../web/grading.js');
function measureContactFill(data,n=420){
 const index=data.steps.findIndex(s=>/ contact fill$/.test(s.label||''));
 if(index<0)return null;
 const pattern=data.steps.slice(0,index).findLast(s=>s.op==='photo'&&s.params.action!=='Strip').params;
 const pre=data.frames[index],post=data.frames.at(-1),top=pre.highest;
 const b=[-.72,.72,Math.min(0,pre.lowest),top-.015],a=raster(pre,b,n),z=raster(post,b,n);
 const centers=pattern.pattern==='Double'?[-pattern.pitch/2,pattern.pitch/2]:[-pattern.pitch,0,pattern.pitch];
 const contacts=centers.map(center=>({center,cavityPixels:0,voidPixels:0,metalPixels:0}));
 for(let i=0;i<a.length;i++){
  const x=b[0]+(i%n+.5)*(b[1]-b[0])/n,c=contacts.find(c=>Math.abs(x-c.center)<pattern.width/2);
  if(!c||a[i]!==-1)continue;c.cavityPixels++;if(z[i]===-1)c.voidPixels++;if([70,72,80].includes(z[i]))c.metalPixels++;
 }
 return contacts.map(c=>({...c,voidFraction:c.cavityPixels?c.voidPixels/c.cavityPixels:1,metalFraction:c.cavityPixels?c.metalPixels/c.cavityPixels:0}));
}
module.exports=measureContactFill;
if(require.main===module){const fs=require('fs');console.log(JSON.stringify(measureContactFill(JSON.parse(fs.readFileSync(process.argv[2])))))}
