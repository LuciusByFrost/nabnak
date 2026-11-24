(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NabnakFilters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  function matches(task, filters, title, today, nextWeek) {
    if (filters.query && !normalize(title).includes(normalize(filters.query.trim()))) return false;
    if (filters.status && task.status !== filters.status) return false;
    if (filters.goal === '__none' ? Boolean(task.goalId) : filters.goal && task.goalId !== filters.goal) return false;
    if (filters.deadline === 'noDate') return !task.dueDate;
    if (filters.deadline === 'overdue') return task.status !== 'done' && Boolean(task.dueDate && task.dueDate < today);
    if (filters.deadline === 'dueToday') return task.dueDate === today;
    if (filters.deadline === 'upcoming') return Boolean(task.dueDate && task.dueDate > today);
    if (filters.deadline === 'nextWeek') return Boolean(task.dueDate && task.dueDate > today && task.dueDate <= nextWeek);
    return true;
  }
  return {matches};
});
