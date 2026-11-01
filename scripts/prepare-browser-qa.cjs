const fs=require('node:fs');
const controls='<section style="padding:24px;background:#fff"><button id="run-tests">모든 예제·단계 렌더링 검사</button><h2 id="qa-summary">대기</h2><pre id="qa-results" style="white-space:pre-wrap"></pre><div id="qa-gallery" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px"></div></section><script src="/qa.js"></script>';
fs.writeFileSync('web/qa.html',fs.readFileSync('web/index.html','utf8').replace('</body>',controls+'</body>'));
fs.writeFileSync('web/qa.js',fs.readFileSync('tests/browser-render.js','utf8')+'\n'+fs.readFileSync('tests/browser-workflows.js','utf8'));
console.log('Local-only /qa.html ready. Open browser and click the render-test button. Optional ?start=example-id resumes a batch.');
