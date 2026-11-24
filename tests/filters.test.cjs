const test = require('node:test');
const assert = require('node:assert/strict');
const {matches} = require('../js/task-filters.js');
const {boot} = require('./dom-harness.cjs');
const today = '2026-12-29', next = '2027-01-05';
const task = {title: 'Revisão técnica', status: 'todo', dueDate: '2027-01-05', goalId: 'goal'};
const accepts = (patch, candidate = task) => matches(candidate, {query: '', deadline: '', goal: '', status: '', ...patch}, candidate.title, today, next);

test('filters combine title, goal, deadline and status without mutating tasks', () => {
  const original = JSON.stringify(task);
  assert.equal(accepts({query: 'REVISAO', deadline: 'nextWeek', goal: 'goal', status: 'todo'}), true);
  for (const patch of [{query: 'missing'}, {goal: 'other'}, {goal: '__none'}, {status: 'done'}, {deadline: 'overdue'}, {deadline: 'noDate'}]) assert.equal(accepts(patch), false);
  assert.equal(JSON.stringify(task), original);
});
test('date boundaries cross years, exclude finished overdue tasks and handle no metadata', () => {
  assert.equal(accepts({deadline: 'nextWeek'}, {...task, dueDate: '2027-01-06'}), false);
  assert.equal(accepts({deadline: 'dueToday'}, {...task, dueDate: today}), true);
  assert.equal(accepts({deadline: 'overdue'}, {...task, dueDate: '2026-12-28'}), true);
  assert.equal(accepts({deadline: 'overdue'}, {...task, status: 'done', dueDate: '2026-12-28'}), false);
  assert.equal(accepts({deadline: 'noDate', goal: '__none'}, {...task, dueDate: null, goalId: null}), true);
});
for (const language of ['en', 'pt-BR', 'es']) {
  test(`quick create, search, combine filters, move and reload in ${language}`, () => {
    const app = boot(new Map([['nabnak.language', language]]));
    const {$, context, document} = app;
    for (const status of ['todo', 'doing', 'done']) {
      $(`quick-${status}`).value = `Revisão ${status}`;
      document.querySelector(`[data-quick-column="${status}"]`).fire('submit');
      assert.equal(context.NabnakStore.getState().tasks.find(task => task.title === `Revisão ${status}`).status, status);
      assert.equal($(`quick-${status}`).value, '');
    }
    const before = app.data.get('nabnak.data');
    $('task-search').value = 'revisao'; $('task-search').fire('input');
    assert.equal(document.querySelectorAll('.card').length, 3);
    $('filter-status').value = 'doing'; $('filter-status').fire('change');
    assert.equal(document.querySelectorAll('.card').length, 1);
    $('filter-deadline').value = 'noDate'; $('filter-deadline').fire('change');
    $('filter-goal').value = '__none'; $('filter-goal').fire('change');
    assert.equal(document.querySelectorAll('.card').length, 1);
    assert.equal(app.data.get('nabnak.data'), before);
    const card = document.querySelector('.card'), id = card.dataset.taskId;
    card.querySelector('select').value = 'done'; card.querySelector('select').fire('change');
    assert.equal(document.querySelectorAll('.card').length, 0);
    assert.equal(document.activeElement, $('task-search'));
    $('clear-filters').click();
    assert.equal(document.querySelectorAll('.card').length, 6);
    assert.equal(boot(app.data).context.NabnakStore.getState().tasks.find(task => task.id === id).status, 'done');
  });
}
test('goal filters follow renamed/deleted goals without altering user titles', () => {
  const app = boot(); const {$, context, document} = app;
  const goal = context.NabnakStore.addGoal({title: 'Original', dueDate: today, target: 1});
  context.NabnakStore.addTask({title: 'Linked', goalId: goal.id});
  $('filter-goal').value = goal.id; $('filter-goal').fire('change');
  assert.equal(document.querySelectorAll('.card').length, 1);
  context.NabnakStore.updateGoal(goal.id, {title: 'Renamed'});
  assert.equal($('filter-goal').value, goal.id);
  assert.equal($('filter-goal').querySelectorAll('option')[2].textContent, 'Renamed');
  context.NabnakStore.deleteGoal(goal.id);
  assert.equal($('filter-goal').value, '');
  assert.equal(document.querySelectorAll('.card').length, 4);
});
