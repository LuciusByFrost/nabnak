const test = require('node:test');
const assert = require('node:assert/strict');
const {boot} = require('./dom-harness.cjs');

test('theme preference persists separately without mutating user tasks or maps', () => {
  const app = boot();
  const tasks = app.data.get('nabnak.data');
  app.context.NabnakTheme.set('dark');
  assert.equal(app.document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(app.data.get('nabnak.theme'), 'dark');
  app.context.NabnakTheme.set('invalid');
  assert.equal(app.context.NabnakTheme.preference, 'dark');
  const reloaded = boot(app.data);
  assert.equal(reloaded.document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(app.data.get('nabnak.data'), tasks);
  assert.equal(app.data.has('nabnak.mindmaps'), false);
});

test('system theme follows OS changes while an explicit preference stays stable', () => {
  const app = boot(); const {context, document} = app;
  const scheme = app.media.find(item => item.query.includes('prefers-color-scheme'));
  scheme.change(true); assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  context.NabnakTheme.set('light'); scheme.change(false); scheme.change(true);
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  context.NabnakTheme.set('system'); assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
});

test('crossing the mobile breakpoint releases content and restores the desktop sidebar choice', () => {
  const app = boot(new Map(), {width: 1440});
  const desktop = app.media.find(item => item.query.includes('1100px'));
  desktop.change(false); assert.equal(app.$('language-panel').inert, true);
  app.$('language-toggle').click(); assert.equal(app.document.querySelector('.workspace').inert, true);
  desktop.change(true); assert.equal(app.document.querySelector('.workspace').inert, false);
  assert.equal(app.$('language-panel').inert, false);
});

test('desktop sidebar choice survives reload and stays open when navigating', () => {
  const app = boot(new Map(), {width: 1440});
  assert.equal(app.$('language-panel').inert, false);
  app.$('open-calendar').click();
  assert.equal(app.$('language-panel').inert, false);
  app.$('language-toggle').click();
  assert.equal(app.data.get('nabnak.sidebar'), 'collapsed');
  const reloaded = boot(app.data, {width: 1440});
  assert.equal(reloaded.$('language-panel').inert, true);
  reloaded.$('language-toggle').click();
  assert.equal(boot(app.data, {width: 1440}).$('language-panel').inert, false);
});

test('mobile menu traps focus, closes on Escape and does not erase desktop preference', () => {
  const app = boot(new Map([['nabnak.sidebar', 'open']]));
  app.$('language-toggle').click();
  assert.equal(app.document.querySelector('.workspace').inert, true);
  app.$('skin-midnight').focus();
  app.document.fire('keydown', {key: 'Tab'});
  assert.equal(app.document.activeElement, app.$('language-toggle'));
  app.document.fire('keydown', {key: 'Escape'});
  assert.equal(app.document.querySelector('.workspace').inert, false);
  assert.equal(app.data.get('nabnak.sidebar'), 'open');
});

test('main views are exclusive, update navigation and flush map drafts when leaving', () => {
  const app = boot(); const {$, context, document} = app;
  $('open-mindmaps').click(); $('mm-add').click();
  $('mm-description').focus(); $('mm-description').value = 'Draft survives view navigation';
  $('open-calendar').click();
  assert.equal($('mindmap-view').hidden, true);
  assert.equal($('calendar-dialog').hidden, false);
  assert.equal(document.querySelector('.workspace').hidden, true);
  assert.equal($('open-calendar').getAttribute('aria-current'), 'page');
  const state = context.NabnakMindmaps.store.getState();
  assert.ok(state.maps[0].nodes.some(node => node.description === 'Draft survives view navigation'));
  assert.equal(document.querySelectorAll('dialog').length, 2);
  $('open-goals').click();
  assert.equal($('calendar-dialog').hidden, true); assert.equal($('goals-dialog').hidden, false);
  $('goals-dialog').querySelector('[data-back-tasks]').click();
  assert.equal(document.querySelector('.workspace').hidden, false);
  assert.equal(document.querySelector('.skip-link').getAttribute('href'), '#workspace-title');
});

test('calendar arrows cross month/year boundaries with one day in the tab sequence', () => {
  const {$, document} = boot(); $('open-calendar').click();
  $('calendar-month').value = '2026-12'; $('calendar-month').fire('change');
  $('calendar-days').querySelector('[data-date="2026-12-31"]').click();
  $('calendar-days').fire('keydown', {key: 'ArrowRight', target: document.activeElement});
  assert.equal($('calendar-month').value, '2027-01');
  assert.equal(document.activeElement.dataset.date, '2027-01-01');
  assert.equal($('calendar-days').querySelectorAll('button').filter(button => button.tabIndex === 0).length, 1);
});

test('maps allow normal Tab, optional legacy editing shortcut, movement controls and undo', () => {
  const {$, context, document} = boot(); $('open-mindmaps').click();
  const editor = context.NabnakMindmaps;
  const map = () => editor.store.getState().maps[0];
  const root = document.querySelector('.mm-node');
  document.fire('keydown', {key: 'Tab', target: root}); assert.equal(map().nodes.length, 1);
  $('mm-edit-mode').checked = true;
  document.fire('keydown', {key: 'Tab', target: root}); assert.equal(map().nodes.length, 2);
  const x = map().nodes[1].x;
  $('mm-move-right').click(); assert.equal(map().nodes[1].x, x + 32);
  $('mm-undo').click(); assert.equal(map().nodes[1].x, x);
  const cameraX = map().camera.x;
  $('mm-pan-right').click(); assert.notEqual(map().camera.x, cameraX);
  $('mm-details-toggle').click(); assert.equal($('mm-inspector').hidden, false);
  document.fire('keydown', {key: 'Escape', target: $('mm-viewport')}); assert.equal($('mm-edit-mode').checked, false);
});
