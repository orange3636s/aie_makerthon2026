'use strict';
(()=>{
 function sliders(host){if(!host)return;host.querySelectorAll('input[type=number]').forEach(input=>{
  if(input.dataset.recipeSlider)return;const min=Number(input.min),max=Number(input.max);if(!input.hasAttribute('min')||!input.hasAttribute('max')||!(max>min)||!Number.isFinite(min+max))return;
  input.dataset.recipeSlider='true';const s=document.createElement('input');s.type='range';s.className='wb-recipe-slider';const field=input.closest('.field');s.setAttribute('aria-label',(field?.querySelector('label')?.textContent||'레시피')+' 조절');
  const logarithmic=min>0&&max/min>=1000;s.min=logarithmic?0:min;s.max=logarithmic?1000:max;s.step=logarithmic?1:input.step==='any'?'any':input.step||1;
  const wrap=document.createElement('div');wrap.className='recipe-gauge';const value=input.closest('.number-wrap')||input;value.before(wrap);wrap.append(s,value);field?.classList.add('has-gauge');
  const sync=()=>{const chars=input.value.length,unit=value.querySelector?.('span')?.textContent?.length||0;wrap.style.setProperty('--value-width',Math.min(190,Math.max(126,chars*8+unit*6+24))+'px');const v=Number(input.value);s.value=logarithmic?1000*Math.log(Math.max(min,v)/min)/Math.log(max/min):v;s.disabled=input.disabled;s.style.setProperty('--fill',100*(Number(s.value)-Number(s.min))/(Number(s.max)-Number(s.min))+'%');s.setAttribute('aria-valuetext',input.value)};
  sync();input.addEventListener('input',sync);input.addEventListener('change',sync);
  s.oninput=()=>{if(input.disabled){sync();return;}let v=logarithmic?min*Math.pow(max/min,Number(s.value)/1000):Number(s.value);const step=Number(input.step);if(step>0)v=min+Math.round((v-min)/step)*step;input.value=Number(Math.min(max,Math.max(min,v)).toPrecision(7));input.dispatchEvent(new Event('input',{bubbles:true}));};
 });}
 window.RecipeSliders={sliders};
})();
