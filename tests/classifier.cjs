// Contract tests inject responses; no credential or network is used.
const assert=require('node:assert/strict'),{classify}=require('../gemini.cjs'),{examples:targets}=require('../catalog.json');
const image='data:image/png;base64,YQ==';
const options=output=>({env:{GEMINI_API_KEY:'test'},referenceParts:[],fetchImpl:async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]})})});
(async()=>{
 const good={identification:'STI로 추정됩니다.',confidence:.9,ambiguous:false,recommendations:[{target:'sti'},{target:'pvd'},{target:'sadp'}]};
 const result=await classify(image,targets,options(good));assert.equal(result.recommendations.length,3);assert(result.recommendations.every(r=>r.category==='구조'));assert.equal(new Set(result.recommendations.map(r=>r.target)).size,3);assert(result.recommendations.every(r=>!r.reason));
 assert.equal((await classify(image,targets,options({...good,ambiguous:true}))).ambiguous,true);
 for(const invalid of [{...good,recommendations:[{target:'unsupported'}]},{...good,recommendations:[{target:'sti'},{target:'sti'}]},{...good,confidence:2},{...good,ambiguous:null},{...good,identification:'x'.repeat(401)}])await assert.rejects(classify(image,targets,options(invalid)),/형식/);
 console.log('Three-example learning recommendations, categories, uncertainty and malformed response contracts passed');
})().catch(e=>{console.error(e);process.exitCode=1});
