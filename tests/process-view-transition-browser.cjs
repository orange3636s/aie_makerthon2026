'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('../.runtime/browser-qa/node_modules/playwright');
const base = process.env.QA_BASE || 'http://127.0.0.1:3175';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true
  });
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    async function assertView(canvas, two, three, mode) {
      await page.waitForFunction(({canvas,mode}) => window.SolidView?.get(canvas)?.view === mode, {canvas,mode});
      assert.equal(await page.locator(two).getAttribute('aria-pressed'), String(mode === '2d'));
      assert.equal(await page.locator(three).getAttribute('aria-pressed'), String(mode === '3d'));
    }
    await page.goto(base);
    await assertView('section','#view2d','#view25d','3d');
    await page.locator('#view2d').click();
    await page.locator('#timeline .frame-card').first().click();
    await assertView('section','#view2d','#view25d','2d');
    await page.locator('[data-example="mbcfet"]').click();
    await page.waitForFunction(() => typeof current !== 'undefined' && current && selected.id === 'mbcfet' && !busy);
    const cards = page.locator('#timeline .frame-card');
    const toggle = page.locator('.viewer .channel-toggle');
    await page.locator('#compare').check();
    await assertView('section','#view2d','#view25d','3d');
    await cards.nth(44).click();
    const state = () => page.evaluate(() => {
      const s = SolidView.get('section');
      return {cut: !!s.core, refCut: !!s.referenceCore, reference: !!s.reference,
        materials: [...new Set((s.core?.parts || s.data.polygons).map(p => p.material))],
        aligned: s.data === current.frames[frame], yaw: s.yaw};
    });
    const before = await state();
    assert.equal(before.cut, false);
    await cards.nth(45).click();
    const after = await state();
    assert.equal(after.cut, false);
    assert.equal(after.yaw, before.yaw);
    assert(after.aligned && after.reference && !after.refCut);
    assert.deepEqual(after.materials.sort(), before.materials.sort());
    await toggle.click();
    assert((await state()).refCut);
    await page.locator('#view2d').click();
    await page.locator('.viewer [data-axis="X"]').click();
    assert(await page.evaluate(() => {
      const s = SolidView.get('section');
      return !!s.core && s.mini.state.core === s.core &&
        JSON.stringify(s.sliceResult.data.polygons) === JSON.stringify(s.sliceResult.reference.polygons);
    }));
    await toggle.click();
    assert(await page.evaluate(() => {
      const s = SolidView.get('section');
      return !s.core && !s.mini.state.core && !s.referenceCore &&
        JSON.stringify(s.sliceResult.data.polygons) === JSON.stringify(s.sliceResult.reference.polygons);
    }));
    await cards.nth(44).click();
    await cards.nth(45).click();
    assert.equal((await state()).cut, false);
    if (process.env.QA_ALL === '1') {
      const ids = await page.evaluate(() => catalog.map(e => e.id));
      await page.locator('#view25d').click();
      for (const id of ids) {
        await page.evaluate(id => select(id), id);
        const count = await cards.count();
        assert(count >= 2, id);
        await cards.nth(count - 2).click();
        assert.equal((await state()).cut, false, id);
        await cards.last().click();
        const end = await state();
        assert(end.aligned && !end.cut && !end.refCut, id);
      }
      console.log(ids.length + ' examples stayed in full-process view at the final transition.');
    }
    await page.locator('#reverse-mode').click();
    await assertView('r-current','#r2d','#r25d','3d');
    await page.locator('#r2d').click();
    const nextExample = page.locator('[data-example="finfet"]');
    if (!await nextExample.isVisible()) await nextExample.locator('xpath=ancestor::section').locator('.theme-toggle').click();
    await nextExample.click();
    await page.waitForFunction(() => reverseLab.context().id === 'finfet' && reverseLab.context().reference);
    await assertView('r-current','#r2d','#r25d','3d');
    assert.deepEqual(errors, []);
    console.log('MBCFET 45→46, camera, 2D/3D, mini-map and saved reference passed.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
