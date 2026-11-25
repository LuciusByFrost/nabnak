const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const S = require('../js/security.js');
const D = require('../js/mindmap-data.js');
const T = require('../js/store.js');
const R = require('../js/recovery.js');
const {boot} = require('./dom-harness.cjs');
const {startServer} = require('../tools/serve.cjs');
function memory(initial = {}) { const data = new Map(Object.entries(initial)); return {data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key)}; }
const serializedMap = () => JSON.stringify({version: 2, maps: [D.newMap('Map', 'Root')]});

test('untrusted JSON rejects dangerous keys at every depth without polluting prototypes', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    assert.throws(() => S.parse('{"maps":[],"unknown":{"' + key + '":{"polluted":true}}}'), /unsafeKeys/);
    const storage = memory({[T.STORAGE_KEY]: '{"tasks":[],"' + key + '":{}}'});
    const before = storage.getItem(T.STORAGE_KEY), store = T.createStore(storage);
    store.addTask({title: 'In memory'}); assert.equal(storage.getItem(T.STORAGE_KEY), before);
  }
  assert.equal({}.polluted, undefined);
});

test('JSON byte, nesting, text, collection and version limits are enforced', () => {
  assert.throws(() => S.parse(' '.repeat(S.limits.bytes + 1)), /resourceLimit/);
  assert.throws(() => S.parse(JSON.stringify('é'.repeat(S.limits.bytes / 2))), /resourceLimit/);
  assert.throws(() => S.parse('['.repeat(102) + '0' + ']'.repeat(102)), /resourceLimit/);
  for (const version of [0, -1, 1.5, '2', null, 3]) assert.throws(() => D.decode({version, maps: []}), /unsupportedVersion/);
  for (const version of [undefined, 1, 2]) assert.equal(D.decode({version, maps: []}).version, 2);
  assert.throws(() => D.decode({maps: Array.from({length: 31}, () => ({}))}), /resourceLimit/);
  const map = D.newMap('Map', 'Root'); map.nodes = Array.from({length: 501}, (_, i) => ({...map.nodes[0], id: "node-" + i})); assert.throws(() => D.decode(map), /resourceLimit/);
});

test('task and goal data validation bounds Unicode text and rejects invalid dates and references', () => {
  const store = T.createStore(memory());
  const title = 'ação 日本語 😀 <img src=x onerror=alert(1)>';
  assert.equal(store.addTask({title}).title, title);
  for (const value of ['x'.repeat(501), {}, 3]) assert.throws(() => store.addTask({title: value}));
  assert.throws(() => store.addGoal({title: 'Goal', description: 'a'.repeat(10001), dueDate: '2026-11-25', target: 1}), /inputTooLong/);
  assert.throws(() => store.addTask({title, dueDate: '2026-02-30'}), /invalidDate/);
  assert.throws(() => store.addTask({title, goalId: 'missing'}), /missingGoal/);
  assert.equal(store.getState().tasks.length, 1);
});

test('graph validation rejects invalid IDs, references, cycles and inconsistent parents', () => {
  for (const bad of ['', 'a" onload="alert(1)', '__proto__', 'a'.repeat(129), 1]) {
    const map = D.newMap('Map', 'Root'); map.nodes[0].id = bad; map.rootId = bad; assert.throws(() => D.decode(map));
  }
  for (const kind of ['missing', 'cycle', 'treeCycle', 'twoParents', 'duplicateEdge']) {
    const map = D.newMap('Map', 'Root'), a = D.addNode(map, map.rootId, 'A'), b = D.addNode(map, a.id, 'B');
    if (kind === 'missing') a.parentId = 'missing';
    if (kind === 'cycle') { a.parentId = b.id; map.edges = []; }
    if (kind === 'treeCycle') { a.parentId = null; b.parentId = null; map.edges = [{source: a.id, target: b.id, kind: 'tree'}, {source: b.id, target: a.id, kind: 'tree'}]; }
    if (kind === 'twoParents') map.edges.push({source: map.rootId, target: b.id, kind: 'tree'});
    if (kind === 'duplicateEdge') map.edges[1].id = map.edges[0].id;
    assert.throws(() => D.decode(map), undefined, kind);
  }
});

test('node numbers, dimensions, colors and camera values are strictly bounded', () => {
  for (const patch of [{x: Infinity}, {x: '0" onload="alert(1)'}, {y: 1000001}, {width: '1"/><script>alert(1)</script>'}, {width: -1}, {height: 50001}, {color: 'red; background:url(https://example.com)'}, {side: 2}, {manual: {}}]) {
    const map = D.newMap('Map', 'Root'); Object.assign(map.nodes[0], patch); assert.throws(() => D.decode(map));
  }
  const map = D.newMap('Map', 'Root'); map.camera.zoom = '1'; assert.throws(() => D.decode(map));
});

test('imports use allowlisted properties while storage migration preserves safe unknown metadata', () => {
  const raw = JSON.parse(serializedMap()); raw.extra = 'retained only in storage'; raw.maps[0].nodes[0].extra = {safe: true};
  assert.equal(D.decode(raw).extra, undefined); assert.equal(D.decode(raw).maps[0].nodes[0].extra, undefined);
  assert.deepEqual(D.decode(raw, true).maps[0].nodes[0].extra, {safe: true});
});

test('failed atomic writes retain persisted bytes, state and undo history', () => {
  const storage = memory({[D.KEY]: serializedMap()}), store = D.createStore(storage), before = store.getState(), raw = storage.getItem(D.KEY);
  storage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => store.edit(state => state.maps.push(D.newMap('Import', 'Root')), {atomic: true}), /mmWriteError/);
  assert.deepEqual(store.getState(), before); assert.equal(store.canUndo(), false); assert.equal(storage.getItem(D.KEY), raw);
  assert.equal(store.getError(), 'mmWriteError');
});

test('stale writes never overwrite a newer tab snapshot', () => {
  const storage = memory(), first = T.createStore(storage), second = T.createStore(storage);
  second.addTask({title: 'Second tab'}); const saved = storage.getItem(T.STORAGE_KEY);
  first.addTask({title: 'First tab unsaved'}); assert.equal(storage.getItem(T.STORAGE_KEY), saved); assert.equal(first.getError(), 'storageConflict');
  const maps = memory({[D.KEY]: serializedMap()}), a = D.createStore(maps), b = D.createStore(maps);
  b.edit(state => { state.maps[0].title = 'Other tab'; }); const latest = maps.getItem(D.KEY);
  assert.throws(() => a.edit(state => { state.maps[0].title = 'Stale'; }, {atomic: true}), /storageConflict/);
  assert.equal(maps.getItem(D.KEY), latest);
});

test('malformed storage is retained and valid legacy task bytes are backed up before migration', () => {
  for (const value of ['{', '{"tasks":[],"version":"2"}', '{"tasks":[{"id":"bad id","title":"Old"}]}', '{"tasks":[{"title":{}}]}']) {
    const storage = memory({[T.STORAGE_KEY]: value}), store = T.createStore(storage);
    store.addTask({title: 'Memory'}); assert.equal(storage.getItem(T.STORAGE_KEY), value); assert.equal(store.getError(), 'storageReadError');
  }
  const original = JSON.stringify({version: 1, tasks: [{id: 'old', text: 'ação', custom: {keep: true}}]});
  const storage = memory({[T.STORAGE_KEY]: original}); T.createStore(storage);
  assert.equal(storage.getItem(T.STORAGE_KEY + '.backup'), original);
});

test('UI imports reject oversized JSON, invalid graphs and quota failures without success or mutation', () => {
  const env = boot(), api = env.context.NabnakMindmaps; api.open();
  const before = JSON.stringify(api.store.getState()), raw = env.data.get(D.KEY);
  for (const text of ['{', ' '.repeat(S.limits.bytes + 1), '{"maps":[],"constructor":{}}', '{"version":99,"maps":[]}']) {
    assert.equal(api.importJson(text), false); assert.equal(JSON.stringify(api.store.getState()), before); assert.equal(env.data.get(D.KEY), raw);
  }
  env.context.localStorage.setItem = () => { throw new Error('quota'); };
  assert.equal(api.importJson(serializedMap()), false); assert.equal(JSON.stringify(api.store.getState()), before); assert.equal(env.data.get(D.KEY), raw);
});

test('every user-authored title/description renders as text and SVG export escapes metacharacters', () => {
  const env = boot(), {context, $} = env, payload = '<img src=x onerror="window.pwned=1"><svg onload="window.pwned=1"> & ação';
  const goal = context.NabnakStore.addGoal({title: payload, description: payload, dueDate: '2099-01-01', target: 1});
  context.NabnakStore.addTask({title: payload, goalId: goal.id}); $('open-goals').click();
  assert.equal($('goals-list').querySelector('h2').textContent, payload); assert.equal($('goals-list').querySelector('img'), null);
  const api = context.NabnakMindmaps; api.open();
  api.store.edit(state => { state.maps[0].title = payload; state.maps[0].nodes[0].title = payload; state.maps[0].nodes[0].description = payload; });
  const svg = api.svgExport(api.store.getState().maps[0]); assert.doesNotMatch(svg, /<img|<script|<svg onload/); assert.match(svg, /&lt;img/);
  const map = D.newMap('Map', 'Root'); map.nodes[0].width = '1" onload="alert(1)'; assert.throws(() => api.svgExport(map));
  assert.equal(context.pwned, undefined);
});

test('recovery uses versioned allowlisted keys, validates before writing, and clear preserves unrelated data', () => {
  const storage = memory({'unrelated.app': 'keep', [D.KEY]: serializedMap(), 'nabnak.theme': 'dark', 'nabnak.data.backup': '{broken'});
  const exported = R.backup(storage), entries = R.validate(exported, T, D);
  const target = memory({'unrelated.app': 'keep'}); R.restore(target, entries);
  assert.equal(target.getItem(D.KEY), storage.getItem(D.KEY)); assert.equal(target.getItem('nabnak.data.backup'), '{broken');
  for (const raw of [exported.replace('"version": 1', '"version": 99'), JSON.stringify({format: 'nabnak-recovery', version: 1, entries: {'unrelated.app': 'bad'}})]) assert.throws(() => R.validate(raw, T, D));
  R.clear(target); assert.equal(target.getItem('unrelated.app'), 'keep'); assert.equal(target.getItem(D.KEY), null);
});

test('recovery rollback retains preexisting values after a quota failure', () => {
  const storage = memory({'nabnak.language': 'en'}); let writes = 0;
  const set = storage.setItem; storage.setItem = (key, value) => { if (++writes === 2) throw new Error('quota'); set(key, value); };
  assert.throws(() => R.restore(storage, {'nabnak.language': 'es', 'nabnak.theme': 'dark'}), /recoveryError/);
  assert.equal(storage.getItem('nabnak.language'), 'en'); assert.equal(storage.getItem('nabnak.theme'), null);
});

test('clipboard and drop handlers prevent rich insertion and do not multiply across repeated editing', () => {
  const env = boot(), api = env.context.NabnakMindmaps; api.open();
  const title = env.$('mm-nodes').querySelector('.mm-node-title'), original = title.textContent;
  const text = '<img src=x onerror="alert(1)">';
  title.fire('dblclick');
  const paste = {getData: type => type === 'text/plain' ? text : '<svg onload="alert(1)">'};
  assert.equal(title.fire('paste', {clipboardData: paste}), false); assert.equal(title.textContent, original + text);
  title.fire('keydown', {key: 'Escape'}); title.fire('dblclick');
  assert.equal(title.fire('drop', {dataTransfer: paste}), false); assert.equal(title.textContent, original + text);
  assert.equal(title.querySelector('img'), null);
});

test('unsaved recovery snapshots restore safely and retain previous serialized bytes', () => {
  const saved = serializedMap(), unsaved = JSON.stringify({version: 2, maps: [D.newMap('Unsaved', 'Root')]});
  const storage = memory({[D.KEY]: saved}), exported = R.backup(storage, {[D.KEY]: unsaved});
  const entries = R.validate(exported, T, D); assert.equal(entries[D.KEY], unsaved); assert.equal(entries[D.KEY + '.backup'], saved);
  R.restore(storage, entries); assert.equal(storage.getItem(D.KEY), unsaved); assert.equal(storage.getItem(D.KEY + '.backup'), saved);
  assert.throws(() => R.validate(R.backup(storage, {'unrelated.app': 'bad'}), T, D), /recoveryError/);
  assert.throws(() => R.restore(storage, {[D.KEY]: '{broken'})); assert.equal(storage.getItem(D.KEY), unsaved);
});

test('clear requires UI confirmation, keeps unrelated keys and all new messages translate', () => {
  const env = boot(new Map([['unrelated.app', 'keep']])), before = new Map(env.data);
  env.context.localStorage.removeItem = key => env.data.delete(key);
  env.context.confirm = () => false; env.$('clear-data').click(); assert.deepEqual(env.data, before);
  env.context.confirm = () => true; env.$('clear-data').click(); assert.equal(env.data.get('unrelated.app'), 'keep');
  assert.equal(env.data.has(T.STORAGE_KEY), false);
  for (const lang of ['en', 'pt-BR', 'es']) {
    env.document.querySelector(`input[value="${lang}"]`).click();
    for (const key of ['invalidInput', 'inputTooLong', 'resourceLimit', 'unsafeKeys', 'unsupportedVersion', 'storageConflict', 'dataPrivacy', 'privacyInfo', 'backupData', 'restoreData', 'clearData', 'clearDataConfirm', 'restoreConfirm', 'recoveryError', 'recoveryDone', 'clearDone']) assert.notEqual(env.context.NabnakI18n.t(key), key, lang + ': ' + key);
  }
});

test('SVG preserves legitimate Unicode while replacing XML-invalid characters and CSP is declared first', async () => {
  const env = boot(), map = D.newMap('ação 😀\u0000\ud800', 'Root');
  const svg = env.context.NabnakMindmaps.svgExport(map); assert.match(svg, /ação 😀/); assert.doesNotMatch(svg, /[\u0000\ud800]/u);
  const html = await fs.readFile(path.join(__dirname, '../index.html'), 'utf8'), csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script'));
  assert.match(csp, /script-src 'self';/); assert.match(csp, /connect-src 'none';/); assert.doesNotMatch(csp, /unsafe-eval/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/); assert.doesNotMatch(html, /https:\/\/fonts\./);
});

function request(server, target, method = 'GET', host) {
  return new Promise((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port: server.address().port, path: target, method, headers: host ? {host} : {}}, res => { res.resume(); res.on('end', () => resolve(res)); });
    req.on('error', reject); req.end();
  });
}
test('localhost server blocks traversal, methods, sensitive files, host rebinding and symbolic links', async t => {
  const server = await startServer(); t.after(() => new Promise(resolve => server.close(resolve)));
  assert.equal(server.address().address, '127.0.0.1');
  for (const target of ['/../index.html', '/%2e%2e/index.html', '/js/%2e%2e/index.html', '/js%5c..%5cindex.html', '/.git/config', '/package.json', '/tools/serve.cjs', '/tests/store.test.cjs', '/docs/SECURITY.md', '/.env', '/node_modules/playwright/package.json', '/%00']) {
    assert.notEqual((await request(server, target)).statusCode, 200, target);
  }
  assert.equal((await request(server, '/', 'POST')).statusCode, 405);
  assert.equal((await request(server, '/', 'GET', 'evil.example')).statusCode, 403);
  const response = await request(server, '/'); assert.equal(response.statusCode, 200); assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.match(response.headers['content-security-policy'], /script-src 'self'/);
  assert.equal((await request(server, '/js/security.js', 'HEAD')).statusCode, 200);
  assert.equal((await request(server, '/assets/fonts/Nunito.ttf')).headers['content-type'], 'font/ttf');
  const link = path.resolve(__dirname, '../assets/security-link');
  try {
    await fs.symlink(path.resolve(__dirname, '../tools'), link, 'junction');
    assert.notEqual((await request(server, '/assets/security-link/serve.cjs')).statusCode, 200);
    const withLink = await startServer();
    try { assert.notEqual((await request(withLink, '/assets/security-link/serve.cjs')).statusCode, 200); }
    finally { await new Promise(resolve => withLink.close(resolve)); }
  } catch (error) { if (!['EPERM', 'EACCES'].includes(error.code)) throw error; t.diagnostic('Symlink creation unavailable on this OS; link checks not exercised.'); }
  finally { try { await fs.unlink(link); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
});
