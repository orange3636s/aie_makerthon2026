'use strict';
const {createHash}=require('node:crypto');
module.exports=function({ttl=600000,now=Date.now,max=40}={}){
 const cache=new Map(),pending=new Map();
 return async(key,work)=>{
  key=createHash('sha256').update(key).digest('hex');
  const found=cache.get(key);if(found&&found.until>now())return found.value;
  if(pending.has(key))return pending.get(key);
  const task=Promise.resolve().then(work).then(value=>{cache.set(key,{value,until:now()+ttl});if(cache.size>max)cache.delete(cache.keys().next().value);return value}).finally(()=>pending.delete(key));
  pending.set(key,task);return task;
 };
};
