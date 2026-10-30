const {chromium}=require('../.runtime/browser-qa/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const p=await b.newPage({viewport:{width:1440,height:960}}),errors=[];p.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url())});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'||m.text().includes('renderer fallback'))errors.push(m.text()+JSON.stringify(m.location()))});
try{
 await p.goto((process.env.QA_BASE||'http://127.0.0.1:3029')+'/#mosfet');await p.waitForFunction(()=>typeof current!=='undefined'&&current?.frames?.length&&!busy,null,{timeout:120000});
 await p.locator('#view25d').click();await p.waitForFunction(()=>document.getElementById('section').dataset.renderer==='webgl',null,{timeout:30000});await p.waitForTimeout(700);await p.locator('.viewer').screenshot({path:'.runtime/studio-3d-mosfet.png'});
 await p.locator('#view2d').click();await p.waitForTimeout(200);await p.locator('.viewer').screenshot({path:'.runtime/studio-2d-mosfet.png'});
 const ids=await p.evaluate(async()=> (await(await fetch('/api/reverse-catalog')).json()).targets.map(t=>t.id));
 for(const id of ids){
  await p.evaluate(async id=>{await reverseLab.select(id,true);await reverseLab.loadCandidate({targetId:id,name:'Render QA',steps:reverseLab.context().reference.steps})},id);
  await p.waitForFunction(()=>reverseLab.context().result&&!reverseLab.context().pending);
  const original=await p.evaluate(()=>JSON.stringify(reverseLab.context().frame));
  await p.locator('#r25d').click();await p.waitForFunction(()=>document.getElementById('r-current').dataset.renderer==='webgl');
  assert(await p.evaluate(()=>SolidView.get('r-current').data===reverseLab.context().frame),id+' same source geometry');
  const controls=p.locator('.reverse-view .explode-controls');await controls.locator('.explode-toggle').click();
  for(const mode of ['layer','material']){
   await controls.locator('select').selectOption(mode);
   const within=await p.evaluate(()=>{
    const s=SolidView.get('r-current'),polys=s.data.polygons.map(p=>({...p,points:ProcessExtrusion.clipPolygon(p.points,s.bounds)})).filter(p=>p.points.length>=3),parts=SolidGeometry.parts(polys),ds=SolidGeometry.offsets(parts,s.explodeMode,s.explodeGap),c=document.getElementById('r-current');
    return parts.every((part,i)=>part.polygons.every(p=>p.points.every(([x,z])=>[-s.depth/2,s.depth/2].every(y=>{const [u,v]=s.projectWorld([x,y,z+ds[i]]);return u>=-1&&u<=c.clientWidth+1&&v>=-1&&v<=c.clientHeight+1}))));
   });
   assert(within,id+' '+mode+' fits viewport');
  }
  await controls.locator('.explode-reset').click();
  if(['finfet','mbcfet','bosch','locos'].includes(id))await p.locator('.reverse-view').screenshot({path:'.runtime/studio-3d-'+id+'.png'});
  await p.locator('#r2d').click();
  for(const axis of ['X','Z','Y']){await p.locator('.reverse-view [data-axis="'+axis+'"]').click();assert(await p.evaluate(()=>SolidView.get('r-current').data===reverseLab.context().frame),id+' '+axis+' same source');}
  assert.equal(await p.evaluate(()=>JSON.stringify(reverseLab.context().frame)),original,id+' visualization must not mutate calculation');
  console.log(id+' 2D/3D, three slices, two exploded modes passed');
 }
 await p.locator('#r25d').click();const c=p.locator('#r-current'),bounds=await c.boundingBox();await p.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await p.mouse.down();await p.mouse.move(bounds.x+bounds.width/2+45,bounds.y+bounds.height/2+15);await p.mouse.up();await p.mouse.wheel(0,-180);await c.focus();await p.keyboard.press('0');assert.equal(await p.evaluate(()=>SolidView.get('r-current').zoom),1);
 for(const width of [768,390]){await p.setViewportSize({width,height:900});await p.waitForTimeout(300);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await p.locator('.reverse-view').screenshot({path:'.runtime/studio-mobile-'+width+'.png'});}
 assert.deepEqual(errors,[]);console.log('All '+ids.length+' examples: synchronized geometry, slices, exploded fit, rotation, zoom, responsive widths; no GPU fallback or runtime errors.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});


