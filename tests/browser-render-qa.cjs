const {chromium}=require('../.runtime/browser-qa/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const out='.runtime/browser-render-qa';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(20000);
 const report={examples:[],errors:[],layout:[]};page.on('pageerror',e=>report.errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:3024/#mosfet');await page.waitForFunction(()=>window.reverseLab&&typeof busy!=='undefined'&&!busy,{},{timeout:150000});
  const ids=await page.evaluate(()=>catalog.map(x=>x.id));
  for(const id of ids){
   await page.evaluate(async id=>{await reverseLab.select(id,true);const entry=await(await fetch('/api/flow-candidates/'+id)).json();reverseLab.loadCandidate({...entry.candidates[0],targetId:id})},id);
   const pending=await page.locator('#r-flow .flow-step.pending').count();assert.equal(pending,0,id+' baseline must show native reference, not wafer');
   for(const mode of ['2d','25d']){
    await page.locator('#r'+mode).click();await page.waitForTimeout(150);
    await page.locator('.reverse-view').screenshot({path:`${out}/${id}-${mode}.png`});
   }
   report.examples.push({id,nativeReferenceDisplayed:true,rendered:['2d','3d']});console.log(id,'native geometry rendered 2D + 3D');
  }
  for(const [width,height]of [[1440,900],[1366,768],[768,1024],[390,844]]){
   await page.setViewportSize({width,height});await page.locator('#r2d').click();
   await page.screenshot({path:`${out}/workspace-${width}.png`,fullPage:true});
   report.layout.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,canvas:document.querySelector('#r-current').getBoundingClientRect().toJSON()})));
  }
  assert.deepEqual(report.errors,[]);
 }catch(e){report.failure=e.stack;await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw e}
 finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
