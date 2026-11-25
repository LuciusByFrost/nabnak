const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/store.js');
const D = require('../js/mindmap-data.js');
const R = require('../js/recovery.js');
const S = require('../js/security.js');
const {scan} = require('../tools/scan-secrets.cjs');
const {boot} = require('./dom-harness.cjs');
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};
}

test('reaudit: malformed task references and field types are preserved rather than silently rewritten', () => {
  for (const task of [{id: 'a', title: 'Keep', goalId: 'missing'}, {id: 'a', title: 'Keep', dueDate: false}, {id: 'a', title: 'Keep', dueDate: 0}, {id: 'a', title: ' '}]) {
    const raw = JSON.stringify({version: 2, tasks: [task], goals: []}), storage = memory({[T.STORAGE_KEY]: raw});
    const store = T.createStore(storage);
    assert.equal(store.getError(), 'storageReadError'); assert.equal(storage.getItem(T.STORAGE_KEY), raw);
  }
  const store = T.createStore(memory());
  for (const value of [false, 0]) {
    assert.throws(() => store.addTask({title: 'Invalid date', dueDate: value}), /invalidDate/);
    assert.throws(() => store.addTask({title: 'Invalid reference', goalId: value}), /invalidInput/);
  }
  assert.equal(store.getState().tasks.length, 0);
});

test('reaudit: edits exceeding the restorable size leave task state and persisted bytes unchanged', () => {
  const initial = {version: 2, tasks: [{id: 'task', title: 'Keep'}], goals: [], metadata: 'x'.repeat(S.limits.bytes - 1000)};
  const storage = memory({[T.STORAGE_KEY]: JSON.stringify(initial)}), store = T.createStore(storage);
  assert.equal(store.getError(), null);
  const before = store.getState(), saved = storage.getItem(T.STORAGE_KEY);
  assert.throws(() => store.addGoal({title: 'Goal', description: 'x'.repeat(2000), dueDate: '2099-01-01', target: 1}), /resourceLimit/);
  assert.deepEqual(store.getState(), before); assert.equal(storage.getItem(T.STORAGE_KEY), saved);
  assert.throws(() => store.addTask({title: 'x'.repeat(500) + 'x'}), /inputTooLong/);
});

test('reaudit: successful recovery retains a durable versioned snapshot across reload', () => {
  const original = JSON.stringify({version: 2, tasks: [{id: 'old', title: 'Previous work'}], goals: []});
  const replacement = JSON.stringify({version: 2, tasks: [], goals: []});
  const storage = memory({[T.STORAGE_KEY]: original, 'unrelated.app': 'keep'});
  R.restore(storage, {[T.STORAGE_KEY]: replacement});
  const previous = JSON.parse(storage.getItem('nabnak.recovery.previous'));
  assert.equal(previous.format, 'nabnak-recovery'); assert.equal(previous.version, 1);
  assert.equal(previous.entries[T.STORAGE_KEY], original);
  assert.equal(JSON.parse(R.backup(storage)).previous, storage.getItem('nabnak.recovery.previous'));
  assert.equal(T.createStore(storage).getState().tasks.length, 0);
  R.clear(storage); assert.equal(storage.getItem('nabnak.recovery.previous'), null); assert.equal(storage.getItem('unrelated.app'), 'keep');
});

test('reaudit: failure to preserve the pre-restore snapshot aborts recovery before replacing content', () => {
  const storage = memory({[D.KEY]: JSON.stringify({maps: [D.newMap('Keep', 'Root')]})}), before = storage.getItem(D.KEY);
  const set = storage.setItem;
  storage.setItem = (key, value) => { if (key === 'nabnak.recovery.previous') throw new Error('quota'); set(key, value); };
  assert.throws(() => R.restore(storage, {[D.KEY]: JSON.stringify({maps: [D.newMap('Replace', 'Root')]})}), /recoveryError/);
  assert.equal(storage.getItem(D.KEY), before);
});

test('reaudit: secret scanning detects BOM-marked UTF-16 credentials without printing values', () => {
  const secret = 'gh' + 'p_' + 'A'.repeat(36), findings = [];
  const utf16 = Buffer.from('token=' + secret, 'utf16le');
  scan(Buffer.concat([Buffer.from([0xff, 0xfe]), utf16]), 'fixture-le.txt', findings);
  scan(Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(utf16).swap16()]), 'fixture-be.txt', findings);
  assert.equal(findings.length, 2); assert.ok(findings.every(item => item.rule === 'github-token'));
  assert.equal(JSON.stringify(findings).includes(secret), false);
});

test('reaudit: traversal rejects excessive fanout before expanding child values', () => {
  let accessed = false;
  const values = Array(300000).fill(0);
  Object.defineProperty(values, '0', {enumerable: true, get() { accessed = true; return 0; }});
  assert.throws(() => S.inspect(values), /resourceLimit/); assert.equal(accessed, false);
  assert.throws(() => S.parse('[' + '0,'.repeat(299999) + '0]'), /resourceLimit/);
});

test('reaudit: a size-rejected board move remains inert and displays a translated error', () => {
  const initial = {version: 2, tasks: [{id: 'task', title: 'Keep', status: 'todo', dueDate: null, goalId: null}], goals: [], metadata: ''};
  initial.metadata = 'x'.repeat(S.limits.bytes - Buffer.byteLength(JSON.stringify(initial)));
  const raw = JSON.stringify(initial), env = boot(new Map([[T.STORAGE_KEY, raw]]));
  const move = env.$('todo').querySelector('select'); move.value = 'doing';
  assert.doesNotThrow(() => move.fire('change'));
  assert.equal(env.context.NabnakStore.getState().tasks[0].status, 'todo'); assert.equal(env.data.get(T.STORAGE_KEY), raw);
  assert.equal(env.$('storage-warning').hidden, false);
  assert.equal(env.$('storage-warning').textContent, env.context.NabnakI18n.t('resourceLimit'));
});
