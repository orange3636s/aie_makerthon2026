'use strict';
const assert = require('node:assert/strict');
const { intervals } = require('../web/solid-view');
const cutaway = require('../web/channel-cutaway');
const geometry = require('../web/solid-geometry');
const THREE = require('three');

const expected = {
  finfet: [32, 79], gaafet: [32, 32, 79], mbcfet: [32, 32, 32, 32, 79],
  cfet: [32, 32, 79, 32, 70, 32], 'charge-trap': [30, 30, 16, 11],
  fdsoi: [10, 30, 10, 30, 11], pdsoi: [10, 30, 10, 30, 11],
};
for (const id of [...Object.keys(expected), 'mosfet', 'pn-junction']) {
  const { frames } = require('../references/' + id + '.json');
  const frame = frames.at(-1);
  const contacts = frame.polygons.filter(p => [70, 72, 80].includes(p.material));
  const lands = intervals(contacts, 1, frame.metrics.cutHeightUm - .002);
  assert.equal(lands.length, id === 'pn-junction' ? 2 : 3, id + ' separated electrodes');
  for (let i = 1; i < lands.length; i++) assert(lands[i][0] - lands[i-1][1] > .04, id);
  if (!expected[id]) continue;
  assert.equal(cutaway.build(frames[0], id, .8, intervals), null, id + ' bare wafer');
  const model = cutaway.build(frame, id, .8, intervals);
  const ids = model.parts.map(p => p.material);
  assert.deepEqual(ids.filter(m => expected[id].includes(m)), expected[id], id);
  for (const part of model.parts) {
    const solid = geometry.build(THREE, part.polygons, part.hi - part.lo, () => '#aaaaaa');
    assert(solid.children.length > 0, id + ' closed body');
    for (const mesh of solid.children) {
      assert([...mesh.geometry.attributes.position.array].every(Number.isFinite), id);
      mesh.geometry.dispose(); mesh.material.dispose();
    }
  }
  const cross = cutaway.section(model, 'X', 0, .8, intervals);
  const rows = material => intervals(cross.polygons.filter(p => p.material === material), 0, 0);
  if (id === 'fdsoi' || id === 'pdsoi') {
    const body = rows(10).at(-1), box = rows(30)[0];
    assert.equal(Math.round((body[1] - body[0]) * 1000), id === 'fdsoi' ? 40 : 160);
    assert(Math.abs(body[0] - box[1]) < .001);
    assert.equal(Math.round((box[1] - box[0]) * 1000), 150);
  }
  if (id === 'cfet') {
    const lower = rows(79).at(-1), upper = rows(70)[0];
    assert(rows(30).some(([a,b]) => a >= lower[1] && b <= upper[0]), 'tier isolation');
  }
  if (id === 'gaafet' || id === 'mbcfet') {
    const channels = rows(10).slice(1), gates = rows(79), highK = rows(32);
    assert.equal(channels.length, id === 'gaafet' ? 1 : 3);
    for (const [bottom,top] of channels) {
      assert(highK.some(([a,b]) => Math.abs(b-bottom)<1e-6 && gates.some(g=>Math.abs(g[1]-a)<1e-6)));
      assert(highK.some(([a,b]) => Math.abs(a-top)<1e-6 && gates.some(g=>Math.abs(g[0]-b)<1e-6)));
    }
  }
  if (id === 'charge-trap') {
    const ono = [...rows(30), ...rows(16)].sort((a,b) => a[0]-b[0]);
    assert.deepEqual(ono[1], rows(16)[0]);
    assert(ono.every((layer,i) => !i || Math.abs(layer[0]-ono[i-1][1]) < .002));
  }
}
console.log('Nine contact layouts and seven gate-region cutaways passed.');
