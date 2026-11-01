'use strict';
const G=require('./web/poly-gate-doping.js');
const W=require('./web/wafer-doping.js'),L=require('./web/learning-score.js');
// Keep cached native results immutable. A separate analytical background can be
// changed instantly without re-running unchanged geometry/implant trajectories.
const memo=new WeakMap();
function apply(raw,setting,target=raw.target||raw.example,view=raw.view||'gate',gateSetting=raw.polyGateDoping){
 const d=W.validate(setting,target,view),gateDoping=G.validate(gateSetting===undefined?G.defaults(target,view,d):gateSetting,target,view);if(raw.waferBackgroundVersion===1){if(W.equal(raw.substrateDoping,d)&&G.equal(raw.polyGateDoping,gateDoping))return raw;throw Error('Background already applied');}const key=JSON.stringify([d,gateDoping,target,view]);
 let saved=memo.get(raw);if(saved?.key===key)return saved.result;
 const initial=raw.frames[0],initialPoints=initial.polygons.filter(p=>p.material===10).flatMap(p=>p.points);
 if(!initialPoints.length)return raw;
 const bounds=raw.bounds,dx=.01,lo=bounds[0],hi=bounds[1],bottom=bounds[2]-.1,top=bounds[3];
 const initialByX=new Map(),inside=(spans,y)=>spans.some(([a,b])=>y>=a&&y<=b);
 function initialSpans(x){const k=x.toFixed(7);if(!initialByX.has(k))initialByX.set(k,L.intervals(initial,10,1,x));return initialByX.get(k);}
 const bodies=[];let siliconDepositions=0;
 const frames=raw.frames.map((frame,index)=>{
  const step=raw.steps?.[frame.stepIndex-1]||raw.steps?.[index-1];
  if(index&&step?.op==='deposition'&&step.params.material==='Si'){
   // Prepared/epitaxial Si body layers inherit the lightly doped body model.
   // In the CFET teaching flow, later Si layers belong to the upper pFET.
   const type=target==='cfet'&&siliconDepositions>0?'n':d.type;
   bodies.push({before:raw.frames[index-1],after:frame,type,columns:new Map()});siliconDepositions++;
  }
  const source=frame.concentration;
  // Preserve native grid where available, including its exact cell centers.
  const grid=source||{dx,nx:Math.ceil((hi-lo)/dx),ny:Math.ceil((top-bottom)/dx),origin:[lo,bottom],unit:'cm^-3'};
  const n=grid.nx*grid.ny,fields=Object.fromEntries(Object.entries(source?.fields||{}).map(([k,a])=>[k,a.slice()])),mask=Array(n).fill(0);
  const types=new Set([d.type,...bodies.map(b=>b.type)]);
  for(const type of types)if(type!=='intrinsic')for(const kind of ['total','active'])fields[(type==='n'?'P':'B')+'_'+kind]??=Array(n).fill(0);
  for(let i=0;i<grid.nx;i++){
   const x=grid.origin[0]+(i+.5)*grid.dx,si=L.intervals(frame,10,1,x),wafer=initialSpans(x);
   const layers=bodies.map(b=>{const key=x.toFixed(7);if(!b.columns.has(key))b.columns.set(key,{before:L.intervals(b.before,10,1,x),after:L.intervals(b.after,10,1,x)});return {...b.columns.get(key),type:b.type};});
   for(let j=0;j<grid.ny;j++){
    const k=j*grid.nx+i,y=grid.origin[1]+(j+.5)*grid.dx;
    if(!inside(si,y)){for(const a of Object.values(fields))a[k]=0;continue;}
    mask[k]=1;
    let type=inside(wafer,y)?d.type:'intrinsic';
    for(const layer of layers)if(inside(layer.after,y)&&!inside(layer.before,y))type=layer.type;
    if(type!=='intrinsic')for(const kind of ['total','active'])fields[(type==='n'?'P':'B')+'_'+kind][k]+=d.concentration;
   }
  }
  for(const kind of ['total','active'])if(fields['P_'+kind]||fields['B_'+kind])fields['net_'+kind]=Array.from({length:n},(_,k)=>(fields['P_'+kind]?.[k]||0)-(fields['B_'+kind]?.[k]||0));
  const background={...d,upperBodyType:target==='cfet'&&siliconDepositions>1?'n':undefined,model:'uniform fully active wafer/prepared Si body background; linear compensation; no background redistribution'};
  // Background is not an implant or activation operation: retain native evidence.
  // Conductive poly gates use an in-situ doped film approximation. Keep this
  // material-local value out of the Si transport grid and S/D grading evidence.
  // SADP poly is a sacrificial mandrel, not a gate electrode.
  const materialDoping=target!=='sadp'&&frame.polygons.some(p=>p.material===11)?{11:{...gateDoping,role:'gate',model:'uniform fully active in-situ doped Poly-Si'}}:{};
  return {...frame,substrateDoping:d,materialDoping,concentration:{...grid,mask,fields,background,info:source?.info||{operation:'wafer'}}};
 });
 const result={...raw,waferBackgroundVersion:1,substrateDoping:d,polyGateDoping:gateDoping,frames};memo.set(raw,{key,result});return result;
}
module.exports={apply};
