// Scientific notation must not silently change a saved process condition.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(require('node:path').join(__dirname,'../web/app.js'),'utf8').match(/function shortNumber\(v\)\{[^\n]+\}/)[0];
const ctx={};vm.createContext(ctx);vm.runInContext(src,ctx);
for(const value of [1e11,1e15,1234567890123,1.23456789e-5,.00005,.001,30])assert.equal(Number(ctx.shortNumber(value)),value);
console.log('7 numeric display round-trips passed');
