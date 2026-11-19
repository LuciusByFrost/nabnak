const test = require('node:test');
const assert = require('node:assert/strict');
const {createStore, STORAGE_KEY, localDay, validDate, dateObject, monthDays, shiftMonth, taskState, goalProgress} = require('../js/store.js');
function memory(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)};
}
test('create, edit, reschedule, clear date and delete a task', () => {
  const store = createStore(memory());
  const task = store.addTask({title: '  User text <b>unchanged</b>  ', dueDate: '2026-11-18'});
  assert.equal(task.title, 'User text <b>unchanged</b>');
  assert.equal(store.tasksOn('2026-11-18').length, 1);
  store.updateTask(task.id, {title: 'Edited', dueDate: '2026-12-01'});
  assert.equal(store.tasksOn('2026-11-18').length, 0);
  assert.equal(store.tasksOn('2026-12-01')[0].title, 'Edited');
  store.updateTask(task.id, {dueDate: ''});
  assert.equal(store.getState().tasks[0].dueDate, null);
  store.deleteTask(task.id); assert.equal(store.getState().tasks.length, 0);
});
test('reload preserves tasks, dates, columns, extra data and language without duplicating seeds', () => {
  const storage = memory({'nabnak.language': 'pt-BR'});
  let store = createStore(storage, [{title: 'Sample', status: 'todo', exampleKey: 'exampleTodo'}]);
  const task = store.addTask({title: 'Calendar task', dueDate: '2026-12-31'});
  store.updateTask(task.id, {status: 'done'});
  const before = store.getState();
  for (let i = 0; i < 5; i++) {
    store = createStore(storage, [{title: 'Do not duplicate', status: 'todo'}]);
    assert.deepEqual(store.getState(), before);
  }
  assert.equal(storage.getItem('nabnak.language'), 'pt-BR');
  store.getState().tasks.push({title: 'Must not leak'});
  assert.equal(store.getState().tasks.length, 2);
});
test('an empty saved board remains empty after reload', () => {
  const storage = memory(); const store = createStore(storage, [{title: 'Sample'}]);
  store.deleteTask(store.getState().tasks[0].id);
  assert.equal(createStore(storage, [{title: 'Sample'}]).getState().tasks.length, 0);
});
test('month grids cover leap years, weekdays, 6-row months and year navigation', () => {
  const feb = monthDays('2024-02');
  assert.equal(feb.filter(Boolean).length, 29); assert.equal(feb.indexOf('2024-02-01'), 4);
  assert.equal(monthDays('2026-02').filter(Boolean).length, 28);
  assert.equal(monthDays('2026-08').length, 42);
  assert.equal(shiftMonth('2026-12', 1), '2027-01'); assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2024-02', 12), '2025-02');
  assert.equal(shiftMonth('0001-01', -1), '0001-01'); assert.equal(shiftMonth('9999-12', 1), '9999-12');
});
test('invalid dates and blank titles are rejected without partial mutation', () => {
  const store = createStore(memory());
  for (const date of ['2026-02-29', '2026-04-31', '0000-01-01', '2026-13-01', '2026-1-1', '2026-11-18T00:00:00Z']) {
    assert.equal(validDate(date), false); assert.throws(() => store.addTask({title: 'Task', dueDate: date}), /invalidDate/);
  }
  assert.throws(() => store.addTask({title: '   '}), /requiredTitle/);
  assert.equal(store.getState().tasks.length, 0); assert.ok(validDate('2000-02-29')); assert.ok(!validDate('1900-02-29'));
});
test('overdue, today, upcoming and completed use local calendar dates', () => {
  const today = '2026-11-18';
  assert.equal(taskState({dueDate: '2026-11-17', status: 'todo'}, today), 'overdue');
  assert.equal(taskState({dueDate: today, status: 'doing'}, today), 'dueToday');
  assert.equal(taskState({dueDate: '2026-11-19', status: 'todo'}, today), 'upcoming');
  assert.equal(taskState({dueDate: '2026-11-01', status: 'done'}, today), 'completed');
  assert.equal(taskState({status: 'todo'}, today), 'noDate');
});
test('date round trips in Brazil, UTC and opposite time zones, including DST dates', () => {
  const original = process.env.TZ;
  try {
    for (const zone of ['America/Sao_Paulo', 'America/Los_Angeles', 'Pacific/Kiritimati', 'UTC']) {
      process.env.TZ = zone;
      for (const day of ['2026-01-01', '2026-03-08', '2026-11-01', '2024-02-29', '0099-12-31']) assert.equal(localDay(dateObject(day)), day, `${zone}: ${day}`);
      const nearMidnight = new Date(2026, 10, 18, 0, 1); assert.equal(localDay(nearMidnight), '2026-11-18');
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
test('moving through columns and removal preserves task identity and due date', () => {
  const store = createStore(memory()); const task = store.addTask({title: 'Drag me', dueDate: '2026-11-18'});
  for (const status of ['doing', 'done', 'todo']) {
    store.updateTask(task.id, {status}); const saved = store.getState().tasks[0];
    assert.equal(saved.id, task.id); assert.equal(saved.status, status); assert.equal(saved.dueDate, task.dueDate);
  }
  store.deleteTask(task.id); assert.equal(store.tasksOn(task.dueDate).length, 0);
});
test('unreadable or newer saved data is never overwritten', () => {
  for (const raw of ['{broken', JSON.stringify({version: 999, tasks: []})]) {
    const storage = memory({[STORAGE_KEY]: raw}); const store = createStore(storage);
    store.addTask({title: 'Memory only'}); assert.equal(storage.getItem(STORAGE_KEY), raw);
    assert.equal(store.getError(), 'storageReadError');
  }
});
test('quota failure keeps edits in memory and reports persistence failure', () => {
  const storage = memory(); storage.setItem = () => { throw new Error('QuotaExceededError'); };
  const store = createStore(storage); store.addTask({title: 'Keep me'});
  assert.equal(store.getState().tasks.length, 1); assert.equal(store.getError(), 'storageWriteError');
});
test('legacy task fields and unknown properties are preserved; duplicate IDs become unique', () => {
  const storage = memory({[STORAGE_KEY]: JSON.stringify({version: 1, extra: {keep: true}, tasks: [{id: 'same', text: 'Older text', custom: 42}, {id: 'same', title: 'Second'}]})});
  const store = createStore(storage); const state = store.getState();
  assert.equal(state.extra.keep, true); assert.equal(state.tasks[0].title, 'Older text'); assert.equal(state.tasks[0].custom, 42);
  assert.equal(new Set(state.tasks.map(task => task.id)).size, 2);
});
test('goal CRUD, validation, description, deadline and target updates', () => {
  const store = createStore(memory());
  const goal = store.addGoal({title: 'Study', description: 'User description', dueDate: '2026-12-01', target: 3});
  store.updateGoal(goal.id, {title: 'Edited', description: '', target: 2, dueDate: '2027-01-01'});
  assert.equal(store.getState().goals[0].title, 'Edited'); assert.equal(store.getState().goals[0].description, '');
  assert.equal(store.getState().goals[0].target, 2); assert.equal(store.getState().goals[0].dueDate, '2027-01-01');
  for (const target of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => store.updateGoal(goal.id, {target}), /invalidTarget/);
  assert.throws(() => store.addGoal({title: 'No deadline', target: 1}), /requiredDeadline/);
  assert.throws(() => store.updateGoal(goal.id, {title: ' '}), /requiredTitle/);
  assert.equal(store.getState().goals.length, 1);
  store.deleteGoal(goal.id); assert.equal(store.getState().goals.length, 0);
});
test('goal progress follows done tasks, reopens after moving back, and never exceeds 100%', () => {
  const store = createStore(memory());
  const goal = store.addGoal({title: 'Target', dueDate: '2026-11-17', target: 2});
  const a = store.addTask({title: 'A', goalId: goal.id});
  const b = store.addTask({title: 'B', goalId: goal.id});
  store.addTask({title: 'Unrelated', status: 'done'});
  const progress = () => goalProgress(goal, store.getState().tasks, '2026-11-18');
  assert.deepEqual(progress(), {completed: 0, total: 2, percent: 0, state: 'overdue'});
  store.updateTask(a.id, {status: 'done'}); assert.equal(progress().percent, 50);
  store.updateTask(b.id, {status: 'done'}); assert.equal(progress().percent, 100); assert.equal(progress().state, 'completed');
  store.addTask({title: 'Extra', goalId: goal.id, status: 'done'}); assert.equal(progress().percent, 100); assert.equal(progress().completed, 3);
  store.updateTask(a.id, {status: 'doing'}); store.updateTask(b.id, {status: 'todo'});
  assert.equal(progress().percent, 50); assert.equal(progress().state, 'overdue');
  store.updateTask(b.id, {goalId: null}); assert.equal(progress().total, 2);
  assert.throws(() => store.updateTask(a.id, {goalId: 'missing'}), /missingGoal/);
});
test('deleting a goal only unlinks tasks; reload preserves every task, date and status', () => {
  const storage = memory(); const store = createStore(storage);
  const goal = store.addGoal({title: 'Remove me', dueDate: '2026-12-01', target: 1});
  const task = store.addTask({title: 'Keep me', dueDate: '2026-11-30', status: 'done', goalId: goal.id});
  store.deleteGoal(goal.id);
  const saved = createStore(storage).getState();
  assert.equal(saved.goals.length, 0); assert.equal(saved.tasks.length, 1);
  assert.deepEqual(saved.tasks[0], {...task, goalId: null});
});
test('v1 migration keeps task IDs, dates, unknown fields and language', () => {
  const original = {version: 1, note: 'Keep this', tasks: [{id: 'old', title: 'Original', status: 'doing', dueDate: '2026-12-31', custom: {value: 5}}]};
  const storage = memory({[STORAGE_KEY]: JSON.stringify(original), 'nabnak.language': 'es'});
  const store = createStore(storage); const state = store.getState();
  assert.equal(state.version, 2); assert.deepEqual(state.goals, []);
  assert.deepEqual(state.tasks[0], {...original.tasks[0], goalId: null});
  assert.equal(state.note, original.note); assert.equal(storage.getItem('nabnak.language'), 'es');
  const goal = store.addGoal({title: 'New', dueDate: '2027-01-01', target: 1}); store.updateTask('old', {goalId: goal.id});
  assert.deepEqual(createStore(storage).getState(), store.getState());
});
test('completion is not rounded up before reaching a large target', () => {
  const goal = {id: 'g', target: 200, dueDate: '2026-12-31'};
  const tasks = Array.from({length: 199}, () => ({goalId: 'g', status: 'done'}));
  assert.equal(goalProgress(goal, tasks).percent, 99); assert.notEqual(goalProgress(goal, tasks).state, 'completed');
});
test('malformed saved goals and tasks are preserved rather than overwritten', () => {
  for (const saved of [{version: 2, tasks: [], goals: [{title: 'Bad', dueDate: 'not-a-date', target: 1}]}, {version: 1, tasks: [null]}]) {
    const raw = JSON.stringify(saved), storage = memory({[STORAGE_KEY]: raw});
    const store = createStore(storage); assert.equal(store.getError(), 'storageReadError');
    store.addTask({title: 'Memory only'}); assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});
