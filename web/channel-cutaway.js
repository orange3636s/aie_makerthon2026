/* Gate-region cutaways. X and Z dimensions are read from the current native
 * section. The transverse profile is a teaching assumption, in micrometres. */
(function(root){
 'use strict';
 const titles={finfet:'FinFET · 3면 게이트',gaafet:'GAA · 나노와이어',mbcfet:'MBCFET · 나노시트',cfet:'CFET · 하부 n / 상부 p','charge-trap':'SONOS · 전하 저장층',fdsoi:'FD-SOI · 얇은 Si 몸체',pdsoi:'PD-SOI · 두꺼운 Si 몸체'};
 function rect(left,right,bottom,top){return [[left,bottom],[right,bottom],[right,top],[left,top]];}
 function ellipse(width,bottom,top){
  return Array.from({length:48},(_,i)=>{const a=2*Math.PI*i/48;return [width*Math.cos(a),(top+bottom)/2+(top-bottom)/2*Math.sin(a)];});
 }
 function build(frame,id,depth,intervals){
  if(!titles[id])return null;
  const groups=new Map();
  for(const p of frame.polygons){if(!groups.has(p.material))groups.set(p.material,[]);groups.get(p.material).push(p);}
  const spans=(m,axis,at)=>intervals(groups.get(m)||[],axis,at);
  const center=m=>spans(m,0,0);
  const silicon=center(10),oxide=center(30),hiK=center(32);
  const parts=[],labels=[],width=depth/2;
  let length=0,caption=titles[id];
  function part(material,lo,hi,rings,role){
   if(hi-lo<1e-6||!rings.length)return;
   parts.push({material,lo,hi,polygons:rings.map(points=>({material,role,closed:true,points:[...points,points[0]]}))});
  }
  const gateSpan=(m,z)=>spans(m,1,z).find(([a,b])=>a<0&&b>0&&b-a<1.2);
  const near=(a,b)=>Math.abs(a-b)<.003;
  const layers=[];
  if(['fdsoi','pdsoi','charge-trap'].includes(id)){
   const poly=center(11).at(-1);if(!poly)return null;
   const gate=gateSpan(11,(poly[0]+poly[1])/2);if(!gate)return null;
   const body=silicon.at(-1);if(!body)return null;
   length=Math.min(.77,Math.max(.42,(gate[1]-gate[0])*1.9));
   const bodyTop=body[1],isSOI=id!=='charge-trap';
   if(isSOI){
    const box=oxide.find(q=>near(q[1],body[0]));if(!box)return null;
    part(10,-length,length,[rect(-width,width,box[0]-.11,box[0])],'기판');
    part(30,-length,length,[rect(-width,width,...box)],'매몰 산화막');
    caption+=' · 상부 Si '+Math.round((bodyTop-body[0])*1000)+' nm / BOX '+Math.round((box[1]-box[0])*1000)+' nm';
    labels.push({text:'BOX',x:0,z:(box[0]+box[1])/2},{text:'Base Si',x:0,z:box[0]-.055});
    labels.push({text:'G',x:(gate[0]+gate[1])/2,z:(poly[0]+poly[1])/2});
    if(frame.concentration?.fields?.net_active?.some(v=>Math.abs(v)>1e17)){
     labels.push({text:'S',x:(-length+gate[0])/2,z:bodyTop,above:true},{text:'D',x:(length+gate[1])/2,z:bodyTop,above:true});
    }
   }
   part(10,-length,length,[rect(-width,width,isSOI?body[0]:bodyTop-.18,bodyTop)],'활성 Si');
   for(const m of [30,16,11])for(const [z0,z1] of center(m)){
    if(z0<bodyTop-.001||z1>poly[1]+.001||z1<=z0)continue;
    const span=spans(m,1,(z0+z1)/2).find(([a,b])=>a<=0&&b>=0);
    if(span)part(m,Math.max(span[0],gate[0]),Math.min(span[1],gate[1]),[rect(-width,width,z0,z1)],(m===11?'게이트':isSOI?'게이트 절연막':'전하 저장 적층막'));
   }
  }else{
   for(const ch of silicon){
    const upper=hiK.find(q=>near(q[0],ch[1])),lower=hiK.find(q=>near(q[1],ch[0]));
    if(!upper||(!lower&&id!=='finfet'))continue;
    const gm=[79,70].find(m=>center(m).some(q=>near(q[0],upper[1])));if(!gm)continue;
    const top=center(gm).find(q=>near(q[0],upper[1])),gate=gateSpan(gm,(top[0]+top[1])/2);
    const underside=lower&&center(gm).find(q=>near(q[1],lower[0]));
    if(gate&&(id==='finfet'||underside))layers.push({ch,upper,lower,gm,top,gate,underside});
   }
   if(!layers.length)return null;
   length=Math.min(.77,Math.max(.42,...layers.map(l=>(l.gate[1]-l.gate[0])*1.9)));
   const first=layers[0],fin=id==='finfet',wire=id==='gaafet';
   const finFloor=fin?spans(30,0,-.65).find(q=>q[0]<first.ch[1]&&q[1]<first.ch[1]+.001)?.[1]:undefined;
   const floor=fin?(finFloor??first.ch[1]-.10):first.underside[0];
   const half=fin?Math.min(.04,width*.22):wire?(first.ch[1]-first.ch[0])/2:Math.min(.135,width*.48);
   if(fin){
    part(10,-length,length,[rect(-width,width,floor-.11,floor-.055)],'기판');
    part(10,-length,length,[rect(-half,half,floor-.055,floor)],'핀');
    for(const [a,b] of [[-width,-half],[half,width]])part(30,-length,length,[rect(a,b,floor-.055,floor)],'소자 분리막');
   }else{
    const liner=hiK.find(q=>near(q[1],floor));
    const substrateTop=liner?liner[0]:floor;
    part(10,-length,length,[rect(-width,width,substrateTop-.11,substrateTop)],'기판');
    if(liner)part(32,...first.gate,[rect(-width*.76,width*.76,...liner)],(id==='cfet'?'하부 nFET':'게이트 절연막'));
   }
   for(const gm of new Set(layers.map(l=>l.gm))){
    const tierRole=id==='cfet'?(gm===70?'상부 pFET':'하부 nFET'):null;
    const tier=layers.filter(l=>l.gm===gm),ringHoles=[];
    let bottom=Infinity,top=-Infinity,gate=tier[0].gate;
    for(const l of tier){
     const [z0,z1]=fin?[floor,l.ch[1]]:l.ch,t=l.upper[1]-l.upper[0];
     const h=wire?(z1-z0)/2:half,outerH=h+t;
     const profile=(w,a,b)=>wire?ellipse(w,a,b):rect(-w,w,a,b);
     const core=profile(h,z0,z1),outer=profile(outerH,fin?floor:l.lower[0],l.upper[1]);
     part(10,-length,length,[core],tierRole||(fin?'핀':wire?'와이어 채널':'나노시트 채널'));
     if(fin){
      const arch=(outside,inside,high,low)=>[[-outside,floor],[-outside,high],[outside,high],[outside,floor],[inside,floor],[inside,low],[-inside,low],[-inside,floor]];
      part(32,...gate,[arch(outerH,h,l.upper[1],z1)],'게이트 절연막');
      part(gm,...gate,[arch(Math.max(outerH+t,width*.74),outerH,l.top[1],l.upper[1])],'게이트');
     }else{
      part(32,...gate,[outer,core],tierRole||'게이트 절연막');ringHoles.push(outer);
      bottom=Math.min(bottom,l.underside[0]);top=Math.max(top,l.top[1]);
     }
    }
    if(!fin)part(gm,...gate,[rect(-Math.max(width*.76,half+.035),Math.max(width*.76,half+.035),Math.max(floor,bottom),top),...ringHoles],tierRole||'게이트');
   }
   if(id==='cfet'&&layers.length>=2){
    const floorTop=Math.max(...layers.filter(l=>l.gm===79).map(l=>l.top[1]));
    const ceiling=Math.min(...layers.filter(l=>l.gm===70).map(l=>l.underside[0]));
    const barrier=oxide.filter(q=>q[0]>=floorTop-.001&&q[1]<=ceiling+.001).sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0];
    if(barrier){
     const plug=center(80).find(q=>near(q[0],floorTop)&&near(q[1],barrier[0]));
     if(plug){const span=gateSpan(80,(plug[0]+plug[1])/2);if(span)part(80,...span,[rect(-half,half,...plug)],'하부 컨택');}
     part(30,-length,length,[rect(-width,width,...barrier)],'층간 절연막');
     const body=silicon.find(q=>near(q[0],barrier[1])&&q[1]<=ceiling);
     if(body){
      part(10,-length,length,[rect(-width,width,...body)],'상부 pFET');
      const liner=hiK.find(q=>near(q[0],body[1])&&near(q[1],ceiling));
      const upper=layers.find(l=>l.gm===70);
      if(liner&&upper)part(32,...upper.gate,[rect(-width*.76,width*.76,...liner)],'상부 pFET');
     }
    }
   }
  }
  const zs=parts.flatMap(p=>p.polygons.flatMap(r=>r.points.map(v=>v[1])));
  return {parts,labels,caption,bounds:[-length,length,Math.min(...zs),Math.max(...zs)]};
 }
 function section(model,axis,at,depth,intervals){
  const polys=[];
  for(const p of model.parts){
   if(axis==='X'){if(at>=p.lo&&at<=p.hi)polys.push(...p.polygons);continue;}
   for(const [a,b] of intervals(p.polygons,axis==='Y'?0:1,at))polys.push({material:p.material,closed:true,points:rect(p.lo,p.hi,a,b)});
  }
  const b=model.bounds;
  return {polygons:polys,bounds:axis==='X'?[-depth/2,depth/2,b[2],b[3]]:axis==='Z'?[b[0],b[1],-depth/2,depth/2]:b,labels:axis==='X'?['Y','Z']:axis==='Z'?['X','Y']:['X','Z']};
 }
 const api={build,section};if(typeof module==='object'&&module.exports)module.exports=api;else root.ChannelCutaway=api;
})(typeof window==='object'?window:globalThis);
