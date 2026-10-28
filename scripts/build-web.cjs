const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),out=path.join(root,'public');fs.mkdirSync(out,{recursive:true});
for(const file of ['index.html','app.js','style.css','materials.js','parameters.html','tutorial.js','reverse.js','reverse.css','grading.js','recipe-state.js','process-review.js'])fs.copyFileSync(path.join(root,'web',file),path.join(out,file));
