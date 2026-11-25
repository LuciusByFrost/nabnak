(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NabnakData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const S = typeof module === 'object' && module.exports ? require('./security.js') : NabnakSecurity;
  const STORAGE_KEY = 'nabnak.data';
  const STATUSES = ['todo', 'doing', 'done'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const pad = value => String(value).padStart(2, '0');
  const localDay = (date = new Date()) => `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  function daysInMonth(year, month) {
    return [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    return year >= 1 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
  }
  function dateObject(value) {
    if (!validDate(value)) throw new Error('invalidDate');
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(0);
    date.setHours(12, 0, 0, 0);
    date.setFullYear(year, month - 1, day);
    return date;
  }
  function shiftMonth(month, offset) {
    const [year, number] = month.split('-').map(Number);
    const index = (year - 1) * 12 + number - 1 + offset;
    const bounded = Math.max(0, Math.min(9999 * 12 - 1, index));
    return `${String(Math.floor(bounded / 12) + 1).padStart(4, '0')}-${pad(bounded % 12 + 1)}`;
  }
  function taskState(task, today = localDay()) {
    if (task.status === 'done') return 'completed';
    if (!task.dueDate) return 'noDate';
    return task.dueDate < today ? 'overdue' : task.dueDate === today ? 'dueToday' : 'upcoming';
  }
  function monthDays(month) {
    const first = `${month}-01`;
    if (!validDate(first)) throw new Error('invalidDate');
    const [year, number] = month.split('-').map(Number);
    const dates = Array(dateObject(first).getDay()).fill(null);
    for (let day = 1; day <= daysInMonth(year, number); day++) dates.push(`${month}-${pad(day)}`);
    while (dates.length % 7) dates.push(null);
    return dates;
  }
  function goalProgress(goal, tasks, today = localDay()) {
    const associated = tasks.filter(task => task.goalId === goal.id);
    const completed = associated.filter(task => task.status === 'done').length;
    const complete = completed >= goal.target;
    return {completed, total: associated.length, percent: Math.min(100, Math.floor(completed / goal.target * 100)),
      state: complete ? 'completed' : goal.dueDate < today ? 'overdue' : goal.dueDate === today ? 'dueToday' : 'upcoming'};
  }
  function createStore(storage, seedTasks = []) {
    let counter = 0;
    const id = () => globalThis.crypto?.randomUUID?.() || `n-${Date.now()}-${++counter}-${Math.random().toString(36).slice(2)}`;
    let error = null;
    let writable = true, expected = null, original = null;
    let state = {version: 2, tasks: copy(seedTasks), goals: []};
    try {
      const raw = storage.getItem(STORAGE_KEY); expected = raw; original = raw;
      if (raw !== null) {
        const saved = S.object(S.parse(raw)); S.version(saved.version);
        S.count(saved?.tasks, S.limits.tasks); S.count(saved.goals ?? [], S.limits.goals);
        for (const task of saved.tasks) {
          if (!task || typeof task !== 'object' || Array.isArray(task)) throw new Error('invalidTasks');
          S.text(task.title ?? task.text ?? task.content ?? '', S.limits.title, true);
          if (task.id !== undefined) S.identifier(task.id);
          if (task.goalId !== undefined && task.goalId !== null) S.identifier(task.goalId);
          if (task.status !== undefined && !STATUSES.includes(task.status)) throw new Error('invalidStatus');
          if (task.dueDate !== undefined && task.dueDate !== null && task.dueDate !== '' && !validDate(task.dueDate)) throw new Error('invalidDate');
          if (task.exampleKey !== undefined && !['exampleTodo', 'exampleDoing', 'exampleDone'].includes(task.exampleKey)) throw new Error('invalidInput');
        }
        for (const goal of saved.goals ?? []) {
          if (!goal || typeof goal !== 'object' || Array.isArray(goal)) throw new Error('invalidGoals');
          S.text(goal.title, S.limits.title, true); S.text(goal.description ?? '', S.limits.description);
          if (goal.id !== undefined) S.identifier(goal.id);
        }
        if (!saved || !Array.isArray(saved.tasks) || (saved.version && saved.version > 2)) throw new Error('unsupported');
        if (saved.tasks.some(task => !task || typeof task !== 'object')) throw new Error('invalidTasks');
        if (saved.goals !== undefined && (!Array.isArray(saved.goals) || saved.goals.some(goal => !goal || typeof goal.title !== 'string' || !goal.title.trim() || !validDate(goal.dueDate) || !Number.isSafeInteger(goal.target) || goal.target < 1))) throw new Error('invalidGoals');
        const goalIds = new Set((saved.goals ?? []).map(goal => goal.id).filter(Boolean));
        if (saved.tasks.some(task => task.goalId != null && !goalIds.has(task.goalId))) throw new Error('missingGoal');
        // v1 calendars gain an empty goals collection without changing their tasks.
        state = {...saved, version: 2, goals: saved.goals || []};
      }
    } catch {
      // Do not overwrite unreadable or newer data. The board still works in memory.
      error = 'storageReadError'; writable = false;
    }
    const seenGoals = new Set();
    state.goals = state.goals.map(goal => {
      let goalId = typeof goal.id === 'string' && goal.id ? goal.id : id();
      if (seenGoals.has(goalId)) goalId = id();
      seenGoals.add(goalId);
      return {...goal, id: goalId, description: String(goal.description || '')};
    });
    const seen = new Set();
    state.tasks = state.tasks.map(task => {
      if (!task || typeof task !== 'object') return null;
      const title = String(task.title ?? task.text ?? task.content ?? '');
      let taskId = typeof task.id === 'string' && task.id ? task.id : id();
      if (seen.has(taskId)) taskId = id();
      seen.add(taskId);
      return {...task, id: taskId, title, status: STATUSES.includes(task.status) ? task.status : 'todo', dueDate: validDate(task.dueDate) ? task.dueDate : null, goalId: seenGoals.has(task.goalId) ? task.goalId : null};
    }).filter(Boolean);
    const listeners = new Set();
    function persist() {
      if (!writable) return;
      try {
        if (storage.getItem(STORAGE_KEY) !== expected) { error = 'storageConflict'; return; }
        const serialized = JSON.stringify(state); S.parse(serialized);
        if (original !== null && storage.getItem(STORAGE_KEY + '.backup') === null) storage.setItem(STORAGE_KEY + '.backup', original);
        storage.setItem(STORAGE_KEY, serialized); expected = serialized; error = null;
      } catch { error = 'storageWriteError'; }
    }
    function changed() { persist(); listeners.forEach(listener => listener()); }
    function commit(candidate) {
      // Reject unsupported sizes before publishing changes; quota errors can still retain valid work in memory.
      S.parse(JSON.stringify(candidate)); state = candidate; changed();
    }
    function fields(input, current = {}) {
      S.object(input); S.inspect(input);
      const title = S.text(input.title ?? current.title ?? '', S.limits.title).trim();
      if (!title) throw new Error('requiredTitle');
      const dueInput = input.dueDate === undefined ? current.dueDate : input.dueDate;
      const dueDate = dueInput === undefined || dueInput === null || dueInput === '' ? null : dueInput;
      if (dueDate !== null && !validDate(dueDate)) throw new Error('invalidDate');
      const status = input.status ?? current.status ?? 'todo';
      if (!STATUSES.includes(status)) throw new Error('invalidStatus');
      const goalInput = input.goalId === undefined ? current.goalId ?? null : input.goalId;
      const goalId = goalInput === '' ? null : goalInput;
      if (goalId !== null) { S.identifier(goalId); if (!state.goals.some(goal => goal.id === goalId)) throw new Error('missingGoal'); }
      const result = {...current, title, dueDate, status, goalId};
      if (current.title !== title) delete result.exampleKey;
      return result;
    }
    function goalFields(input, current = {}) {
      S.object(input); S.inspect(input);
      const title = S.text(input.title ?? current.title ?? '', S.limits.title).trim();
      if (!title) throw new Error('requiredTitle');
      const dueDate = input.dueDate ?? current.dueDate;
      if (!validDate(dueDate)) throw new Error('requiredDeadline');
      const target = Number(input.target ?? current.target);
      if (!Number.isSafeInteger(target) || target < 1) throw new Error('invalidTarget');
      return {...current, title, description: S.text(input.description ?? current.description ?? '', S.limits.description), dueDate, target};
    }
    if (typeof window === 'object') window.addEventListener?.('storage', event => {
      if ((event.key === STORAGE_KEY || event.key === null) && event.storageArea === storage) { writable = false; error = 'storageConflict'; listeners.forEach(listener => listener()); }
    });
    persist();
    return {
      getState: () => copy(state), getError: () => error,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      addTask(input) { if (state.tasks.length >= S.limits.tasks) throw new Error('resourceLimit'); const task = {...fields(input), id: id()}; commit({...state, tasks: [...state.tasks, task]}); return copy(task); },
      updateTask(taskId, input) {
        const index = state.tasks.findIndex(task => task.id === taskId);
        if (index < 0) throw new Error('missingTask');
        const tasks = state.tasks.slice(); tasks[index] = fields(input, tasks[index]); commit({...state, tasks});
      },
      deleteTask(taskId) { commit({...state, tasks: state.tasks.filter(task => task.id !== taskId)}); },
      tasksOn(date) { return copy(state.tasks.filter(task => task.dueDate === date)); },
      addGoal(input) { if (state.goals.length >= S.limits.goals) throw new Error('resourceLimit'); const goal = {...goalFields(input), id: id()}; commit({...state, goals: [...state.goals, goal]}); return copy(goal); },
      updateGoal(goalId, input) {
        const index = state.goals.findIndex(goal => goal.id === goalId);
        if (index < 0) throw new Error('missingGoal');
        const goals = state.goals.slice(); goals[index] = goalFields(input, goals[index]); commit({...state, goals});
      },
      deleteGoal(goalId) {
        commit({...state, goals: state.goals.filter(goal => goal.id !== goalId),
          tasks: state.tasks.map(task => task.goalId === goalId ? {...task, goalId: null} : task)});
      }
    };
  }
  return {STORAGE_KEY, STATUSES, localDay, validDate, dateObject, shiftMonth, taskState, monthDays, goalProgress, createStore};
});
