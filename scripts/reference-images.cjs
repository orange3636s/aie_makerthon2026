// Render numerical material regions, not user-uploaded images. No image service needed.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),vm=require('node:vm');
const {raster}=require('../web/grading.js');
const root=path.join(__dirname,'..'),context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'web/materials.js'),'utf8'),context);
const palette=context.window.SIMULATION_MATERIALS;
function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function chunk(type,data){const b=Buffer.concat([Buffer.from(type),data]),head=Buffer.alloc(4),crc=Buffer.alloc(4);head.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(b));return Buffer.concat([head,b,crc])}
function render(data,n=320){
 const frame=data.frames.at(-1),b=[...data.bounds],width=b[1]-b[0],height=b[3]-b[2],size=Math.max(width,height)*1.1;
 const cx=(b[0]+b[1])/2,cy=(b[2]+b[3])/2,grid=raster(frame,[cx-size/2,cx+size/2,cy-size/2,cy+size/2],n),raw=Buffer.alloc(n*(n*3+1));
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const mat=grid[(n-y-1)*n+x],hex=palette[mat]?.color||'#ffffff',pos=y*(n*3+1)+1+x*3;for(let c=0;c<3;c++)raw[pos+c]=parseInt(hex.slice(1+c*2,3+c*2),16)}
 const h=Buffer.alloc(13);h.writeUInt32BE(n);h.writeUInt32BE(n,4);h[8]=8;h[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const imageCache=new Map();
function references(targets){return targets.flatMap(t=>{if(!imageCache.has(t.id))imageCache.set(t.id,render(JSON.parse(fs.readFileSync(path.join(root,'references',t.id+'.json')))).toString('base64'));return[{text:'Reference example: '+t.id},{inlineData:{mimeType:'image/png',data:imageCache.get(t.id)}}]})}
module.exports={render,references};
if(require.main===module){const out=path.join(root,'.runtime/image-tests');fs.mkdirSync(out,{recursive:true});for(const id of ['mosfet','finfet','mbcfet','sti'])fs.writeFileSync(path.join(out,id+'.png'),render(JSON.parse(fs.readFileSync(path.join(root,'references',id+'.json')))));console.log('4 numerical reference images rendered')}
