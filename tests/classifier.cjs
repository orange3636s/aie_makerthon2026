// Contract tests inject responses; no credential or network is used.
const assert=require('node:assert/strict'),{classify}=require('../gemini.cjs'),{targets}=require('../reverse-catalog.json');
const image='data:image/png;base64,YQ==';
const options=output=>({env:{GEMINI_API_KEY:'test'},referenceParts:[],fetchImpl:async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]})})});
(async()=>{
 const good={target:'sti',confidence:.9,reason:'트렌치 격리',ambiguous:false};
 assert.equal((await classify(image,targets,options(good))).target,'sti');
 assert.equal((await classify(image,targets,options({...good,ambiguous:true}))).target,'unknown');
 for(const invalid of [{...good,target:'unsupported'},{...good,confidence:2},{...good,ambiguous:null},{...good,reason:'x'.repeat(401)}])await assert.rejects(classify(image,targets,options(invalid)),/형식/);
 console.log('Gemini valid target, ambiguity override and malformed output contracts passed');
})().catch(e=>{console.error(e);process.exitCode=1});
