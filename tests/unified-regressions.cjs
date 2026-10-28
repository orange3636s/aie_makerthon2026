// Numerical regressions, not an electrical device qualification.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {raster}=require('../web/grading'),contacts=require('./contact-fill.cjs');
const root=path.join(__dirname,'..'),read=id=>JSON.parse(fs.readFileSync(path.join(root,'references',id+'.json')));
function components(grid,n,predicate){
 const seen=new Uint8Array(grid.length),rows=[];
 for(let i=0;i<grid.length;i++){
  if(seen[i]||!predicate(grid[i]))continue;const q=[i];seen[i]=1;
  for(let k=0;k<q.length;k++){const z=q[k];for(const j of [z-n,z+n,...(z%n?[z-1]:[]),...(z%n<n-1?[z+1]:[])])if(j>=0&&j<grid.length&&!seen[j]&&predicate(grid[j])){seen[j]=1;q.push(j)}}rows.push(q);
 }return rows;
}
for(const id of ['gaafet','mbcfet','cfet']){
 const d=read(id),n=300,b=d.bounds;
 for(const f of d.frames.filter(f=>/release/i.test(f.label))){
  const regions=components(raster(f,b,n),n,v=>v===10).filter(c=>c.length>15);
  assert.equal(regions.length,id==='cfet'&&f.label.startsWith('Upper')?2:1,id+' supported Si components');
  for(const c of regions){assert(c.some(i=>b[0]+(i%n+.5)*(b[1]-b[0])/n<-.3));assert(c.some(i=>b[0]+(i%n+.5)*(b[1]-b[0])/n>.3))}
 }
 assert(contacts(d).every(c=>c.metalFraction>.975),id+' contact fill');
}
const bcat=read('bcat').frames.at(-1).concentration;
const high=components(bcat.fields.net_active,bcat.nx,v=>Math.abs(v)>1e17);
assert(high.length>=2,'BCAT has separate high-concentration regions');
for(const c of high){const x=i=>bcat.origin[0]+(i%bcat.nx+.5)*bcat.dx;assert(!(c.some(i=>x(i)<-.25)&&c.some(i=>x(i)>.25)),'BCAT high-dose bridge')}
let center=0;for(let i=0;i<bcat.fields.net_active.length;i++)if(Math.abs(bcat.origin[0]+(i%bcat.nx+.5)*bcat.dx)<.1)center=Math.max(center,Math.abs(bcat.fields.net_active[i]));assert(center<1e15,'BCAT channel center');
const mbc=read('mbcfet').frames.at(-1).concentration;
for(const [lo,hi] of [[0,.06],[.1,.16],[.2,.26]])for(const sign of [-1,1]){
 let peak=0;for(let i=0;i<mbc.fields.P_active.length;i++){const x=sign*(mbc.origin[0]+(i%mbc.nx+.5)*mbc.dx),y=mbc.origin[1]+(Math.floor(i/mbc.nx)+.5)*mbc.dx;if(x>.3&&x<.6&&y>lo&&y<hi)peak=Math.max(peak,mbc.fields.P_active[i])}assert(peak>1e16,'MBCFET S/D doping at each sheet height');
}
const cfet=read('cfet'),cc=cfet.frames.at(-1).concentration,split=cfet.frames[25].highest;
let lowerP=0,upperP=0,lowerB=0,upperB=0;
for(let i=0;i<cc.fields.P_active.length;i++){const y=cc.origin[1]+(Math.floor(i/cc.nx)+.5)*cc.dx;if(y<split){lowerP=Math.max(lowerP,cc.fields.P_active[i]);lowerB=Math.max(lowerB,cc.fields.B_active[i])}else{upperP=Math.max(upperP,cc.fields.P_active[i]);upperB=Math.max(upperB,cc.fields.B_active[i])}}
assert(lowerP>1e17&&upperB>1e17&&upperP<1e15&&lowerB<1e15,'CFET tier dopant separation');assert.equal(contacts(cfet).length,6,'CFET checks both sets of contacts');
console.log('Supported release sections, all sheet S/D doping, BCAT separation, two CFET tiers and contact fill passed');
