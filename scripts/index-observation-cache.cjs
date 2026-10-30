'use strict';
// Index the existing, reviewed observation artifacts without duplicating them.
const fs=require('node:fs'),path=require('node:path'),{modelHash,hash}=require('../demo-cache.cjs'),root=path.resolve(__dirname,'..');
const file=path.join(root,'baseline-results/manifest.json'),manifest=JSON.parse(fs.readFileSync(file));
if(manifest.modelHash!==modelHash(root))throw Error('Build current native baselines first');
const catalog=require('../catalog.json').examples;
for(const entry of manifest.entries){
 const text=fs.readFileSync(path.join(root,'references',entry.target+'.json'),'utf8').replace(/\r\n/g,'\n'),result=JSON.parse(text);
 const params=Object.fromEntries(catalog.find(t=>t.id===entry.target).fields.map(f=>[f.key,f.default]));
 if(result.failure||result.frames.length!==result.steps.length+1)throw Error('Incomplete observation '+entry.target);
 if(Object.entries(params).some(([k,v])=>result.params?.[k]!==v))throw Error('Observation defaults differ '+entry.target);
 entry.observation={params,sha256:hash(text)};
}
fs.writeFileSync(file,JSON.stringify(manifest,null,2));console.log('24 observation reference digests indexed');
