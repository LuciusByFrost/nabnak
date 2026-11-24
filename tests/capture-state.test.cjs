const test = require('node:test');
const assert = require('node:assert/strict');
const {preserveState} = require('./browser/capture-state.cjs');

test('a screenshot that scrolls mobile content by 71px cannot affect the next geometry measurement', async () => {
  let state = {window: {x: 0, y: 0}, containers: [{selector: '#language-panel', x: 0, y: 320}]};
  const read = async () => structuredClone(state), restore = async original => { state = structuredClone(original); };
  const documentY = 72;
  const result = await preserveState(read, restore, async () => {
    state.window.y = 71; state.containers[0].y = 0;
    assert.equal(documentY - state.window.y, 1);
    return 'captured';
  });
  assert.equal(result, 'captured');
  assert.equal(documentY - state.window.y, 72);
  assert.equal(state.containers[0].y, 320);
});

test('window and nested container offsets are restored even when visual comparison fails', async () => {
  let state = {window: {x: 12, y: 71}, container: {x: 5, y: 320}};
  const original = structuredClone(state), failure = new Error('one pixel differs');
  await assert.rejects(preserveState(async () => structuredClone(state), async saved => { state = saved; }, async () => {
    state.window = {x: 0, y: 0}; state.container = {x: 0, y: 0}; throw failure;
  }), error => error === failure);
  assert.deepEqual(state, original);
});
