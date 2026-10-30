const {chromium}=require('../.runtime/browser-qa/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 async function hasStructure(label){
  await p.waitForFunction(()=>reverseLab.active&&reverseLab.context().reference);
  await p.waitForTimeout(300);
  const count=await p.locator('#r-target').evaluate(c=>{
   const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;
   for(let i=0;i<a.length;i+=4)if(a[i+3]>0&&a[i]>40&&a[i+1]>140&&a[i+2]>140&&a[i+1]-a[i]>20)n++;
   return n;
  });
  assert(count>100,label+': target must contain filled material regions, got '+count);
 }
 try{
  await p.goto((process.env.QA_BASE||'http://127.0.0.1:3029')+'/#mosfet');
  await p.waitForFunction(()=>typeof current!=='undefined'&&current?.frames?.length&&!busy,null,{timeout:120000});
  await p.locator('#reverse-mode').click();await hasStructure('initial entry');
  await p.locator('#reverse-mode').click();await hasStructure('cached reference re-entry');
  await p.evaluate(()=>{draw(document.getElementById('r-target'),null,null);reverseLab.redraw()});
  await hasStructure('loading placeholder invalidates cached bitmap');
  await p.locator('.design-brief summary').click();
  await p.locator('#reverse-mode').click();
  await p.waitForFunction(()=>reverseLab.context().reference);
  await p.locator('.design-brief summary').click();await hasStructure('reopen collapsed brief');
  await p.locator('.design-brief').screenshot({path:'.runtime/target-thumbnail-fixed.png'});
  assert.deepEqual(errors,[]);console.log('Target thumbnail: initial, cached re-entry and collapsed brief reopening passed.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

