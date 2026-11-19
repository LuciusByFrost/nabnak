const test = require('node:test');
const assert = require('node:assert/strict');
const {boot} = require('./dom-harness.cjs');

test('compact form disclosures open one at a time, focus the input, close on Escape and outside click', () => {
  const {$, document} = boot();
  assert.equal($('task-date-panel').hidden, true);
  assert.equal($('task-goal-panel').hidden, true);
  $('task-date-toggle').click();
  assert.equal($('task-date-panel').hidden, false);
  assert.equal($('task-date-toggle').getAttribute('aria-expanded'), 'true');
  assert.equal(document.activeElement, $('new-task-date'));
  $('task-goal-toggle').click();
  assert.equal($('task-date-panel').hidden, true);
  assert.equal($('task-goal-panel').hidden, false);
  assert.equal(document.activeElement, $('new-task-goal'));
  $('new-task-goal').fire('keydown', {key: 'Escape'});
  assert.equal($('task-goal-panel').hidden, true);
  assert.equal(document.activeElement, $('task-goal-toggle'));
  $('task-date-toggle').click(); $('task-date-toggle').click();
  assert.equal($('task-date-panel').hidden, true);
  $('task-date-toggle').click(); document.body.click();
  assert.equal($('task-date-panel').hidden, true);
  $('task-goal-toggle').click(); document.fire('focusin', {target: document.body});
  assert.equal($('task-goal-panel').hidden, true);
  assert.equal($('task-add-button').getAttribute('type'), 'submit');
});

test('form creates and persists tasks with no metadata, date only, goal only and both', () => {
  const app = boot(); const {$, context} = app;
  const goal = context.NabnakStore.addGoal({title: 'User goal title', dueDate: '2027-02-01', target: 2});
  for (const [title, date, goalId] of [['Plain', '', ''], ['Dated', '2027-01-12', ''], ['Linked', '', goal.id], ['Both', '2027-01-31', goal.id]]) {
    $('task').value = title;
    $('task-date-toggle').click(); $('new-task-date').value = date; $('new-task-date').fire('change');
    $('task-goal-toggle').click(); $('new-task-goal').value = goalId; $('new-task-goal').fire('change');
    assert.equal($('task-date-panel').hidden, true); assert.equal($('task-goal-panel').hidden, true);
    assert.equal($('task-date-toggle').classList.contains('is-selected'), Boolean(date));
    assert.equal($('task-goal-toggle').classList.contains('is-selected'), Boolean(goalId));
    if (goalId) assert.equal($('task-goal-summary').textContent, goal.title);
    $('addTask').fire('submit');
    const task = context.NabnakStore.getState().tasks.find(task => task.title === title);
    assert.equal(task.dueDate, date || null); assert.equal(task.goalId, goalId || null);
    assert.equal($('task').value, ''); assert.equal($('new-task-date').value, '');
    assert.equal($('task-date-toggle').classList.contains('is-selected'), false);
    const loaded = boot(app.data).context.NabnakStore.getState().tasks;
    assert.equal(loaded.filter(item => item.id === task.id).length, 1);
    assert.equal(loaded.find(item => item.id === task.id).goalId, goalId || null);
    assert.equal(loaded.find(item => item.id === task.id).dueDate, date || null);
  }
});

test('summaries follow language and goal edits without translating user text or clearing selections', () => {
  const {$, context, document} = boot();
  const goal = context.NabnakStore.addGoal({title: 'Keep my exact goal', dueDate: '2027-01-31', target: 1});
  $('task').value = 'Keep my draft';
  $('new-task-date').value = '2027-01-20'; $('new-task-date').fire('change');
  $('new-task-goal').value = goal.id; $('new-task-goal').fire('change');
  for (const lang of ['pt-BR', 'es', 'en']) {
    document.querySelector(`input[value="${lang}"]`).click();
    assert.equal($('task').getAttribute('placeholder'), context.NabnakI18n.t('taskPrompt'));
    assert.equal($('task-add-button').textContent, context.NabnakI18n.t('addShort'));
    assert.equal($('task-goal-summary').textContent, goal.title);
    assert.ok($('task-date-toggle').getAttribute('aria-label').startsWith(context.NabnakI18n.t('dueButton')));
    assert.equal($('new-task-date').value, '2027-01-20'); assert.equal($('new-task-goal').value, goal.id);
    assert.equal($('task').value, 'Keep my draft');
  }
  context.NabnakStore.updateGoal(goal.id, {title: 'Renamed goal'});
  assert.equal($('task-goal-summary').textContent, 'Renamed goal');
  context.NabnakStore.deleteGoal(goal.id);
  assert.equal($('new-task-goal').value, ''); assert.equal($('task-goal-summary').textContent, context.NabnakI18n.t('goalButton'));
});

test('clearing optional fields resets summaries and invalid date remains reachable', () => {
  const {$, context, document} = boot();
  const goal = context.NabnakStore.addGoal({title: 'Goal', dueDate: '2027-01-31', target: 1});
  $('new-task-date').value = '2027-01-15'; $('new-task-date').fire('change');
  $('new-task-date').value = ''; $('new-task-date').fire('change');
  assert.equal($('task-date-summary').textContent, context.NabnakI18n.t('dueButton'));
  $('new-task-goal').value = goal.id; $('new-task-goal').fire('change');
  $('new-task-goal').value = ''; $('new-task-goal').fire('change');
  assert.equal($('task-goal-toggle').classList.contains('is-selected'), false);
  $('new-task-date').fire('invalid');
  assert.equal($('task-date-panel').hidden, false); assert.equal(document.activeElement, $('new-task-date'));
});
