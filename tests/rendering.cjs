// Rendering must not depend on the enumeration order of material IDs.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../web/app.js'),'utf8');
const drawSource=source.slice(source.indexOf('function draw(canvas'),source.indexOf('function drawMain()'));
function render(polygons){
 const fills=[];let paths=[],active=[];
 const context={scale(){},fillRect(){},save(){},restore(){},rect(){},clip(){},stroke(){},fillText(){},setLineDash(){},
  beginPath(){paths=[];active=[]},moveTo(x,y){active=[];paths.push(active);active.push([x,y])},lineTo(x,y){active.push([x,y])},closePath(){},
  fill(rule){fills.push({color:this.fillStyle,paths:paths.map(p=>p.slice()),rule})}};
 const canvas={getBoundingClientRect:()=>({width:360,height:280}),getContext:()=>context};
 const colors={5:'#F2CB78',79:'#939FE8'};
 const scope={window:{devicePixelRatio:1},selected:{unit:'µm'},current:null,materialStyle:id=>({color:colors[id]}),shade:(color,brightness)=>color+brightness};
 vm.createContext(scope);vm.runInContext(drawSource,scope);scope.draw(canvas,{polygons},[-1.2,1.2,-.2,1],{extrude:true});
 function inside(x,y,points){let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
 const pixels=[];for(let y=0;y<280;y+=2)for(let x=0;x<360;x+=2){let color='white';for(const f of fills){const hits=f.paths.filter(p=>inside(x+.5,y+.5,p)).length;if(f.rule==='evenodd'?hits%2:hits)color=f.color}pixels.push(color)}return pixels;
}
const rect=(material,x0,y0,x1,y1)=>({material,closed:true,points:[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]});
const stacked=[rect(5,-1,.4,1,.5),rect(79,-.2,.1,.2,.3)];
assert.deepEqual(render(stacked),render([...stacked].reverse()),'buried gate must not paint over upper metal when material enumeration changes');
console.log('2.5D material-order-independent occlusion verified');
const {project}=require('../web/extrusion');
const n=16,front=new Uint8ClampedArray(n*n*4),put=(x,y,c)=>front.set([...c,255],(y*n+x)*4);
put(3,12,[220,100,80]);put(6,9,[80,160,220]);
const rendered=project(front,n,n,6),pixel=(x,y)=>Array.from(rendered.slice((y*n+x)*4,(y*n+x)*4+4));
assert.deepEqual(pixel(6,9),[80,160,220,255],'closer front surface occludes the farther extrusion');
assert.deepEqual(pixel(7,8),[53,106,145,255],'side is shaded once, not exponentially darkened');
assert.equal(pixel(13,2)[3],0,'extrusion ends at its specified depth');
assert.equal(pixel(5,12)[3],0,'separate line-pattern gaps remain open');
assert.equal(rendered.length,front.length,'small viewports stay within the bitmap');
console.log('Nearest-surface 2.5D occlusion, shading, pattern gaps and bounds passed');
