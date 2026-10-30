'use strict';
(() => {
 let engine=null,failed=false,pending=null;const instances=new Map();
 function render(canvas,s,style){
  if(failed)return false;
  if(!engine){if(!pending)pending=import('/vendor/three/three.module.js').then(m=>{engine=m;s.redraw()}).catch(()=>{failed=true;s.redraw()});return false;}
  const T=engine;
  try{
   let r=instances.get(canvas.id);if(!r){const renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setClearColor('#ffffff',1);renderer.setPixelRatio(Math.min(devicePixelRatio,2));const scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0xb8c7cf,2.2));const light=new T.DirectionalLight(0xffffff,2.3);light.position.set(-2,-3,5);scene.add(light);r={renderer,scene,camera:new T.OrthographicCamera(),source:null};instances.set(canvas.id,r);}
   const w=canvas.clientWidth,h=canvas.clientHeight,b=s.bounds;
   const key=b.join('|')+'|'+s.depth;
   if(r.source!==s.data||r.key!==key){if(r.group){r.scene.remove(r.group);r.group.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose()});}
    const polys=s.data.polygons.map(p=>({...p,points:ProcessExtrusion.clipPolygon(p.points,b)})).filter(p=>p.points.length>=3);r.group=SolidGeometry.build(T,polys,s.depth,id=>style(id).color);r.scene.add(r.group);r.source=s.data;r.key=key;
   }
   if(r.w!==w||r.h!==h){r.renderer.setSize(w,h,false);r.w=w;r.h=h;}
   if(!w||!h)return false;
   SolidGeometry.explode(r.group,s.explodeMode,s.exploded?s.explodeGap:0);
   const box=new T.Box3().setFromObject(r.group),center=box.isEmpty()?new T.Vector3():box.getCenter(new T.Vector3()),aspect=w/h,camera=r.camera;
   camera.up.set(0,0,1);camera.position.copy(center).add(new T.Vector3(Math.sin(s.yaw)*Math.cos(s.pitch),-Math.cos(s.yaw)*Math.cos(s.pitch),Math.sin(s.pitch)).multiplyScalar(8));camera.lookAt(center);camera.updateMatrixWorld();
   let extentX=.01,extentY=.01;
   if(!box.isEmpty())for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const point=new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);extentX=Math.max(extentX,Math.abs(point.x));extentY=Math.max(extentY,Math.abs(point.y));}
   const span=Math.max(extentY,extentX/aspect)*1.16/s.zoom;
   camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;camera.near=.001;camera.far=100;camera.updateProjectionMatrix();
   const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1),shift=right.multiplyScalar(-s.panX/w*span*aspect*2).add(up.multiplyScalar(s.panY/h*span*2));camera.position.add(shift);camera.lookAt(center.clone().add(shift));
   r.renderer.render(r.scene,camera);const dpr=Math.min(devicePixelRatio,2);canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.drawImage(r.renderer.domElement,0,0,w,h);
   c.font='11px ProcessSans, sans-serif';c.fillStyle='#5a7080';c.fillText('회전: 드래그  ·  이동: Shift + 드래그',16,h-16);
   s.project=(x,z)=>{const v=new T.Vector3(x,0,z).project(camera);return[(v.x+1)*w/2,(1-v.y)*h/2]};
   if(s.live&&!s.exploded)window.SolidView.particles(c,s,w,h,s.project);
   return true;
  }catch(e){failed=true;console.warn('3D renderer fallback:',e.message);return false;}
 }
 window.SolidGPU={render};
})();
