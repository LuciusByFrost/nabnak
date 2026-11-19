const test = require('node:test');
const assert = require('node:assert/strict');
const {boot} = require('./dom-harness.cjs');
test('calendar UI creates, edits, reschedules and deletes tasks without duplication on reload', () => {
  let app = boot(); let {$, context} = app;
  const initial = context.NabnakStore.getState().tasks.length;
  $('open-calendar').click(); assert.equal($('calendar-dialog').open, true);
  $('calendar-month').value = '2024-02'; $('calendar-month').fire('change');
  assert.equal($('calendar-days').querySelectorAll('button').length, 29);
  $('calendar-days').querySelector('[data-date="2024-02-29"]').click();
  $('calendar-new-task').click(); assert.equal($('edit-task-date').value, '2024-02-29');
  $('edit-task-title').value = '<b>User-owned title</b>';
  $('task-editor-form').fire('submit');
  assert.equal($('task-dialog').open, false);
  assert.equal(context.NabnakStore.getState().tasks.length, initial + 1);
  assert.equal($('calendar-tasks').querySelectorAll('.planner-task').length, 1);
  const task = context.NabnakStore.tasksOn('2024-02-29')[0];
  context.NabnakPlanner.editTask(task.id);
  $('edit-task-title').value = 'Edited title'; $('edit-task-date').value = '2024-03-01'; $('task-editor-form').fire('submit');
  assert.equal(context.NabnakStore.tasksOn('2024-02-29').length, 0);
  assert.equal(context.NabnakStore.tasksOn('2024-03-01')[0].title, 'Edited title');
  context.NabnakPlanner.editTask(task.id); $('edit-task-date').value = ''; $('task-editor-form').fire('submit');
  assert.equal(context.NabnakStore.getState().tasks.find(item => item.id === task.id).dueDate, null);
  app = boot(app.data); ({$, context} = app);
  assert.equal(context.NabnakStore.getState().tasks.length, initial + 1);
  context.NabnakPlanner.editTask(task.id); context.confirm = () => false; $('delete-task').click();
  assert.equal(context.NabnakStore.getState().tasks.length, initial + 1);
  context.confirm = () => true; $('delete-task').click();
  assert.equal(context.NabnakStore.getState().tasks.length, initial);
});
test('calendar navigation, translated controls, user content and sidebar states', () => {
  const {$, context, document} = boot();
  $('language-toggle').click(); assert.equal($('language-panel').inert, false);
  $('open-calendar').click(); assert.equal($('language-panel').inert, true);
  $('calendar-month').value = '2026-12'; $('calendar-month').fire('change');
  $('next-month').click(); assert.equal($('calendar-month').value, '2027-01');
  $('previous-year').click(); assert.equal($('calendar-month').value, '2026-01');
  $('next-year').click(); $('previous-month').click(); assert.equal($('calendar-month').value, '2026-12');
  const task = context.NabnakStore.addTask({title: 'User content stays exact'});
  for (const language of ['pt-BR', 'es', 'en']) {
    document.querySelector(`input[value="${language}"]`).click();
    assert.equal($('open-calendar').textContent, context.NabnakI18n.t('calendar'));
    const card = document.querySelector(`[data-task-id="${task.id}"]`);
    assert.equal(card.querySelector('.content').textContent, task.title);
    assert.equal($('calendar-dialog').querySelector('[data-i18n-label="close"]').getAttribute('aria-label'), context.NabnakI18n.t('close'));
  }
  $('calendar-dialog').querySelector('[data-close-dialog]').click(); assert.equal($('calendar-dialog').open, false);
});
test('board form, drag/drop handlers, date retention, completed badges and card deletion', () => {
  const {$, context, document} = boot();
  $('task').value = 'Drag integration'; $('new-task-date').value = '2026-11-18'; $('addTask').fire('submit');
  const task = context.NabnakStore.getState().tasks.find(task => task.title === 'Drag integration');
  assert.equal($('task').value, '');
  for (const status of ['doing', 'done', 'todo']) {
    const card = document.querySelector(`[data-task-id="${task.id}"]`);
    card.fire('dragstart', {dataTransfer: {setData() {}}});
    $('' + status).fire('dragover', {dataTransfer: {}}); $('' + status).fire('drop');
    const current = context.NabnakStore.getState().tasks.find(item => item.id === task.id);
    assert.equal(current.status, status); assert.equal(current.dueDate, '2026-11-18');
    assert.equal(document.querySelector(`[data-task-id="${task.id}"]`).parentElement.id, status);
    if (status === 'done') assert.ok(document.querySelector(`[data-task-id="${task.id}"]`).querySelector('.completed'));
    assert.equal(document.querySelectorAll('.highlight').length, 0);
  }
  const card = document.querySelector(`[data-task-id="${task.id}"]`); card.querySelector('.card-delete').click();
  assert.equal(context.NabnakStore.getState().tasks.some(item => item.id === task.id), false);
});
test('goals UI creates and edits goals, associates existing and new tasks and confirms deletion', () => {
  const app = boot(); const {$, context, document} = app;
  const existing = context.NabnakStore.addTask({title: 'Existing task'});
  $('open-goals').click(); $('new-goal').click();
  $('edit-goal-title').value = 'My goal <script>literal</script>';
  $('edit-goal-description').value = 'User description'; $('edit-goal-date').value = '2026-12-01'; $('edit-goal-target').value = '2';
  $('goal-editor-form').fire('submit'); assert.equal($('goal-dialog').open, false);
  let goal = context.NabnakStore.getState().goals[0];
  let card = $('goals-list').querySelector('.goal-card'); assert.equal(card.querySelector('h3').textContent, goal.title);
  let associate = card.querySelector('.associate-form'); associate.querySelector('select').value = existing.id; associate.fire('submit');
  assert.equal(context.NabnakStore.getState().tasks.find(task => task.id === existing.id).goalId, goal.id);
  card = $('goals-list').querySelector('.goal-card');
  card.querySelector('.planner-actions').querySelectorAll('button')[1].click();
  assert.equal($('edit-task-goal').value, goal.id); $('edit-task-title').value = 'Created from goal'; $('edit-task-status').value = 'done'; $('task-editor-form').fire('submit');
  card = $('goals-list').querySelector('.goal-card'); assert.equal(card.querySelector('progress').value, 50);
  const existingCard = document.querySelector(`[data-task-id="${existing.id}"]`);
  existingCard.fire('dragstart', {dataTransfer: {setData() {}}}); $('done').fire('drop');
  card = $('goals-list').querySelector('.goal-card'); assert.equal(card.querySelector('progress').value, 100); assert.ok(card.classList.contains('goal-completed'));
  card.querySelector('.planner-actions').querySelectorAll('button')[0].click();
  $('edit-goal-title').value = 'Edited goal'; $('edit-goal-target').value = '4'; $('goal-editor-form').fire('submit');
  card = $('goals-list').querySelector('.goal-card'); assert.equal(card.querySelector('h3').textContent, 'Edited goal'); assert.equal(card.querySelector('progress').value, 50);
  const reloaded = boot(app.data); assert.equal(reloaded.context.NabnakStore.getState().goals[0].title, 'Edited goal');
  card.querySelector('.planner-actions').querySelectorAll('button')[0].click();
  context.confirm = () => false; $('delete-goal').click(); assert.equal(context.NabnakStore.getState().goals.length, 1);
  const tasksBefore = context.NabnakStore.getState().tasks.length;
  context.confirm = () => true; $('delete-goal').click();
  assert.equal(context.NabnakStore.getState().goals.length, 0); assert.equal(context.NabnakStore.getState().tasks.length, tasksBefore);
  assert.equal(context.NabnakStore.getState().tasks.some(task => task.goalId === goal.id), false);
});
test('goal/task unlinking, translated goals UI, user text and editor cancel', () => {
  const {$, context, document} = boot();
  const goal = context.NabnakStore.addGoal({title: 'User goal remains exact', description: 'User description', dueDate: '2026-11-01', target: 2});
  const task = context.NabnakStore.addTask({title: 'Associated', goalId: goal.id});
  $('open-goals').click();
  for (const lang of ['pt-BR', 'es', 'en']) {
    document.querySelector(`input[value="${lang}"]`).click();
    assert.equal($('open-goals').textContent, context.NabnakI18n.t('goals'));
    const card = $('goals-list').querySelector('.goal-card');
    assert.equal(card.querySelector('h3').textContent, goal.title); assert.equal(card.querySelector('.goal-description').textContent, goal.description);
  }
  const card = $('goals-list').querySelector('.goal-card');
  const unlink = card.querySelector('.planner-task').querySelectorAll('button')[1]; unlink.click();
  assert.equal(context.NabnakStore.getState().tasks.find(item => item.id === task.id).goalId, null);
  $('new-goal').click(); $('edit-goal-title').value = 'Do not save';
  $('goal-dialog').querySelectorAll('[data-close-dialog]')[1].click(); assert.equal(context.NabnakStore.getState().goals.length, 1);
});
test('calendar-created tasks link to goals, complete through the editor, and reload once', () => {
  const app = boot(new Map([['nabnak.language', 'pt-BR']])); const {$, context, document} = app;
  const goal = context.NabnakStore.addGoal({title: 'Meta do calendário', dueDate: '2027-02-01', target: 1});
  $('open-calendar').click(); $('calendar-month').value = '2027-01'; $('calendar-month').fire('change');
  $('calendar-days').querySelector('[data-date="2027-01-31"]').click(); $('calendar-new-task').click();
  $('edit-task-title').value = '<img src=x onerror=alert(1)>'; $('edit-task-goal').value = goal.id; $('task-editor-form').fire('submit');
  const task = context.NabnakStore.tasksOn('2027-01-31')[0]; assert.equal(task.goalId, goal.id);
  const content = document.querySelector(`[data-task-id="${task.id}"]`).querySelector('.content');
  assert.equal(content.textContent, task.title); assert.equal(content.querySelector('img'), null);
  context.NabnakPlanner.editTask(task.id); $('edit-task-status').value = 'done'; $('task-editor-form').fire('submit');
  $('calendar-dialog').close(); $('open-goals').click();
  assert.equal($('goals-list').querySelector('progress').value, 100);
  const next = boot(app.data);
  assert.equal(next.document.documentElement.lang, 'pt-BR');
  assert.equal(next.context.NabnakStore.tasksOn('2027-01-31').length, 1);
  assert.equal(next.context.NabnakStore.getState().tasks.find(item => item.id === task.id).goalId, goal.id);
});
test('invalid editor input reports translated errors without changing tasks or goals', () => {
  const {$, context, document} = boot();
  document.querySelector('input[value="es"]').click();
  $('open-calendar').click(); $('calendar-new-task').click();
  $('edit-task-title').value = 'Invalid date'; $('edit-task-date').value = '2026-02-30';
  const before = context.NabnakStore.getState().tasks.length; $('task-editor-form').fire('submit');
  assert.equal(context.NabnakStore.getState().tasks.length, before); assert.equal($('task-error').textContent, context.NabnakI18n.t('invalidDate'));
  $('task-dialog').close(); $('calendar-dialog').close(); $('open-goals').click(); $('new-goal').click();
  $('edit-goal-title').value = 'Invalid target'; $('edit-goal-date').value = '2027-01-01'; $('edit-goal-target').value = '0'; $('goal-editor-form').fire('submit');
  assert.equal(context.NabnakStore.getState().goals.length, 0); assert.equal($('goal-error').textContent, context.NabnakI18n.t('invalidTarget'));
});
for (const pointerType of ['mouse', 'touch']) {
  test(`card delete confirmation, focus and persistence with simulated ${pointerType} input`, () => {
    const app = boot(); const {$, context, document} = app;
    assert.equal($('garbage'), null); assert.equal(document.querySelectorAll('.dropZone').length, 3);
    const task = context.NabnakStore.addTask({title: 'Delete this task', dueDate: '2027-01-15'});
    const neighbor = context.NabnakStore.addTask({title: 'Keep this task'});
    const card = document.querySelector(`[data-task-id="${task.id}"]`);
    const button = card.querySelector('.card-delete');
    assert.equal(button.type, 'button'); assert.ok(button.getAttribute('aria-label').includes(task.title));
    assert.equal(button.querySelector('span').getAttribute('aria-hidden'), 'true');
    let confirmations = 0;
    context.confirm = message => { confirmations++; assert.equal(message, context.NabnakI18n.t('deleteTaskConfirm')); return false; };
    const before = app.data.get('nabnak.data');
    button.fire('pointerdown', {pointerType}); assert.equal(card.draggable, false);
    document.fire('pointerup', {pointerType}); assert.equal(card.draggable, true); button.click();
    assert.equal(confirmations, 1); assert.equal(app.data.get('nabnak.data'), before);
    assert.equal(document.querySelector(`[data-task-id="${task.id}"]`), card);
    assert.equal($('task-dialog').open, false);
    context.confirm = () => { confirmations++; return true; }; button.click();
    assert.equal(confirmations, 2); assert.equal(document.querySelector(`[data-task-id="${task.id}"]`), null);
    assert.equal(document.activeElement, document.querySelector(`[data-task-id="${neighbor.id}"]`).querySelector('.card-delete'));
    const reloaded = boot(app.data);
    assert.equal(reloaded.context.NabnakStore.getState().tasks.some(item => item.id === task.id), false);
    assert.ok(reloaded.context.NabnakStore.getState().tasks.some(item => item.id === neighbor.id));
  });
}
test('delete control does not start dragging or open the editor; edit and column movement still work', () => {
  const {$, context, document} = boot();
  const task = context.NabnakStore.addTask({title: 'Independent controls'});
  const card = document.querySelector(`[data-task-id="${task.id}"]`);
  const button = card.querySelector('.card-delete');
  button.fire('pointerdown', {pointerType: 'touch'}); assert.equal(card.draggable, false);
  document.fire('pointercancel'); assert.equal(card.draggable, true);
  assert.equal(button.fire('dragstart'), false); assert.equal(document.querySelectorAll('.highlight').length, 0);
  let confirmations = 0; context.confirm = () => { confirmations++; return false; };
  card.querySelector('.card-edit').click(); assert.equal($('task-dialog').open, true); assert.equal(confirmations, 0);
  $('task-dialog').close();
  for (const status of ['doing', 'done', 'todo']) {
    const current = document.querySelector(`[data-task-id="${task.id}"]`);
    current.fire('dragstart', {dataTransfer: {setData() {}}}); $(status).fire('dragover', {dataTransfer: {}}); $(status).fire('drop');
    assert.equal(context.NabnakStore.getState().tasks.find(item => item.id === task.id).status, status);
    assert.equal(document.querySelectorAll('.highlight').length, 0);
  }
});
test('card deletion updates calendar and goal progress and deleting the last card restores form focus', () => {
  const {$, context, document} = boot();
  const goal = context.NabnakStore.addGoal({title: 'Deletion progress', dueDate: '2020-01-01', target: 1});
  const date = context.NabnakData.localDay();
  const task = context.NabnakStore.addTask({title: 'Completed linked task', dueDate: date, goalId: goal.id, status: 'done'});
  $('open-goals').click(); assert.equal($('goals-list').querySelector('progress').value, 100); $('goals-dialog').close();
  document.querySelector(`[data-task-id="${task.id}"]`).querySelector('.card-delete').click();
  $('open-calendar').click(); assert.equal($('calendar-tasks').querySelectorAll('.planner-task').length, 0); $('calendar-dialog').close();
  $('open-goals').click(); assert.equal($('goals-list').querySelector('progress').value, 0);
  assert.ok($('goals-list').querySelector('.goal-overdue')); $('goals-dialog').close();
  for (const remaining of context.NabnakStore.getState().tasks) document.querySelector(`[data-task-id="${remaining.id}"]`).querySelector('.card-delete').click();
  assert.equal(document.activeElement, $('task')); assert.equal(context.NabnakStore.getState().tasks.length, 0);
});
test('both card actions share hover/focus fade, mobile targets and reduced-motion styles', () => {
  const fs = require('node:fs'), path = require('node:path');
  const css = fs.readFileSync(path.join(__dirname, '../css/planner.css'), 'utf8');
  assert.match(css, /\.card-action\s*\{[^}]*opacity: 0; pointer-events: none;/);
  assert.match(css, /transition: opacity 180ms ease/);
  assert.match(css, /\.card:hover \.card-action, \.card:focus-within \.card-action\s*\{\s*opacity: 1; pointer-events: auto;/);
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\), \(max-width: 600px\)\s*\{\s*\.card-action\s*\{ opacity: 1; pointer-events: auto; width: 44px; height: 44px;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.card-action\s*\{ transition: none;/);
  assert.match(css, /\.card-delete\s*\{ color: #ce8a8a;/);
});
for (const language of ['en', 'pt-BR', 'es']) {
  test(`top form and pencil: create, edit, move, reload and delete a dated goal task in ${language}`, () => {
    const app = boot(new Map([['nabnak.language', language]])); const {$, context, document} = app;
    const store = context.NabnakStore;
    const originalIds = Array.from(store.getState().tasks, task => task.id);
    const goal = store.addGoal({title: 'My unchanged goal', description: 'My description', dueDate: '2027-12-31', target: 1});
    $('task').value = 'My new task'; $('new-task-date').value = '2027-01-20'; $('new-task-date').fire('change');
    $('new-task-goal').value = goal.id; $('new-task-goal').fire('change'); $('addTask').fire('submit');
    let task = store.getState().tasks.find(task => task.title === 'My new task');
    const taskId = task.id;
    assert.equal(task.dueDate, '2027-01-20'); assert.equal(task.goalId, goal.id);
    const card = document.querySelector(`[data-task-id="${taskId}"]`);
    const pencil = card.querySelector('.card-edit');
    assert.equal(pencil.textContent, ''); assert.ok(pencil.querySelector('svg'));
    assert.equal(pencil.querySelector('svg').getAttribute('aria-hidden'), 'true');
    assert.equal(pencil.getAttribute('aria-label'), `${context.NabnakI18n.t('editTask')}: ${task.title}`);
    assert.equal(pencil.parentElement, card.querySelector('.card-delete').parentElement);
    assert.equal(card.querySelector('.content').parentElement, card);
    pencil.click();
    assert.equal($('task-dialog').open, true); assert.equal($('edit-task-title').value, task.title);
    assert.equal($('edit-task-date').value, task.dueDate); assert.equal($('edit-task-goal').value, goal.id);
    $('edit-task-title').value = 'My edited task'; $('edit-task-date').value = '2027-01-21'; $('task-editor-form').fire('submit');
    assert.equal($('task-dialog').open, false);
    for (const status of ['doing', 'done']) {
      const current = document.querySelector(`[data-task-id="${taskId}"]`);
      current.fire('dragstart', {dataTransfer: {setData() {}}}); $(status).fire('dragover', {dataTransfer: {}}); $(status).fire('drop');
      task = store.getState().tasks.find(task => task.id === taskId);
      assert.equal(task.status, status); assert.equal(task.title, 'My edited task'); assert.equal(task.dueDate, '2027-01-21'); assert.equal(task.goalId, goal.id);
      assert.ok(document.querySelector(`[data-task-id="${taskId}"]`).querySelector('.status').classList.contains(status));
    }
    assert.equal(boot(app.data).context.NabnakStore.getState().tasks.find(task => task.id === taskId).status, 'done');
    $('open-calendar').click(); $('calendar-month').value = '2027-01'; $('calendar-month').fire('change');
    $('calendar-days').querySelector('[data-date="2027-01-21"]').click();
    assert.equal($('calendar-tasks').querySelectorAll('.planner-task').length, 1);
    assert.ok($('calendar-tasks').querySelector('.completed')); $('calendar-dialog').close();
    $('open-goals').click(); assert.equal($('goals-list').querySelector('progress').value, 100); $('goals-dialog').close();
    let prompts = 0; context.confirm = message => { prompts++; assert.equal(message, context.NabnakI18n.t('deleteTaskConfirm')); return false; };
    document.querySelector(`[data-task-id="${taskId}"]`).querySelector('.card-delete').click(); assert.equal(prompts, 1);
    assert.ok(store.getState().tasks.some(task => task.id === taskId));
    context.confirm = () => true; document.querySelector(`[data-task-id="${taskId}"]`).querySelector('.card-delete').click();
    assert.deepEqual(Array.from(store.getState().tasks, task => task.id), originalIds);
    $('open-calendar').click(); assert.equal($('calendar-tasks').querySelectorAll('.planner-task').length, 0); $('calendar-dialog').close();
    $('open-goals').click(); assert.equal($('goals-list').querySelector('progress').value, 0); $('goals-dialog').close();
    const reloaded = boot(app.data);
    assert.equal(reloaded.document.documentElement.lang, language);
    assert.deepEqual(Array.from(reloaded.context.NabnakStore.getState().tasks, task => task.id), originalIds);
    assert.equal(reloaded.context.NabnakStore.getState().goals[0].title, goal.title);
  });
}
for (const pointerType of ['mouse', 'touch']) {
  test(`pencil pointer guard restores drag after ${pointerType} interaction`, () => {
    const {$, context, document} = boot();
    const task = context.NabnakStore.addTask({title: 'Pencil drag protection'});
    const card = document.querySelector(`[data-task-id="${task.id}"]`), pencil = card.querySelector('.card-edit');
    pencil.fire('pointerdown', {pointerType}); assert.equal(card.draggable, false);
    assert.equal(pencil.fire('dragstart'), false); assert.equal(document.querySelectorAll('.highlight').length, 0);
    document.fire('pointercancel', {pointerType}); assert.equal(card.draggable, true);
    pencil.fire('pointerdown', {pointerType}); document.fire('pointerup', {pointerType}); assert.equal(card.draggable, true);
    pencil.click(); assert.equal($('task-dialog').open, true);
    assert.equal(context.NabnakStore.getState().tasks.find(item => item.id === task.id).status, 'todo');
  });
}
test('top form is unique and precedes the columns; plain cards have no empty action footer', () => {
  const {$, context, document} = boot();
  const section = document.querySelector('.task'), boards = document.querySelector('.boards');
  assert.equal(document.querySelectorAll('#addTask').length, 1);
  assert.ok(document.body.children.indexOf(section) < document.body.children.indexOf(boards));
  assert.equal(section.getAttribute('aria-labelledby'), 'add-task-heading'); assert.ok($('add-task-heading'));
  assert.equal(document.querySelector('.footer'), null); assert.equal($('garbage'), null);
  const task = context.NabnakStore.addTask({title: 'Plain task'});
  const card = document.querySelector(`[data-task-id="${task.id}"]`);
  assert.equal(card.querySelector('.card-details'), null);
  assert.equal(card.querySelectorAll('.card-action').length, 2);
});
test('layout CSS reserves menu clearance, a centered 480px form and responsive balanced columns', () => {
  const fs = require('node:fs'), path = require('node:path');
  const css = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');
  assert.match(css, /body\{[^}]*padding: 68px 30px 30px;/);
  assert.match(css, /\.task\{[^}]*width: 100%;[^}]*max-width: 480px;[^}]*margin: 0 auto 24px;/);
  assert.match(css, /\.boards\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /@media \(max-width: 700px\)\{[^]*padding: 68px 16px 24px;[^]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.doesNotMatch(css, /\.footer\{|\.garbage\{/);
  for (const [status, color] of [['todo', 'red'], ['doing', 'yellow'], ['done', 'green']]) assert.match(css, new RegExp('\\.' + status + '\\{\\s*background-color: ' + color + ';'));
});
