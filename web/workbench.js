'use strict';
// Instrument panels shared by observation and reverse design; never mutate solver results.
(() => {
 const M=WorkbenchMetrics,panels=new Map(),pinned=new Map(),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>Number.isFinite(n)?Math.abs(n)>=1e5?n.toExponential(2):n.toLocaleString('en-US',{maximumFractionDigits:1}):'—';
 function build(id,host){
  const p={id,kind:'surface',material:10,position:.5,showLine:true,baseline:id==='section'?'previous':'reference',data:null};
  const box=document.createElement('section');box.className='workbench-analysis';box.setAttribute('aria-label',id==='section'?'실험실 측정':'역설계 측정');
  box.innerHTML=`<div class="wb-heading"><strong>Profile</strong><div class="wb-actions"><button type="button" data-pin>기준 고정</button><button type="button" data-collapse aria-expanded="true" aria-label="그래프 접기" title="그래프 접기">⌄</button></div></div><div class="wb-body"><div class="wb-instruments"><select data-kind aria-label="측정 그래프"><option value="surface">표면 높이</option><option value="thickness">재료 두께</option><option value="doping">농도 · 깊이</option></select><select data-material aria-label="측정 재료" hidden></select><select data-field aria-label="농도 측정 값" hidden><option value="net_total">순 총농도 |ND−NA|</option><option value="net_active">순 활성농도 |ND−NA|</option><option value="P_total">P 총농도</option><option value="B_total">B 총농도</option></select><select data-baseline aria-label="비교 기준"><option value="previous">이전 단계</option><option value="reference">${id==='section'?'기준 실행':'목표 구조'}</option>${id==='section'?'':'<option value="pinned">고정한 단면</option>'}<option value="none">비교 없음</option></select><label class="wb-probe"><input type="checkbox" data-line checked>측정선</label><label class="wb-position">x <input type="range" min="0" max="1000" value="500" data-x aria-label="단면 측정 위치"><output data-position>0 nm</output></label></div><div class="wb-chart-row"><div class="wb-chart"><svg viewBox="0 0 640 160" preserveAspectRatio="xMidYMid meet" role="img" aria-label="계산 결과에서 추출한 측정 그래프"></svg><div class="wb-legend"><span class="wb-live">━ 현재</span><span class="wb-ref">┄ 기준</span><span data-message></span></div></div><dl data-metrics></dl></div></div>`;
  host.append(box);if(id==='section'){const overlay=document.getElementById('compare')?.closest('label');if(overlay)box.querySelector('.wb-actions').prepend(overlay)}p.box=box;p.svg=box.querySelector('svg');panels.set(id,p);
  const q=s=>box.querySelector(s);p.q=q;q('[data-baseline]').value=p.baseline;
  q('[data-kind]').onchange=e=>{p.kind=e.target.value;paint(p);redraw(p)};
  q('[data-material]').onchange=e=>{p.material=Number(e.target.value);paint(p)};
  q('[data-field]').onchange=()=>paint(p);
  q('[data-baseline]').onchange=e=>{p.baseline=e.target.value;paint(p)};
  q('[data-line]').onchange=e=>{p.showLine=e.target.checked;redraw(p)};
  q('[data-x]').oninput=e=>{p.position=Number(e.target.value)/1000;paint(p);redraw(p)};
  q('[data-collapse]').onclick=e=>{const body=q('.wb-body');body.hidden=!body.hidden;e.currentTarget.setAttribute('aria-expanded',!body.hidden);e.currentTarget.setAttribute('aria-label',body.hidden?'그래프 펼치기':'그래프 접기');e.currentTarget.textContent=body.hidden?'⌃':'⌄';redraw(p)};
  q('[data-pin]').onclick=()=>{if(!p.data?.frame)return;if(p.id==='section'){document.getElementById('pin-reference').click();p.baseline='reference';q('[data-baseline]').value='reference';paint(p);return;}pinned.set(p.data.key,structuredClone(p.data.frame));if(pinned.size>6)pinned.delete(pinned.keys().next().value);p.baseline='pinned';q('[data-baseline]').value='pinned';paint(p);toast('이 단면을 비교 기준으로 고정했습니다.');};
  p.svg.addEventListener('pointermove',e=>{if(!p.axes)return;const rect=p.svg.getBoundingClientRect(),vx=(e.clientX-rect.left)/rect.width*p.axes.width;const x=p.axes.xmin+Math.max(0,Math.min(1,(vx-p.axes.left)/p.axes.plotWidth))*(p.axes.xmax-p.axes.xmin),pair=p.points?.filter(a=>a[1]!=null).reduce((best,a)=>!best||Math.abs(a[0]-x)<Math.abs(best[0]-x)?a:best,null);if(pair)p.svg.setAttribute('aria-label',`측정 그래프: ${fmt(pair[0])} nm, ${fmt(pair[1])} ${p.kind==='doping'?'log10 cm-3':'nm'}`)});
  new ResizeObserver(()=>{if(p.series&&p.svg.getBoundingClientRect().width>0)graph(p,...p.series)}).observe(p.svg);
  return p;
 }
 function redraw(p){if(p.id==='section')drawMain();else window.reverseLab?.redraw();}
 function update(id,data){const host=id==='section'?document.querySelector('.viewer'):document.querySelector('.reverse-view');if(!host)return;const p=panels.get(id)||build(id,host);const old=p.data;if(old&&old.key===data.key&&old.frame===data.frame&&old.index===data.index&&old.previous===data.previous&&old.reference===data.reference&&old.pending===data.pending&&old.preview===data.preview&&JSON.stringify(old.bounds)===JSON.stringify(data.bounds)){p.data=data;return;}if(p.data?.key!==data.key){p.position=.5;p.q('[data-x]').value=500;p.material=10;}
  if(p.data?.key!==data.key||p.data?.index!==data.index){const r=data.recipe,method=r?.params?.method||'';const normalize=s=>String(s).replace(/[₀-₉]/g,c=>'₀₁₂₃₄₅₆₇₈₉'.indexOf(c)).replace(/\s/g,'').toLowerCase();
   if(r?.op==='diffusion'&&!/oxidation/i.test(method)){p.kind='doping';p.q('[data-field]').value=data.frame?.concentration?.info?.operation==='implant'?'net_total':data.frame?.concentration?.fields?.net_active?'net_active':'net_total';}
   else if(['photo','deposition','etch'].includes(r?.op)||/oxidation/i.test(method)){p.kind='thickness';const name=r.op==='photo'?'PR':/oxidation/i.test(method)?'SiO2':r.params.material;const entry=Object.entries(window.SIMULATION_MATERIALS).find(([,m])=>normalize(m.name)===normalize(name));if(entry)p.material=Number(entry[0]);}
   else p.kind='surface';p.q('[data-kind]').value=p.kind;
  }p.data=data;paint(p);}
 function paint(p){
  const d=p.data,q=p.q;for(const s of ['[data-pin]'])q(s).disabled=!d?.frame;
  if(!d?.frame||!d.bounds){p.series=null;p.svg.setAttribute('viewBox','0 0 640 160');p.svg.innerHTML='<text x="320" y="80" text-anchor="middle" fill="#72838c" font-size="12">계산된 단면을 선택하세요.</text>';q('[data-metrics]').innerHTML='';p.axes=null;return;}
  const ids=[...new Set([...(d.frame.polygons||[]),...(d.reference?.polygons||[])].map(a=>a.material))];if(!ids.includes(p.material)&&window.SIMULATION_MATERIALS[p.material])ids.push(p.material);if(!ids.includes(p.material))p.material=ids.includes(10)?10:ids[0];
  const options=ids.map(id=>`<option value="${id}" ${id===p.material?'selected':''}>${esc(materialStyle(id).name)}</option>`).join('');if(q('[data-material]').innerHTML!==options)q('[data-material]').innerHTML=options;
  q('[data-material]').hidden=p.kind!=='thickness';q('[data-field]').hidden=p.kind!=='doping';
  p.x=d.bounds[0]+p.position*(d.bounds[1]-d.bounds[0]);q('[data-position]').textContent=fmt(p.x*1000)+' nm';
  const ref=p.baseline==='previous'?d.previous:p.baseline==='reference'?d.reference:p.baseline==='pinned'?pinned.get(d.key):null,field=q('[data-field]').value;
  const a=M.sample(d.frame,d.bounds,p.kind,p.material,p.x,field),b=ref?M.sample(ref,d.bounds,p.kind,p.material,p.x,field):[];p.points=a;
  const sa=M.stats(a),sb=M.stats(b),at=M.thickness(d.frame,p.x,p.material,d.bounds);
  const rows=p.kind==='doping'?[['최고 농도',sa?`10^${fmt(sa.max)}`:'—','cm⁻³'],['기준 최고 농도',sb?`10^${fmt(sb.max)}`:'—','cm⁻³'],['측정 x',fmt(p.x*1000),'nm']]:p.kind==='thickness'?[['측정선 막 두께',fmt(at),'nm'],['최대 두께',fmt(sa?.max),'nm'],['기준과 RMSE',fmt(M.compare(a,b)),'nm']]:[['표면 높이차',fmt(sa?.range),'nm'],['최고점',fmt(sa?.max),'nm'],['기준과 RMSE',fmt(M.compare(a,b)),'nm']];

  q('[data-metrics]').innerHTML=rows.map(([name,value,unit])=>`<div><dt>${name}</dt><dd>${value}<small>${unit}</small></dd></div>`).join('');p.measurement={max:sa?.max??null,min:sa?.min??null,range:sa?.range??null,probeNm:at,rmse:M.compare(a,b)};
  q('[data-message]').textContent=d.preview?'미리보기':d.pending?'계산 전':'';
  const refLabel=p.baseline==='previous'?'이전 단계':p.baseline==='reference'?(p.id==='section'?'기준 실행':'목표 구조'):'고정 단면';q('.wb-ref').textContent=ref?'┄ '+refLabel:p.baseline==='none'?'':'기준 없음';
  graph(p,a,b);
 }
 function graph(p,a,b){
  p.series=[a,b];
  const rect=p.svg.getBoundingClientRect(),width=Math.max(220,Math.round(rect.width)),height=Math.max(150,Math.round(rect.height));
  p.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const finite=[...a,...b].filter(r=>Number.isFinite(r[0])&&Number.isFinite(r[1]));
  if(!finite.length){p.svg.innerHTML=`<text x="${width/2}" y="${height/2}" text-anchor="middle">이 측정 위치에 계산 데이터가 없습니다.</text>`;p.axes=null;return;}
  let xmin=Math.min(...finite.map(r=>r[0])),xmax=Math.max(...finite.map(r=>r[0])),ymin=Math.min(...finite.map(r=>r[1])),ymax=Math.max(...finite.map(r=>r[1]));
  if(xmax===xmin)xmax=xmin+1;
  const niceStep=range=>{const raw=range/4,power=10**Math.floor(Math.log10(raw)),n=raw/power;return(n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*power};
  const pad=Math.max((ymax-ymin)*.08,p.kind==='doping'?.3:1),dy=niceStep(ymax-ymin+2*pad);
  ymin=Math.floor((ymin-pad)/dy)*dy;ymax=Math.ceil((ymax+pad)/dy)*dy;
  const tick=v=>{const rounded=Math.abs(v)<1e-9?0:v;return Math.abs(rounded)>=10000?rounded.toExponential(1):rounded.toLocaleString('en-US',{maximumFractionDigits:2})};
  const left=58,right=20,top=27,bottom=height-39,plotWidth=width-left-right;
  p.axes={xmin,xmax,ymin,ymax,width,left,plotWidth};
  const X=x=>left+(x-xmin)/(xmax-xmin)*plotWidth,Y=y=>bottom-(y-ymin)/(ymax-ymin)*(bottom-top);
  const path=rows=>{let pen=false;return rows.map(([x,y])=>{if(!Number.isFinite(x)||!Number.isFinite(y)){pen=false;return'';}const str=(pen?'L':'M')+X(x).toFixed(2)+','+Y(y).toFixed(2);pen=true;return str}).join(' ')};
  let g=`<defs><clipPath id="wb-clip-${p.id}"><rect x="${left}" y="${top}" width="${plotWidth}" height="${bottom-top}"/></clipPath></defs>`;
  for(let i=0;i<=Math.round((ymax-ymin)/dy);i++){const y=ymin+i*dy;g+=`<path d="M${left} ${Y(y)}H${width-right}" stroke="#e7eef0"/><text x="${left-10}" y="${Y(y)+4}" text-anchor="end">${tick(y)}</text>`;}
  const dx=niceStep(xmax-xmin);
  for(let x=Math.ceil(xmin/dx)*dx;x<=xmax+dx*1e-8;x+=dx)g+=`<text x="${X(x)}" y="${bottom+19}" text-anchor="middle">${tick(x)}</text>`;
  g+=`<g clip-path="url(#wb-clip-${p.id})"><path d="${path(b)}" fill="none" stroke="#b37b22" stroke-width="2" stroke-dasharray="6 4"/><path d="${path(a)}" fill="none" stroke="#087f76" stroke-width="2.2"/>`;
  if(p.kind!=='doping'&&p.showLine)g+=`<path d="M${X(p.x*1000)} ${top}V${bottom}" stroke="#82949e" stroke-dasharray="3 4"/>`;
  g+=`</g><text x="${left}" y="14">${p.kind==='doping'?'log₁₀ |C| (cm⁻³)':p.kind==='thickness'?'막 두께 (nm)':'표면 높이 (nm)'}</text><text x="${width-right}" y="${height-3}" text-anchor="end">${p.kind==='doping'?'깊이':'x'} (nm)</text>`;p.svg.innerHTML=g;
 }
 function overlay(canvas,c,px,py,bounds){const p=panels.get(canvas.id==='r-target'?'r-current':canvas.id);if(!p?.showLine||!p.data?.frame||!Number.isFinite(p.x))return;c.save();c.strokeStyle='#6b8299';c.setLineDash([3,4]);c.lineWidth=1;c.beginPath();c.moveTo(px(p.x),py(bounds[2]));c.lineTo(px(p.x),py(bounds[3]));c.stroke();c.setLineDash([]);c.fillStyle='#526b84';c.font='10px Segoe UI';c.fillText('A',px(p.x)+5,py(bounds[3])+12);c.restore();}
 function sliders(host){if(!host)return;host.querySelectorAll('input[type=number]').forEach(input=>{if(input.dataset.wbSlider||!/(time|rate|energy|dose|thickness|cycles|gpc|depth|width|temperature|duration|removal|growth)/i.test(input.id))return;const min=Number(input.min),max=Number(input.max);if(!(max>min)||!Number.isFinite(min+max))return;input.dataset.wbSlider='true';const s=document.createElement('input');s.type='range';s.className='wb-recipe-slider';s.setAttribute('aria-label',(input.closest('.field')?.querySelector('label')?.textContent||'레시피')+' 조절');const logarithmic=min>0&&max/min>=1000;s.min=logarithmic?0:min;s.max=logarithmic?1000:max;s.step=logarithmic?1:input.step==='any'?'any':input.step||1;const sync=()=>{s.value=logarithmic?1000*Math.log(Math.max(min,Number(input.value))/min)/Math.log(max/min):input.value;s.disabled=input.disabled};sync();(input.closest('.number-wrap')||input).after(s);input.addEventListener('input',sync);new MutationObserver(sync).observe(input,{attributes:true,attributeFilter:['disabled']});s.oninput=()=>{if(input.disabled){sync();return;}let v=logarithmic?min*Math.pow(max/min,Number(s.value)/1000):Number(s.value);if(input.step==='1')v=Math.round(v);input.value=Number(v.toPrecision(7));input.dispatchEvent(new Event('input',{bubbles:true}));};});}
 window.ProcessWorkbench={update,overlay,sliders};
 document.body.classList.add('process-workbench');document.getElementById('observe-mode').textContent='실험실';document.querySelector('.viewer h2').textContent='Cross-section';
 const h=document.querySelector('.app-header nav a.active');if(h)h.textContent='Workspace';
 build('section',document.querySelector('.viewer'));build('r-current',document.querySelector('.reverse-view'));
})();
