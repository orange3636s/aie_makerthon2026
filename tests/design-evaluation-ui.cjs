// Exercise real quiz event handlers in a small DOM adapter. This is not visual QA.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function node(){return {textContent:'',innerHTML:'',value:'',after(){},prepend(){},append(){},setAttribute(){},addEventListener(){},insertAdjacentHTML(_where,html){this.inserted=(this.inserted||'')+html},querySelector(){return node()},querySelectorAll(){return []}}}
const document={body:node(),createElement:node,querySelector:node},window={};
vm.runInNewContext(fs.readFileSync('web/recipe-studio.js','utf8'),{window,document,ProcessUI:{},console});
const D=window.RecipeStudio,form=node(),error=node(),reason=node(),choice=node(),variable=node(),heading=node(),fieldset=node();
const host=node();host.querySelector=selector=>({'form':form,'#rs-error':error,'textarea':reason,'input:checked':choice,'#rs-variable':variable,'h3':heading,'fieldset':fieldset}[selector]||node());
const score={checks:[],measures:[],components:{geometry:80,cd:75},actualCost:1,referenceCost:1,eligible:false};
let done=0;
D.diagnose(host,score,{id:'mosfet'},[],result=>{assert(result.correct);done++},{operations:[]});
const submit=()=>form.onsubmit({preventDefault(){}});
submit();assert.equal(done,0);assert(error.textContent.includes('선택'));
choice.value='dimension';reason.value='형상 점수와 단면을 비교하여 공정 차이를 확인하겠습니다.';
submit();assert.equal(done,0);assert(error.textContent.includes('다시'));
choice.value='geometry';submit();assert.equal(done,1);
const report={findings:[{id:'step-1',kind:'missing',title:'<script>alert(1)</script>',referenceStep:1}],ai:{suggestions:[{id:'step-1',analysis:'비교',action:'확인'}]}};
D.diagnose(host,score,{id:'mosfet'},[],()=>{}, {operations:[],report});
assert(!host.innerHTML.includes('<script>'));assert(host.innerHTML.includes('&lt;script&gt;'));
console.log('Real quiz submit handlers: empty input, wrong answer retry, correct callback, escaped AI/reference text passed (DOM adapter; not browser visuals).');
