'use strict';
(function(root){
 function inside(p,ring){let v=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])v=!v;}return v;}
 function area(r){return Math.abs(r.reduce((sum,p,i)=>{const q=r[(i+1)%r.length];return sum+p[0]*q[1]-q[0]*p[1]},0)/2)}
 function rings(polys){const a=polys.map(p=>({points:p.points,role:p.role,area:area(p.points),parent:null,depth:0})).filter(r=>r.area>1e-10).sort((a,b)=>b.area-a.area);for(let i=0;i<a.length;i++){for(let j=i-1;j>=0;j--)if(inside(a[i].points[0],a[j].points)){a[i].parent=a[j];a[i].depth=a[j].depth+1;break;}}return a;}
 function describe(material,ring){
  const xs=ring.points.map(p=>p[0]),zs=ring.points.map(p=>p[1]),min=Math.min(...zs),max=Math.max(...zs);
  return {material,role:ring.role,left:Math.min(...xs),right:Math.max(...xs),min,max,center:(min+max)/2};
 }
 // Each exterior ring and its holes move as one closed body. This is a view transform only.
 function parts(polygons){
  const materials=new Map(),out=[];
  for(const p of polygons){if(!materials.has(p.material))materials.set(p.material,[]);materials.get(p.material).push(p)}
  for(const [material,ps] of materials){const rs=rings(ps);for(const ring of rs.filter(r=>r.depth%2===0)){
   out.push({...describe(material,ring),polygons:[ring,...rs.filter(r=>r.parent===ring&&r.depth%2===1)].map(r=>({material,points:r.points,closed:true}))});
  }}return out;
 }
 const materialNames=typeof module==='object'&&module.exports?require('./materials.js'):root.SIMULATION_MATERIALS;
 function role(p,base,device){
  if(p.role)return p.role;
  if(p.material===10)return p.min<=base.min+1e-6?'기판':'활성 Si';
  if(p.material===11){
   if(device==='sadp')return '맨드릴';
   if(['mosfet','rcat','fdsoi','pdsoi','charge-trap'].includes(device))return '폴리실리콘 게이트';
   return '폴리실리콘';
  }
  if(p.material===16&&['wet','sf6','bosch','ale-har'].includes(device))return '하드마스크';
  if(p.material===30&&['sti','fin','locos'].includes(device))return '소자 분리막';
  if(p.material===30&&device==='sadp')return '스페이서';
  if(p.material===30&&device==='bosch')return '측벽 보호막';
  if(p.material===70&&['mosfet','pn-junction','rcat','fdsoi','pdsoi'].includes(device))return '컨택';
  if(p.material===0||p.material===1)return '마스크·폴리머';
  if([32,31,201].includes(p.material))return '유전체';
  if(p.material===79)return '금속 게이트';
  if([5,70,71,72,78,80,202].includes(p.material))return '금속 도전체';
  return materialNames?.[p.material]?.name||String(p.material);
 }
 function layout(parts,mode,gap,device){
  if(!parts.length||!Number.isFinite(gap)||gap<=0)return {shifts:parts.map(()=>0),labels:[]};
  const width=Math.max(...parts.map(p=>p.right))-Math.min(...parts.map(p=>p.left));
  // A wide, ultrathin dielectric is a real film. Only specks small in BOTH axes
  // can inherit another body's motion; all original meshes stay on screen.
  const main=parts.filter(p=>p.role||Math.max(p.right-p.left,p.max-p.min)>=width*.025);
  const anchors=main.length?main:parts,base=[...anchors].sort((a,b)=>a.min-b.min||a.center-b.center)[0];
  function distance(a,b){
   return Math.hypot(Math.max(0,a.left-b.right,b.left-a.right),Math.max(0,a.min-b.max,b.min-a.max));
  }
  const anchorSet=new Set(anchors),groups=new Map(),keys=[];
  for(const p of parts){
   let parent=p;
   if(!anchorSet.has(p)){
    const same=anchors.filter(a=>a.material===p.material),candidates=same.length?same:anchors;
    parent=candidates.reduce((a,b)=>distance(p,a)<=distance(p,b)?a:b);
   }
   const key=mode==='material'?parent.material:role(parent,base,device);
   if(!groups.has(key))groups.set(key,{key,min:Infinity,max:-Infinity,base:false});
   const g=groups.get(key);g.min=Math.min(g.min,p.min);g.max=Math.max(g.max,p.max);g.base||=parent===base;keys.push(key);
  }
  // Concentric channel, dielectric and gate have nearly identical centers.
  // Open those nested shells in assembly order, from channel outward.
  const shellOrder={'기판':0,'소자 분리막':1,'핀':2,'와이어 채널':2,'나노시트 채널':2,'게이트 절연막':3,'게이트':4};
  const useShellOrder=mode!=='material'&&[...groups.keys()].every(key=>Object.hasOwn(shellOrder,key));
  const ordered=[...groups.values()].sort((a,b)=>Number(b.base)-Number(a.base)||
   (useShellOrder?shellOrder[a.key]-shellOrder[b.key]:0)||(a.min+a.max)-(b.min+b.max)||a.min-b.min);
  const shifts=new Map();let top=-Infinity,previous=0;
  for(let i=0;i<ordered.length;i++){
   const g=ordered[i],shift=i?Math.max(previous+gap,top+gap-g.min):0;
   shifts.set(g.key,shift);
   top=g.max+shift;previous=shift;
  }
  return {shifts:keys.map(key=>shifts.get(key)),labels:ordered.map(g=>mode==='material'?(materialNames?.[g.key]?.name||String(g.key)):g.key)};
 }
 function offsets(parts,mode,gap,device){return layout(parts,mode,gap,device).shifts;}
 function explode(group,mode,gap,device){const plan=layout(group.children.map(m=>m.userData.part),mode,gap,device);group.children.forEach((m,i)=>m.position.z=plan.shifts[i]);return plan;}
 // Display finishes only: these do not change material IDs or process properties.
 function finish(id){
  if([5,70,71,72,78,79,80,202].includes(+id))return {roughness:.32,metalness:.62};
  if([10,11,13].includes(+id))return {roughness:.5,metalness:.12};
  if([0,1].includes(+id))return {roughness:.57,metalness:0};
  return {roughness:.63,metalness:0};
 }
 function smoothSides(geometry){
  const pos=geometry.attributes.position,n=geometry.attributes.normal,vertices=new Map();
  for(const g of geometry.groups.filter(g=>g.materialIndex===1))for(let i=g.start;i<g.start+g.count;i++){
   const key=[pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>v.toFixed(7)).join('|');
   if(!vertices.has(key))vertices.set(key,[]);vertices.get(key).push({i,x:n.getX(i),y:n.getY(i),z:n.getZ(i)});
  }
  for(const list of vertices.values())for(const a of list){let x=0,y=0,z=0;for(const b of list)if(a.x*b.x+a.y*b.y+a.z*b.z>.707){x+=b.x;y+=b.y;z+=b.z;}const length=Math.hypot(x,y,z);if(length)n.setXYZ(a.i,x/length,y/length,z/length);}
  n.needsUpdate=true;
 }
 function build(THREE,polygons,depth,color){
  const group=new THREE.Group(),materials=new Map();for(const p of polygons){if(!materials.has(p.material))materials.set(p.material,[]);materials.get(p.material).push(p)}
  for(const [id,ps] of materials){const rs=rings(ps);for(const ring of rs.filter(r=>r.depth%2===0)){
   const shape=new THREE.Shape(ring.points.map(p=>new THREE.Vector2(...p)));
   for(const hole of rs.filter(r=>r.parent===ring&&r.depth%2===1))shape.holes.push(new THREE.Path(hole.points.map(p=>new THREE.Vector2(...p))));
   const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:1});geometry.rotateX(Math.PI/2);geometry.translate(0,depth/2,0);geometry.computeVertexNormals();
   smoothSides(geometry);
   const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:color(id),...finish(id),envMapIntensity:.7,side:THREE.DoubleSide,transparent:false,opacity:1,depthWrite:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));
   mesh.castShadow=true;mesh.receiveShadow=true;
   const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,38),new THREE.LineBasicMaterial({color:new THREE.Color(color(id)).multiplyScalar(.48),transparent:true,opacity:.3,depthWrite:false}));edge.userData.surfaceOutline=true;mesh.add(edge);
   mesh.userData.materialId=id;mesh.userData.part=describe(id,ring);group.add(mesh);
  }}return group;
 }
 function referenceEdges(part,alongX){
  const vertices=[],world=(p,v)=>alongX?[v,p[0],p[1]]:[p[0],v,p[1]];
  for(const ring of part.polygons){
   const points=ring.points.slice(),first=points[0],last=points.at(-1);
   if(first[0]===last[0]&&first[1]===last[1])points.pop();
   for(let i=0;i<points.length;i++){
    const p=points[i],next=points[(i+1)%points.length],prev=points[(i+points.length-1)%points.length];
    for(const v of [part.lo,part.hi])vertices.push(...world(p,v),...world(next,v));
    const a=[p[0]-prev[0],p[1]-prev[1]],b=[next[0]-p[0],next[1]-p[1]];
    if(a[0]*b[0]+a[1]*b[1]<Math.cos(38*Math.PI/180)*Math.hypot(...a)*Math.hypot(...b))vertices.push(...world(p,part.lo),...world(p,part.hi));
   }
  }
  return vertices;
 }
 const api={inside,area,rings,parts,layout,offsets,explode,finish,build,referenceEdges};if(typeof module==='object'&&module.exports)module.exports=api;else root.SolidGeometry=api;
})(typeof window==='object'?window:globalThis);
