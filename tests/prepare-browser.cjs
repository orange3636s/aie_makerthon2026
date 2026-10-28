const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8').replace('</body>','<section id="qa-controls" style="background:#fff;padding:20px;border-top:2px solid #303c8c"><button id="run-tests">Run strict scenarios</button><button id="layout-test">Check this viewport</button><h2 id="summary">Ready</h2><pre id="results" style="white-space:pre-wrap;max-height:300px;overflow:auto"></pre></section><script src="/qa.js"></script></body>');
fs.writeFileSync(path.join(root,'web/qa.html'),html);
fs.copyFileSync(path.join(__dirname,'browser-scenarios.js'),path.join(root,'web/qa.js'));
console.log('Open http://127.0.0.1:3012/qa.html and run scenarios. QA assets are local-only and never published.');
