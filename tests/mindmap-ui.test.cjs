const test = require('node:test');
const assert = require('node:assert/strict');
const {boot} = require('./dom-harness.cjs');
function fixture(data) {
  const app = boot(data); const editor = app.context.NabnakMindmaps;
  app.$('open-mindmaps').click();
  const map = () => editor.store.getState().maps.find(map => map.id === editor.store.getState().activeMapId);
  const element = id => app.document.querySelector(`[data-node-id="${id}"]`);
  return {...app, editor, map, element};
}
test('sidebar opens the independent map view with a central idea, and back restores the Kanban', () => {
  const app = fixture(); const {$, document, map} = app;
  assert.equal($('mindmap-view').hidden, false); assert.equal(document.querySelector('.workspace').hidden, true);
  assert.equal(map().nodes.length, 1); assert.equal(map().nodes[0].isRoot, true);
  $('mm-back').click(); assert.equal($('mindmap-view').hidden, true); assert.equal(document.querySelector('.workspace').hidden, false);
});
test('main and subideas connect automatically, duplicate, collapse, expand, delete and restore with history', () => {
  const {$, editor, map, document} = fixture();
  $('mm-add').click(); const main = map().nodes[1]; $('mm-child').click(); const sub = map().nodes[2];
  assert.equal(sub.parentId, main.id); assert.equal(map().edges.length, 2);
  editor.select(main.id); $('mm-collapse').click(); assert.equal(document.querySelectorAll('.mm-node').length, 2);
  $('mm-collapse').click(); assert.equal(document.querySelectorAll('.mm-node').length, 3);
  $('mm-duplicate').click(); assert.equal(map().nodes.length, 4); $('mm-undo').click(); assert.equal(map().nodes.length, 3); $('mm-redo').click(); assert.equal(map().nodes.length, 4);
  editor.select(main.id); $('mm-delete').click(); assert.equal(map().nodes.length, 2); $('mm-undo').click(); assert.equal(map().nodes.length, 4);
});
test('title, description, colors, multiple maps and camera survive reload without changing tasks', () => {
  const app = fixture(); const {$, context, editor, map} = app; const tasks = app.data.get('nabnak.data');
  $('mm-add').click(); $('mm-title').value = 'User title'; $('mm-title').fire('change');
  $('mm-description').value = 'User description'; $('mm-description').fire('change');
  $('mm-color').value = '#b38ae0'; $('mm-color').fire('change');
  const originalId = map().id; $('mm-map-name').value = 'Named map'; $('mm-map-name').fire('change');
  $('mm-new').click(); assert.equal(editor.store.getState().maps.length, 2);
  $('mm-map-select').value = originalId; $('mm-map-select').fire('change');
  const reloaded = fixture(app.data); assert.equal(reloaded.map().title, 'Named map');
  const node = reloaded.map().nodes.find(node => node.title === 'User title'); assert.equal(node.description, 'User description'); assert.equal(node.color, '#b38ae0');
  assert.equal(app.data.get('nabnak.data'), tasks); assert.ok(context.NabnakStore.getState().tasks.length > 0);
});
for (const pointerType of ['mouse', 'touch']) {
  test(`dragging only the chosen node updates curves and is undoable with ${pointerType}`, () => {
    const app = fixture(); const {$, map, element} = app; $('mm-add').click();
    const before = map(), child = before.nodes[1], root = before.nodes[0], viewport = $('mm-viewport');
    const edge = $('mm-edges').querySelector('.mm-edge').getAttribute('d');
    viewport.fire('pointerdown', {target: element(child.id), pointerId: 1, pointerType, clientX: 20, clientY: 30, button: 0});
    viewport.fire('pointermove', {pointerId: 1, pointerType, clientX: 100, clientY: 80});
    assert.notEqual($('mm-edges').querySelector('.mm-edge').getAttribute('d'), edge);
    viewport.fire('pointerup', {pointerId: 1, pointerType});
    assert.notEqual(map().nodes[1].x, child.x); assert.equal(map().nodes[1].manual, true);
    assert.deepEqual([map().nodes[0].x, map().nodes[0].y], [root.x, root.y]);
    $('mm-undo').click(); assert.equal(map().nodes[1].x, child.x);
  });
}
test('background pan, wheel zoom, center, fit and pinch update the saved camera without moving ideas', () => {
  const {$, map} = fixture(); const viewport = $('mm-viewport'), positions = JSON.stringify(map().nodes);
  viewport.fire('pointerdown', {target: viewport, pointerId: 1, clientX: 10, clientY: 10, button: 0});
  viewport.fire('pointermove', {pointerId: 1, clientX: 110, clientY: 90}); viewport.fire('pointerup', {pointerId: 1});
  const panned = {...map().camera}; viewport.fire('wheel', {deltaY: -150, clientX: 50, clientY: 50});
  assert.ok(map().camera.zoom > panned.zoom); assert.equal(JSON.stringify(map().nodes), positions);
  $('mm-center').click(); $('mm-fit').click(); const before = map().camera.zoom;
  viewport.fire('pointerdown', {target: viewport, pointerId: 1, clientX: 10, clientY: 10, pointerType: 'touch'});
  viewport.fire('pointerdown', {target: viewport, pointerId: 2, clientX: 110, clientY: 10, pointerType: 'touch'});
  viewport.fire('pointermove', {pointerId: 2, clientX: 210, clientY: 10});
  viewport.fire('pointerup', {pointerId: 2}); viewport.fire('pointerup', {pointerId: 1});
  assert.ok(map().camera.zoom > before); assert.equal(JSON.stringify(map().nodes), positions);
});
test('connect by selection, reject duplicates and remove both manual and tree connections', () => {
  const {$, editor, map} = fixture(); $('mm-add').click(); const a = map().nodes[1]; $('mm-add').click(); const b = map().nodes[2];
  editor.select(a.id); $('mm-connect').click(); editor.select(b.id); assert.equal(map().edges.length, 3);
  editor.select(b.id); $('mm-connect').click(); editor.select(a.id); assert.equal(map().edges.length, 3);
  // Cancel connect mode before selecting the SVG hit area.
  const hits = $('mm-edges').querySelectorAll('.mm-edge-hit'); hits[2].fire('pointerdown'); $('mm-remove-edge').click(); assert.equal(map().edges.length, 2);
  $('mm-edges').querySelector('.mm-edge-hit').fire('pointerdown'); $('mm-remove-edge').click(); assert.equal(map().nodes[1].parentId, null);
});
test('connections can be selected from a native keyboard/touch control and removed without deleting nodes', () => {
  const {$, map} = fixture(); $('mm-add').click(); const edge = map().edges[0];
  assert.equal($('mm-connections-label').hidden, false);
  $('mm-connection-select').value = edge.id; $('mm-connection-select').fire('change');
  assert.equal($('mm-remove-edge').hidden, false); $('mm-remove-edge').click();
  assert.equal(map().edges.length, 0); assert.equal(map().nodes.length, 2); assert.equal($('mm-connections-label').hidden, true);
});
test('Tab and Delete apply only outside text editing; direct title editing commits safely', () => {
  const {$, map, element, document, editor} = fixture(); const root = map().rootId;
  $('mm-edit-mode').checked = true; document.fire('keydown', {key: 'Tab', target: element(root)}); assert.equal(map().nodes.length, 2);
  const child = map().nodes[1]; const input = $('mm-title'); input.value = 'Keep editing';
  document.fire('keydown', {key: 'Delete', target: input}); assert.equal(map().nodes.length, 2);
  const title = element(child.id).querySelector('.mm-node-title'); title.fire('dblclick'); title.textContent = 'Directly edited'; title.fire('blur');
  assert.equal(map().nodes[1].title, 'Directly edited');
  document.fire('keydown', {key: 'Delete', target: element(child.id)}); assert.equal(map().nodes.length, 1);
  editor.select(root); document.fire('keydown', {key: 'Delete', target: element(root)}); assert.equal(map().nodes.length, 1);
});
test('selection and camera saves preserve the DOM needed for double-click and in-progress title editing', () => {
  const {$, editor, map, element} = fixture(); $('mm-add').click(); const child = map().nodes[1], original = element(child.id), viewport = $('mm-viewport');
  for (let i = 0; i < 2; i++) {
    viewport.fire('pointerdown', {target: original.querySelector('.mm-node-title'), pointerId: 1, clientX: 50, clientY: 50, button: 0});
    viewport.fire('pointerup', {pointerId: 1}); assert.equal(element(child.id), original);
  }
  const title = original.querySelector('.mm-node-title'); title.fire('dblclick'); title.textContent = 'Draft survives zoom';
  $('mm-zoom-in').click(); assert.equal(element(child.id), original); assert.equal(title.textContent, 'Draft survives zoom');
  title.fire('blur'); assert.equal(map().nodes[1].title, 'Draft survives zoom');
  editor.select(child.id); const draft = element(child.id).querySelector('.mm-node-title'); draft.fire('dblclick'); draft.textContent = 'Cancel this';
  draft.fire('keydown', {key: 'Escape'}); assert.equal(map().nodes[1].title, 'Draft survives zoom');
});
test('JSON import appends remapped copies; JSON and SVG downloads create and release correctly typed blobs', () => {
  const app = fixture(); const {$, editor, context, map} = app; $('mm-add').click();
  const before = editor.store.getState(), originalId = map().id;
  assert.equal(editor.importJson(JSON.stringify(before)), true); const state = editor.store.getState();
  assert.equal(state.maps.length, 2); assert.equal(state.maps[0].id, originalId); assert.notEqual(state.maps[1].id, originalId);
  assert.equal(state.maps[1].nodes.length, state.maps[0].nodes.length);
  assert.notEqual(state.maps[1].nodes[0].id, state.maps[0].nodes[0].id);
  assert.equal(state.maps[1].nodes[1].parentId, state.maps[1].rootId);
  const saved = app.data.get('nabnak.mindmaps'); assert.equal(editor.importJson('{bad'), false); assert.equal(app.data.get('nabnak.mindmaps'), saved);
  const blobs = [], revoked = []; context.Blob = Blob; context.URL = {createObjectURL(blob) { blobs.push(blob); return 'blob:test'; }, revokeObjectURL(url) { revoked.push(url); }};
  $('mm-export-format').value = 'json'; $('mm-export').click(); assert.equal(blobs[0].type, 'application/json');
  $('mm-export-format').value = 'svg'; $('mm-export').click(); assert.equal(blobs[1].type, 'image/svg+xml'); assert.equal(revoked.length, 2);
});
test('pagehide flushes a focused inspector field and inline title before a reload', () => {
  const app = fixture(); const {$, map, element, document} = app; $('mm-add').click();
  $('mm-description').focus(); $('mm-description').value = 'Persist without leaving this field'; document.fire('window:pagehide');
  const child = map().nodes[1], title = element(child.id).querySelector('.mm-node-title');
  title.fire('dblclick'); title.textContent = 'Persist inline draft'; document.fire('window:pagehide');
  const reloaded = fixture(app.data).map().nodes.find(node => node.id === child.id);
  assert.equal(reloaded.description, 'Persist without leaving this field'); assert.equal(reloaded.title, 'Persist inline draft');
});
test('map keyboard commands ignore sidebar controls, dialogs and editable fields; arrow keys select ideas', () => {
  const {$, map, element, document, editor} = fixture(); $('mm-add').click();
  const child = map().nodes[1], root = map().nodes[0];
  document.fire('keydown', {key: 'Delete', target: $('open-calendar')}); assert.equal(map().nodes.length, 2);
  $('open-calendar').click(); document.fire('keydown', {key: 'Delete', target: element(child.id)}); assert.equal(map().nodes.length, 2); $('open-mindmaps').click();
  editor.select(root.id); document.fire('keydown', {key: 'ArrowRight', target: element(root.id)}); assert.equal($('mm-title').value, child.title);
  document.fire('keydown', {key: 'z', ctrlKey: true, target: element(child.id)}); assert.equal(map().nodes.length, 1);
  document.fire('keydown', {key: 'z', ctrlKey: true, shiftKey: true, target: $('mm-viewport')}); assert.equal(map().nodes.length, 2);
});
for (const language of ['pt-BR', 'en', 'es']) {
  test(`map controls translate and creating a Kanban task uses the existing confirmation editor in ${language}`, () => {
    const app = fixture(new Map([['nabnak.language', language]])); const {$, context, map} = app;
    $('mm-add').click(); $('mm-title').value = 'User-authored idea'; $('mm-title').fire('change');
    const originalTasks = context.NabnakStore.getState().tasks.length, nodeCount = map().nodes.length;
    $('mm-task').click(); assert.equal($('task-dialog').open, true); assert.equal($('edit-task-title').value, 'User-authored idea');
    assert.equal(context.NabnakStore.getState().tasks.length, originalTasks);
    $('edit-task-title').value = 'Confirmed task'; $('task-editor-form').fire('submit');
    assert.equal(context.NabnakStore.getState().tasks.length, originalTasks + 1); assert.equal(map().nodes.length, nodeCount);
    assert.equal(map().nodes[1].title, 'User-authored idea');
    assert.equal($('mm-add').getAttribute('title'), context.NabnakI18n.t('mmAdd'));
    $('open-calendar').click(); assert.equal($('calendar-dialog').hidden, false); $('open-mindmaps').click();
    $('open-goals').click(); assert.equal($('goals-dialog').hidden, false);
    assert.ok(context.NabnakStore.getState().tasks.some(task => task.title === 'Confirmed task'));
  });
}
test('SVG export escapes user text, preserves branch colors and omits collapsed descendants', () => {
  const {$, editor, map} = fixture(); $('mm-add').click(); $('mm-title').value = '<script>alert("x")</script>'; $('mm-title').fire('change');
  const svg = editor.svgExport(map()); assert.match(svg, /&lt;script&gt;/); assert.doesNotMatch(svg, /<script>/); assert.match(svg, /<path d="M/);
  assert.match(svg, /stroke="#65a9ed"/);
  $('mm-child').click(); $('mm-title').value = 'Hidden unique descendant'; $('mm-title').fire('change');
  assert.match(editor.svgExport(map()), /Hidden unique descendan/);
  editor.select(map().nodes[1].id); $('mm-collapse').click();
  assert.doesNotMatch(editor.svgExport(map()), /Hidden unique descendan/);
});
test('unsupported existing map data disables mutations and remains byte-for-byte intact', () => {
  const original = '{"version":99,"maps":[]}', data = new Map([['nabnak.mindmaps', original]]), app = fixture(data);
  assert.equal(app.editor.store.isReadOnly(), true); assert.equal(app.$('mm-new').disabled, true);
  app.editor.add(); assert.equal(data.get('nabnak.mindmaps'), original); assert.ok(app.$('mm-message').textContent.length > 20);
});
