'use strict';
(function(root){
 function inside(p,ring){let v=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])v=!v;}return v;}
 function area(r){return Math.abs(r.reduce((sum,p,i)=>{const q=r[(i+1)%r.length];return sum+p[0]*q[1]-q[0]*p[1]},0)/2)}
 function rings(polys){const a=polys.map(p=>({points:p.points,area:area(p.points),parent:null,depth:0})).filter(r=>r.area>1e-10).sort((a,b)=>b.area-a.area);for(let i=0;i<a.length;i++){for(let j=i-1;j>=0;j--)if(inside(a[i].points[0],a[j].points)){a[i].parent=a[j];a[i].depth=a[j].depth+1;break;}}return a;}
 // Each exterior ring and its holes move as one closed body. This is a view transform only.
 function parts(polygons){
  const materials=new Map(),out=[];
  for(const p of polygons){if(!materials.has(p.material))materials.set(p.material,[]);materials.get(p.material).push(p)}
  for(const [material,ps] of materials){const rs=rings(ps);for(const ring of rs.filter(r=>r.depth%2===0)){
   const zs=ring.points.map(p=>p[1]);out.push({material,min:Math.min(...zs),max:Math.max(...zs),center:(Math.min(...zs)+Math.max(...zs))/2,polygons:[ring,...rs.filter(r=>r.parent===ring&&r.depth%2===1)].map(r=>({material,points:r.points,closed:true}))});
  }}return out;
 }
 function offsets(parts,mode,gap){
  if(!Number.isFinite(gap)||gap<=0)return parts.map(()=>0);
  const groups=[];
  // Keep symmetric pieces in one layer; separate complete closed solids, including holes.
  for(const p of [...parts].sort((a,b)=>a.center-b.center)){
   let g=groups.find(g=>mode==='material'?g.key===p.material:Math.abs(g.center-p.center)<1e-5);
   if(!g){g={key:p.material,center:p.center,parts:[],min:Infinity,max:-Infinity};groups.push(g)}
   g.parts.push(p);g.min=Math.min(g.min,p.min??p.center);g.max=Math.max(g.max,p.max??p.center);
  }
  for(const g of groups)g.center=g.parts.reduce((sum,p)=>sum+p.center,0)/g.parts.length;
  groups.sort((a,b)=>a.center-b.center||a.min-b.min);
  const shifts=new Map();let top=-Infinity,previous=0;
  for(let i=0;i<groups.length;i++){
   const g=groups[i],shift=i?Math.max(previous+gap,top+gap-g.min):0;
   for(const p of g.parts)shifts.set(p,shift);
   top=g.max+shift;previous=shift;
  }
  return parts.map(p=>shifts.get(p));
 }
 function explode(group,mode,gap){const ps=group.children.map(m=>m.userData.part),ds=offsets(ps,mode,gap);group.children.forEach((m,i)=>m.position.z=ds[i]);}
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
   mesh.userData.materialId=id;const zs=ring.points.map(p=>p[1]);mesh.userData.part={material:id,min:Math.min(...zs),max:Math.max(...zs),center:(Math.min(...zs)+Math.max(...zs))/2};group.add(mesh);
  }}return group;
 }
 const api={inside,area,rings,parts,offsets,explode,finish,build};if(typeof module==='object'&&module.exports)module.exports=api;else root.SolidGeometry=api;
})(typeof window==='object'?window:globalThis);
