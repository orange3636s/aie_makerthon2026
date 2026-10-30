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
   const zs=ring.points.map(p=>p[1]);out.push({material,center:(Math.min(...zs)+Math.max(...zs))/2,polygons:[ring,...rs.filter(r=>r.parent===ring&&r.depth%2===1)].map(r=>({material,points:r.points,closed:true}))});
  }}return out;
 }
 function offsets(parts,mode,gap){
  if(!Number.isFinite(gap)||gap<=0)return parts.map(()=>0);
  const centers=new Map();for(const p of parts){const key=mode==='material'?p.material:p;const v=centers.get(key)||[];v.push(p.center);centers.set(key,v)}
  const sorted=[...centers].map(([key,v])=>({key,z:v.reduce((a,b)=>a+b,0)/v.length})).sort((a,b)=>a.z-b.z),ranks=new Map();let rank=-1,last=-Infinity;
  for(const item of sorted){if(item.z-last>1e-5||mode==='material')rank++;ranks.set(item.key,rank);last=item.z;}
  return parts.map(p=>ranks.get(mode==='material'?p.material:p)*gap);
 }
 function explode(group,mode,gap){const ps=group.children.map(m=>m.userData.part),ds=offsets(ps,mode,gap);group.children.forEach((m,i)=>m.position.z=ds[i]);}
 function build(THREE,polygons,depth,color){
  const group=new THREE.Group(),materials=new Map();for(const p of polygons){if(!materials.has(p.material))materials.set(p.material,[]);materials.get(p.material).push(p)}
  for(const [id,ps] of materials){const rs=rings(ps);for(const ring of rs.filter(r=>r.depth%2===0)){
   const shape=new THREE.Shape(ring.points.map(p=>new THREE.Vector2(...p)));
   for(const hole of rs.filter(r=>r.parent===ring&&r.depth%2===1))shape.holes.push(new THREE.Path(hole.points.map(p=>new THREE.Vector2(...p))));
   const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:1});geometry.rotateX(Math.PI/2);geometry.translate(0,depth/2,0);geometry.computeVertexNormals();
   const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:color(id),roughness:.72,metalness:0,side:THREE.DoubleSide,transparent:false,opacity:1,depthWrite:true}));mesh.userData.materialId=id;const zs=ring.points.map(p=>p[1]);mesh.userData.part={material:id,center:(Math.min(...zs)+Math.max(...zs))/2};group.add(mesh);
  }}return group;
 }
 const api={inside,area,rings,parts,offsets,explode,build};if(typeof module==='object'&&module.exports)module.exports=api;else root.SolidGeometry=api;
})(typeof window==='object'?window:globalThis);
