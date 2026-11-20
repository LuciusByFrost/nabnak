const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/mindmap-data.js');
const memory = (data = new Map()) => ({data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)});
function fixture() {
  const storage = memory(), store = D.createStore(storage), map = D.newMap('Roadmap', 'Project');
  store.edit(state => { state.maps.push(map); state.activeMapId = map.id; });
  return {storage, store, map};
}
test('maps save titles, descriptions, colors, positions, camera, hierarchy and collapsed branches across reload', () => {
  const {storage, store, map} = fixture(); let child;
  store.edit(state => {
    const current = state.maps[0]; child = D.addNode(current, current.rootId, 'Planning'); child.description = 'Line one\nLine two'; child.color = '#65a9ed';
    D.addNode(current, child.id, 'Nested idea'); D.layout(current); child.manual = true; child.x = -481; child.y = 321; child.collapsed = true;
  });
  store.view(map.id, {x: 310, y: -88, zoom: .7});
  const restored = D.createStore(storage).getState().maps[0];
  const node = restored.nodes.find(node => node.id === child.id);
  assert.equal(node.description, 'Line one\nLine two'); assert.equal(node.color, '#65a9ed'); assert.equal(node.manual, true);
  assert.equal(node.x, -481); assert.equal(node.y, 321); assert.equal(node.collapsed, true);
  assert.equal(restored.edges.length, 2); assert.deepEqual(restored.camera, {x: 310, y: -88, zoom: .7});
  assert.equal(D.visibleNodes(restored).length, 2);
});
test('radial organization places long, multiline branches on both sides without overlap', () => {
  const map = D.newMap('Large map', 'Central');
  for (let i = 0; i < 18; i++) {
    const main = D.addNode(map, map.rootId, 'Long title '.repeat(i % 5 + 1));
    main.description = 'Description '.repeat(i % 7);
    for (let j = 0; j < i % 4; j++) D.addNode(map, main.id, 'Subidea with several lines\nand accented text: organização');
  }
  D.layout(map, {force: true});
  assert.ok(map.nodes.some(node => node.x < 0)); assert.ok(map.nodes.some(node => node.x > 0));
  for (let a = 0; a < map.nodes.length; a++) for (let b = a + 1; b < map.nodes.length; b++) assert.equal(D.overlaps(map.nodes[a], map.nodes[b], 0), false, `${a} overlaps ${b}`);
});
test('adding and editing branches preserve every manually positioned node; explicit organization can move them', () => {
  const map = D.newMap('Map', 'Center'), main = D.addNode(map, map.rootId, 'Manual');
  main.x = -999; main.y = 785; main.manual = true;
  const sub = D.addNode(map, main.id, 'Child'); sub.x = 650; sub.y = -900; sub.manual = true;
  for (let i = 0; i < 8; i++) D.addNode(map, map.rootId, 'Auto');
  D.layout(map); assert.deepEqual([main.x, main.y, sub.x, sub.y], [-999, 785, 650, -900]);
  D.layout(map, {force: true}); assert.notEqual(main.x, -999); assert.equal(main.manual, false); assert.equal(sub.manual, false);
});
test('connect rejects self, reverse duplicates, tree duplicates and missing endpoints; disconnect detaches hierarchy', () => {
  const map = D.newMap('Map', 'Center'), a = D.addNode(map, map.rootId, 'A'), b = D.addNode(map, map.rootId, 'B');
  assert.equal(D.connect(map, a.id, a.id), false); assert.equal(D.connect(map, a.id, 'missing'), false);
  assert.equal(D.connect(map, a.id, map.rootId), false); assert.equal(D.connect(map, a.id, b.id), true); assert.equal(D.connect(map, b.id, a.id), false);
  D.disconnect(map, map.edges.find(edge => edge.target === a.id && edge.kind === 'tree').id);
  assert.equal(a.parentId, null); assert.equal(map.nodes.length, 3);
});
test('deleting branches removes descendants and attached links; duplication leaves the original intact', () => {
  const map = D.newMap('Map', 'Center'), a = D.addNode(map, map.rootId, 'A');
  const b = D.addNode(map, a.id, 'B'), c = D.addNode(map, map.rootId, 'C'); D.connect(map, b.id, c.id);
  a.description = 'Keep this'; const duplicate = D.duplicateNode(map, a.id); assert.notEqual(duplicate.id, a.id); assert.equal(duplicate.description, 'Keep this');
  D.removeNode(map, a.id); assert.equal(map.nodes.some(node => [a.id, b.id].includes(node.id)), false);
  assert.equal(map.edges.some(edge => edge.source === b.id || edge.target === b.id), false); assert.ok(map.nodes.includes(duplicate));
  assert.throws(() => D.removeNode(map, map.rootId), /mmRootProtected/);
});
test('undo and redo restore addition, editing, movement, connections and deletion; new edits clear redo', () => {
  const {store} = fixture();
  const states = [store.getState()];
  for (const operation of [
    map => D.addNode(map, map.rootId, 'A'),
    map => { map.nodes[1].title = 'Edited'; map.nodes[1].description = 'Description'; },
    map => { map.nodes[1].manual = true; map.nodes[1].x = 123; },
    map => { const b = D.addNode(map, map.rootId, 'B'); D.connect(map, map.nodes[1].id, b.id); },
    map => D.removeNode(map, map.nodes[1].id)
  ]) { store.edit(state => operation(state.maps[0])); states.push(store.getState()); }
  for (let i = states.length - 2; i >= 0; i--) { store.undo(); assert.deepEqual(store.getState(), states[i]); }
  for (let i = 1; i < states.length; i++) { store.redo(); assert.deepEqual(store.getState(), states[i]); }
  store.undo(); store.edit(state => { state.maps[0].title = 'New history'; }); assert.equal(store.canRedo(), false);
});
test('camera zoom keeps the point under the cursor fixed and fit includes all visible nodes', () => {
  const before = {x: 48, y: 60, zoom: .8}, point = {x: 300, y: 200}; const after = D.zoomAt(before, 1.5, point);
  assert.equal((point.x - before.x) / before.zoom, (point.x - after.x) / after.zoom);
  assert.equal((point.y - before.y) / before.zoom, (point.y - after.y) / after.zoom);
  const map = D.newMap('Map', 'Root'); for (let i = 0; i < 4; i++) D.addNode(map, map.rootId, 'Idea'); D.layout(map);
  for (const [width, height] of [[1200, 800], [360, 480]]) {
    const camera = D.fitCamera(map, width, height), bounds = D.bounds(map);
    assert.ok(bounds.left * camera.zoom + camera.x >= 0); assert.ok(bounds.right * camera.zoom + camera.x <= width);
    assert.ok(bounds.top * camera.zoom + camera.y >= 0); assert.ok(bounds.bottom * camera.zoom + camera.y <= height);
  }
  assert.equal(D.zoomAt(before, 100, point).zoom, 3); assert.equal(D.zoomAt(before, .0001, point).zoom, .01);
});
test('curves change with node movement and remain valid on the left side', () => {
  const map = D.newMap('Map', 'Center'), child = D.addNode(map, map.rootId, 'Child'); D.layout(map);
  const path = D.curve(map.nodes[0], child); assert.match(path, /^M .+ C /); child.x = -700; child.y = 200;
  assert.notEqual(D.curve(map.nodes[0], child), path); assert.doesNotMatch(D.curve(map.nodes[0], child), /NaN|Infinity/);
});
for (const key of [D.KEY, 'nabnak.mindMaps', 'nabnak.maps']) {
  test(`legacy map under ${key} keeps its original bytes and unknown fields with a migration backup`, () => {
    const legacy = {version: 1, custom: 'untouched', maps: [{id: 'old', name: 'Legacy', notes: 'keep', nodes: [{id: 'root', text: 'Root', position: {x: 10, y: 20}, extra: 'preserved'}, {id: 'child', label: 'Child', parentId: 'root', x: 300, y: 40}], connections: []}]};
    const original = JSON.stringify(legacy), storage = memory(new Map([[key, original], ['nabnak.data', 'task data']])), store = D.createStore(storage);
    assert.equal(storage.getItem(key), original); const map = store.getState().maps[0];
    assert.equal(map.nodes[0].x, 10); assert.equal(map.nodes[0].manual, true); assert.equal(map.nodes[0].extra, 'preserved'); assert.equal(map.notes, 'keep');
    store.edit(state => { state.maps[0].title = 'Renamed'; });
    assert.equal(storage.getItem(key + '.backup'), original); assert.equal(storage.getItem('nabnak.data'), 'task data');
    assert.equal(D.createStore(storage).getState().maps[0].title, 'Renamed');
    if (key !== D.KEY) assert.equal(storage.getItem(key), original);
  });
}
for (const value of ['{broken', JSON.stringify({version: 99, maps: []}), JSON.stringify({version: 1, maps: [{nodes: [{id: 'a', parentId: 'b'}, {id: 'b', parentId: 'a'}]}]})]) {
  test(`unreadable, cyclic or future data is never overwritten: ${value.slice(0, 22)}`, () => {
    const storage = memory(new Map([[D.KEY, value]])), store = D.createStore(storage);
    assert.equal(store.isReadOnly(), true); assert.equal(store.getError(), 'mmReadError');
    assert.throws(() => store.edit(state => { state.maps = []; }), /mmReadError/);
    store.undo(); store.view('missing', {x: 2}); assert.equal(storage.getItem(D.KEY), value);
  });
}
test('write failures retain edits in memory and report exportable unsaved state', () => {
  const storage = {getItem: () => null, setItem() { throw new Error('quota'); }}, store = D.createStore(storage);
  store.edit(state => state.maps.push(D.newMap('Unsaved', 'Root')));
  assert.equal(store.getState().maps.length, 1); assert.equal(store.getError(), 'mmWriteError');
});
