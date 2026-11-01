'use strict';
(() => {
 let engine=null,failed=false,pending=null;const instances=new Map();
 function studio(T,renderer,scene){
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  scene.add(new T.HemisphereLight(0xf4f7ff,0x8292ac,1.1));
  const key=new T.DirectionalLight(0xfff8ed,2.7),fill=new T.DirectionalLight(0xdce9ff,.95),rim=new T.DirectionalLight(0xffffff,1.6);
  key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.00015;key.shadow.normalBias=.0006;
  scene.add(key,key.target,fill,fill.target,rim,rim.target);
  // Procedural studio reflections; no external HDRI or additional network dependency.
  const width=128,height=64,pixels=new Float32Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const u=x/width,v=y/height,softbox=Math.exp(-(((u-.23)/.08)**2+((v-.3)/.18)**2))*2.5+Math.exp(-(((u-.76)/.12)**2+((v-.37)/.25)**2))*1.5,base=.18+.48*(1-v),i=(y*width+x)*4;
   pixels[i]=base+softbox;pixels[i+1]=base*1.015+softbox;pixels[i+2]=base*1.06+softbox;pixels[i+3]=1;
  }
  const texture=new T.DataTexture(pixels,width,height,T.RGBAFormat,T.FloatType);texture.mapping=T.EquirectangularReflectionMapping;texture.needsUpdate=true;
  const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(texture);scene.environment=environment.texture;texture.dispose();pmrem.dispose();
  const floor=new T.Mesh(new T.PlaneGeometry(1,1),new T.ShadowMaterial({color:0x52627c,opacity:.16}));floor.receiveShadow=true;scene.add(floor);
  return {key,fill,rim,floor,environment};
 }
 function fitStudio(r,box,minimap){
  const T=engine;if(box.isEmpty())return;
  const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),radius=Math.max(size.x,size.y,size.z,.2),lights=r.studio;
  for(const [light,direction] of [[lights.key,[-2,-3,5]],[lights.fill,[3,-1,2]],[lights.rim,[0,3,4]]]){light.position.copy(center).add(new T.Vector3(...direction).multiplyScalar(radius));light.target.position.copy(center);light.target.updateMatrixWorld();}
  const cam=lights.key.shadow.camera;cam.left=cam.bottom=-radius*1.7;cam.right=cam.top=radius*1.7;cam.near=.01;cam.far=radius*15;cam.updateProjectionMatrix();
  lights.floor.position.set(center.x,center.y,box.min.z-radius*.008);lights.floor.scale.set(radius*5,radius*5,1);lights.floor.visible=!minimap;
  r.renderer.shadowMap.enabled=!minimap;r.renderer.shadowMap.needsUpdate=true;
 }
 function render(canvas,s,style){
  if(failed)return false;
  if(!engine){if(!pending){const refresh=()=>{for(const id of ['section','r-current'])window.SolidView?.get(id)?.redraw?.()};pending=import('/vendor/three/three.module.js').then(m=>{engine=m;refresh()}).catch(()=>{failed=true;refresh()});}return false;}
  const T=engine;
  try{
   let r=instances.get(canvas.id);if(!r){const renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setClearColor('#fbfcff',1);renderer.setPixelRatio(Math.min(devicePixelRatio,2));const scene=new T.Scene();r={renderer,scene,studio:studio(T,renderer,scene),camera:new T.OrthographicCamera(),source:null};instances.set(canvas.id,r);}
   const w=canvas.clientWidth,h=canvas.clientHeight,b=s.bounds;
   const key=b.join('|')+'|'+s.depth+'|'+s.doping;
   if(r.source!==s.data||r.key!==key){if(r.group){r.scene.remove(r.group);r.group.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();if(o.material)o.material.dispose()});}
    const polys=s.data.polygons.map(p=>({...p,points:ProcessExtrusion.clipPolygon(p.points,b)})).filter(p=>p.points.length>=3);r.group=SolidGeometry.build(T,polys,s.depth,id=>style(id).color);r.scene.add(r.group);r.source=s.data;r.key=key;r.lightingKey=null;
    if(s.doping&&s.data.concentration)for(const mesh of r.group.children){if(![10,11,13].includes(mesh.userData.materialId))continue;
     const bitmap=DopantView.texture(s.data,b,style(mesh.userData.materialId).color,undefined,mesh.userData.materialId),texture=new T.CanvasTexture(bitmap);texture.colorSpace=T.SRGBColorSpace;
     const pos=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)-b[0])/(b[1]-b[0]),(pos.getZ(i)-b[2])/(b[3]-b[2]));uv.needsUpdate=true;
     mesh.material.map=texture;mesh.material.color.set('#ffffff');mesh.material.needsUpdate=true;
    }
   }
   const maskKey=JSON.stringify([s.mask,s.depth,s.exploded]);
   if(maskKey!==r.maskKey){if(r.mask){r.scene.remove(r.mask);r.mask.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}r.mask=new T.Group();r.maskKey=maskKey;
    if(s.mask&&!s.exploded){const m=s.mask;for(const [a,e] of m.solid){const box=new T.Mesh(new T.BoxGeometry(e-a,s.depth,m.t),new T.MeshStandardMaterial({color:'#717e91',roughness:.48,metalness:.25}));box.position.set((a+e)/2,0,m.y+m.t/2);box.castShadow=true;box.receiveShadow=true;r.mask.add(box);}
     if(m.arrows)for(const ray of PhotoPreview.rays(m)){const arrow=new T.ArrowHelper(new T.Vector3(0,0,-1),new T.Vector3(ray.x,-s.depth*.1,ray.start),Math.max(.001,ray.start-ray.end),ray.blocked?0x7d8798:m.species==='B'?0xc2185b:m.species?0x1255cd:0xc99b35,.025,.012);r.mask.add(arrow);}
    }r.scene.add(r.mask);
   }
   if(r.w!==w||r.h!==h){r.renderer.setSize(w,h,false);r.w=w;r.h=h;}
   if(!w||!h)return false;
   const planeKey=JSON.stringify([s.miniMapPlane,b,s.depth]);
   if(r.planeKey!==planeKey){if(r.plane){r.scene.remove(r.plane);r.plane.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}r.plane=new T.Group();r.planeKey=planeKey;
    if(s.miniMapPlane){const axis=s.miniMapPlane.axis,size=[b[1]-b[0],s.depth,b[3]-b[2]],at=[(b[0]+b[1])/2,0,(b[2]+b[3])/2],i=axis==='X'?0:axis==='Y'?1:2;size[i]=.003;at[i]=s.miniMapPlane.at;
     const geometry=new T.BoxGeometry(...size),plane=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0xe19c36,transparent:true,opacity:.3,depthTest:false,depthWrite:false}));plane.position.set(...at);plane.renderOrder=10;r.plane.add(plane);
     const edge=new T.LineSegments(new T.EdgesGeometry(geometry),new T.LineBasicMaterial({color:0xb46b15,depthTest:false}));edge.position.copy(plane.position);edge.renderOrder=11;r.plane.add(edge);
    }r.scene.add(r.plane);
   }
   SolidGeometry.explode(r.group,s.explodeMode,s.exploded?s.explodeGap:0);
   const box=new T.Box3().setFromObject(r.group);if(r.mask.children.length)box.union(new T.Box3().setFromObject(r.mask));const center=box.isEmpty()?new T.Vector3():box.getCenter(new T.Vector3()),aspect=w/h,camera=r.camera;
   const lightingKey=[...box.min,...box.max,s.exploded,s.explodeMode,s.explodeGap,maskKey].join('|');if(r.lightingKey!==lightingKey){fitStudio(r,box,s.isMinimap);r.lightingKey=lightingKey;}
   camera.up.set(0,0,1);camera.position.copy(center).add(new T.Vector3(Math.sin(s.yaw)*Math.cos(s.pitch),-Math.cos(s.yaw)*Math.cos(s.pitch),Math.sin(s.pitch)).multiplyScalar(Math.max(8,box.getSize(new T.Vector3()).length()*3)));camera.lookAt(center);camera.updateMatrixWorld();
   let extentX=.01,extentY=.01;
   if(!box.isEmpty())for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const point=new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);extentX=Math.max(extentX,Math.abs(point.x));extentY=Math.max(extentY,Math.abs(point.y));}
   const span=Math.max(extentY,extentX/aspect)*1.1/s.zoom;
   camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;camera.near=.001;camera.far=100;camera.updateProjectionMatrix();
   const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1),shift=right.multiplyScalar(-s.panX/w*span*aspect*2).add(up.multiplyScalar(s.panY/h*span*2));camera.position.add(shift);camera.lookAt(center.clone().add(shift));
   r.renderer.render(r.scene,camera);const dpr=Math.min(devicePixelRatio,2);canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.drawImage(r.renderer.domElement,0,0,w,h);
   if(!s.isMinimap){c.font='11px ProcessSans, sans-serif';c.fillStyle='#66758b';c.fillText('드래그 회전  ·  Shift 이동  ·  휠 확대',16,h-16);}
   s.projectWorld=p=>{const v=new T.Vector3(...p).project(camera);return[(v.x+1)*w/2,(1-v.y)*h/2]};
   s.project=(x,z)=>{const v=new T.Vector3(x,0,z).project(camera);return[(v.x+1)*w/2,(1-v.y)*h/2]};
   if(!s.isMinimap){
    const origin=s.projectWorld(center.toArray()),ox=w-44,oy=h-42;c.font='600 10px ProcessSans, sans-serif';c.lineWidth=1.6;
    for(const [label,axis,color] of [['X',[1,0,0],'#b85b66'],['Y',[0,1,0],'#438d86'],['Z',[0,0,1],'#4e71bd']]){const point=s.projectWorld(center.clone().add(new T.Vector3(...axis)).toArray()),dx=point[0]-origin[0],dy=point[1]-origin[1],length=Math.max(Math.hypot(dx,dy),1);c.strokeStyle=c.fillStyle=color;c.beginPath();c.moveTo(ox,oy);c.lineTo(ox+dx/length*19,oy+dy/length*19);c.stroke();c.fillText(label,ox+dx/length*27-3,oy+dy/length*27+3);}
   }
   canvas.dataset.renderer='webgl';
   if(s.live&&!s.exploded)window.SolidView.particles(c,s,w,h,s.project);
   return true;
  }catch(e){failed=true;console.warn('3D renderer fallback:',e.message);return false;}
 }
 window.SolidGPU={render};
})();
