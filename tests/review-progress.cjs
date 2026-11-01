'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('web/reverse.js','utf8');
const fn=source.slice(source.indexOf(' async function prepareDiagnosis(mine){'),source.indexOf(' const opFor='));
function setup(){
 let resolve,reject,renders=0;
 const pending=new Promise((yes,no)=>{resolve=yes;reject=no});
 const nodes=[],host={children:[],prepend(n){this.children.unshift(n)}};
 const c={reviewGeneration:1,reviewReport:null,reviewAIState:'',reviewController:null,reviewSteps:[{}],steps:[{}],working:false,score:{},target:{id:'mosfet'},reference:{},info:{operations:[]},config:{processAnalysis:true},sectionView:'gate',substrateThickness:undefined,substrateRoughness:0,designSpec:null,reviewScope:'custom',reviewComplete:true,AbortController,AbortSignal,JSON,
 el:()=>host,esc:s=>String(s).replaceAll('<','&lt;'),ProcessReview:{compare:()=>({findings:[]})},RecipeStudio:{diagnose(){renders++;host.draft='student input';}},document:{createElement(){const button={};const n={innerHTML:'',textContent:'',setAttribute(){},querySelector:()=>button};nodes.push(n);return n;}},request:()=>pending};
 vm.createContext(c);vm.runInContext(fn,c);return {c,host,nodes,resolve,reject,renders:()=>renders};
}
(async()=>{
 let x=setup(),task=x.c.prepareDiagnosis(1);assert.equal(x.renders(),1,'show measured results before AI resolves');assert(x.nodes[0].innerHTML.includes('AI 해설 준비 중'));
 x.host.draft='my answer in progress';x.resolve({findings:[],ai:{summary:'<script>untrusted</script>'}});await task;
 assert.equal(x.renders(),1,'do not rerender quiz when AI arrives');assert.equal(x.host.draft,'my answer in progress');assert(x.nodes[0].innerHTML.includes('&lt;script>'));
 x=setup();task=x.c.prepareDiagnosis(1);x.reject(Error('timeout'));await task;assert.equal(x.renders(),1);assert(x.nodes[0].innerHTML.includes('재시도'));assert.equal(typeof x.nodes[0].querySelector().onclick,'function');
 x=setup();task=x.c.prepareDiagnosis(1);x.c.reviewGeneration=2;const before=x.nodes[0].innerHTML;x.resolve({ai:{summary:'late result'}});await task;assert.equal(x.nodes[0].innerHTML,before);
 x=setup();task=x.c.prepareDiagnosis(1);x.nodes[0].querySelector().onclick();assert(x.c.reviewController.signal.aborted);x.resolve({ai:{summary:'cancelled'}});await task;assert.equal(x.nodes[0].textContent,'수치 평가 완료 · AI 해설 생략');
 console.log('Immediate measured review, preserved student input, escaped AI text, retry, cancellation and stale-response guards passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
