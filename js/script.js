(() => {
  'use strict';
  const {createStore, taskState, dateObject, localDay} = NabnakData;
  const {t} = NabnakI18n;
  const seeds = Array.from(document.querySelectorAll('.card'), card => ({
    title: card.querySelector('.content').textContent,
    exampleKey: card.querySelector('.content').getAttribute('data-i18n'), status: card.parentElement.id
  }));
  let storage;
  try { storage = window.localStorage; } catch { storage = {getItem() { throw new Error('unavailable'); }}; }
  const store = createStore(storage, seeds);
  window.NabnakStore = store;
  const zones = Array.from(document.querySelectorAll('.dropZone'));
  const filters = {query: '', deadline: '', goal: '', status: ''};
  function announce(key) { document.getElementById('task-announcement').textContent = t(key); }
  const fields = {query: 'task-search', deadline: 'filter-deadline', goal: 'filter-goal', status: 'filter-status'};
  for (const [key, id] of Object.entries(fields)) {
    document.getElementById(id).addEventListener(key === 'query' ? 'input' : 'change', event => { filters[key] = event.target.value; render(); });
  }
  document.getElementById('clear-filters').addEventListener('click', () => {
    for (const [key, id] of Object.entries(fields)) { filters[key] = ''; document.getElementById(id).value = ''; }
    render(); document.getElementById('task-search').focus();
  });
  document.querySelectorAll('[data-quick-column]').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault(); const input = form.querySelector('input');
      if (!input.value.trim()) return;
      store.addTask({title: input.value, status: form.dataset.quickColumn});
      input.value = ''; input.focus(); announce('taskCreated');
    });
  });
  let draggedId = null;
  let draggedCard = null;
  let buttonPointerCard = null;
  function restoreCardDrag() {
    if (buttonPointerCard) buttonPointerCard.draggable = true;
    buttonPointerCard = null;
  }
  document.addEventListener('pointerup', restoreCardDrag);
  document.addEventListener('pointercancel', restoreCardDrag);
  function guardCardAction(button, card) {
    button.draggable = false;
    button.addEventListener('pointerdown', event => {
      event.stopPropagation(); restoreCardDrag();
      buttonPointerCard = card; card.draggable = false;
    });
    button.addEventListener('dragstart', event => { event.preventDefault(); event.stopPropagation(); });
  }
  const titleFor = task => task.exampleKey ? t(task.exampleKey) : task.title;
  window.NabnakTaskTitle = titleFor;
  const displayDate = value => new Intl.DateTimeFormat(NabnakI18n.locale, {dateStyle: 'medium'}).format(dateObject(value));
  window.NabnakDisplayDate = displayDate;
  // Board badges only format existing metadata; the stored task is unchanged.
  function metadataBadge(className, text, kind) {
    const badge = document.createElement('span'); badge.className = className;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    const shapes = kind === 'goal'
      ? [['circle', {cx: 12, cy: 12, r: 9}], ['circle', {cx: 12, cy: 12, r: 5}], ['circle', {cx: 12, cy: 12, r: 1}]]
      : kind === 'completed'
        ? [['circle', {cx: 12, cy: 12, r: 9}], ['path', {d: 'm7 12 3 3 7-7'}]]
        : [['rect', {x: 3, y: 5, width: 18, height: 16, rx: 2}], ['path', {d: 'M7 3v4M17 3v4M3 11h18'}]];
    for (const [tag, attributes] of shapes) {
      const shape = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [name, value] of Object.entries(attributes)) shape.setAttribute(name, String(value));
      svg.append(shape);
    }
    const label = document.createElement('span'); label.textContent = text;
    badge.append(svg, label); return badge;
  }
  function endDrag() {
    zones.forEach(zone => zone.classList.remove('highlight', 'over'));
    draggedCard?.classList.remove('dragging'); draggedId = null; draggedCard = null;
  }
  function render() {
    const snapshot = store.getState();
    if (filters.goal && filters.goal !== '__none' && !snapshot.goals.some(goal => goal.id === filters.goal)) filters.goal = '';
    const filterGoal = document.getElementById('filter-goal'); filterGoal.replaceChildren();
    for (const [value, label] of [['', t('allGoals')], ['__none', t('noGoalFilter')], ...snapshot.goals.map(goal => [goal.id, goal.title])]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; filterGoal.append(option);
    }
    filterGoal.value = filters.goal;
    const today = localDay(), next = dateObject(today); next.setDate(next.getDate() + 7);
    const visible = snapshot.tasks.filter(task => NabnakFilters.matches(task, filters, titleFor(task), today, localDay(next)));
    const filtered = Object.values(filters).some(Boolean);
    document.getElementById('filter-results').textContent = `${t('results')}: ${visible.length} / ${snapshot.tasks.length}`;
    document.getElementById('clear-filters').disabled = !filtered;
    const goalSelect = document.getElementById('new-task-goal');
    const selectedGoal = goalSelect.value;
    goalSelect.replaceChildren();
    const emptyGoal = document.createElement('option'); emptyGoal.value = ''; emptyGoal.textContent = t('noGoal'); goalSelect.append(emptyGoal);
    snapshot.goals.forEach(goal => { const option = document.createElement('option'); option.value = goal.id; option.textContent = goal.title; goalSelect.append(option); });
    goalSelect.value = snapshot.goals.some(goal => goal.id === selectedGoal) ? selectedGoal : '';
    for (const zone of zones) {
      zone.replaceChildren();
      const count = snapshot.tasks.filter(task => task.status === zone.id).length;
      const shown = visible.filter(task => task.status === zone.id).length;
      const counter = zone.parentElement.querySelector('.board-count');
      counter.textContent = filtered ? `${shown}/${count}` : String(count);
      counter.setAttribute('aria-label', filtered ? `${t('results')}: ${shown}. ${t('tasksCount')}: ${count}` : `${t('tasksCount')}: ${count}`);
    }
    for (const task of visible) {
      const card = document.createElement('div');
      card.className = 'card'; card.draggable = true; card.dataset.taskId = task.id;
      const status = document.createElement('div'); status.className = `status ${task.status}`;
      const content = document.createElement('div'); content.className = 'content'; content.textContent = titleFor(task);
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'card-action card-delete';
      remove.setAttribute('aria-label', `${t('delete')}: ${titleFor(task)}`);
      remove.setAttribute('title', t('delete'));
      const icon = document.createElement('span'); icon.setAttribute('aria-hidden', 'true'); icon.textContent = '\u00d7'; remove.append(icon);
      guardCardAction(remove, card);
      remove.addEventListener('click', event => {
        event.stopPropagation(); restoreCardDrag();
        if (!window.confirm(t('deleteTaskConfirm'))) return;
        const columnTasks = store.getState().tasks.filter(item => item.status === task.status);
        const index = columnTasks.findIndex(item => item.id === task.id);
        const neighbor = columnTasks[index + 1] || columnTasks[index - 1];
        store.deleteTask(task.id);
        announce('taskRemoved');
        const nextCard = Array.from(document.querySelectorAll('.card')).find(item => item.dataset.taskId === neighbor?.id);
        (nextCard?.querySelector('.card-delete') || document.getElementById('task')).focus();
      });
      const details = document.createElement('div'); details.className = 'card-details';
      if (task.status === 'done') {
        details.append(metadataBadge('date-badge completed completion-badge', t('completed'), 'completed'));
      }
      if (task.dueDate) {
        const state = taskState(task);
        const shortDate = new Intl.DateTimeFormat(NabnakI18n.locale, {dateStyle: 'short'}).format(dateObject(task.dueDate));
        const visibleDate = ['overdue', 'dueToday'].includes(state) ? `${t(state)} · ${shortDate}` : shortDate;
        const badge = metadataBadge(`date-badge task-date ${state === 'completed' ? '' : state}`, visibleDate, 'date');
        const description = `${t(state)} - ${displayDate(task.dueDate)}`;
        badge.setAttribute('aria-label', description); badge.setAttribute('title', description);
        details.append(badge);
      }
      if (task.goalId) {
        const goal = snapshot.goals.find(goal => goal.id === task.goalId);
        if (goal) details.append(metadataBadge('task-goal', goal.title, 'goal'));
      }
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'card-action card-edit';
      edit.setAttribute('aria-label', `${t('editTask')}: ${titleFor(task)}`); edit.setAttribute('title', t('editTask'));
      const pencil = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      pencil.setAttribute('viewBox', '0 0 24 24'); pencil.setAttribute('aria-hidden', 'true'); pencil.setAttribute('focusable', 'false');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'm14.5 5.5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L5 15l-1 5Z');
      pencil.append(path); edit.append(pencil);
      guardCardAction(edit, card);
      edit.addEventListener('click', event => {
        event.stopPropagation(); restoreCardDrag(); window.NabnakPlanner.editTask(task.id);
      });
      const header = document.createElement('div'); header.className = 'card-header';
      const actions = document.createElement('div'); actions.className = 'card-actions';
      actions.append(edit, remove); header.append(status, actions); card.append(header, content);
      if (details.children.length) card.append(details);
      const moveLabel = document.createElement('label'); moveLabel.className = 'card-move';
      const moveText = document.createElement('span'); moveText.className = 'sr-only'; moveText.textContent = `${t('moveTask')}: ${titleFor(task)}`;
      const move = document.createElement('select'); move.setAttribute('aria-label', moveText.textContent);
      for (const value of ['todo', 'doing', 'done']) {
        const option = document.createElement('option'); option.value = value; option.textContent = t(value); move.append(option);
      }
      move.value = task.status; guardCardAction(move, card);
      move.addEventListener('change', () => {
        restoreCardDrag(); store.updateTask(task.id, {status: move.value}); announce('taskMoved');
        const updated = Array.from(document.querySelectorAll('.card')).find(item => item.dataset.taskId === task.id);
        (updated?.querySelector('select') || document.getElementById('task-search')).focus();
      });
      moveLabel.append(moveText, move); card.append(moveLabel);
      card.addEventListener('dragstart', event => {
        if (event.target.closest('button, input, select')) { event.preventDefault(); return; }
        draggedId = task.id; draggedCard = card;
        event.dataTransfer?.setData('text/plain', task.id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging'); zones.forEach(zone => zone.classList.add('highlight'));
      });
      card.addEventListener('dragend', endDrag);
      document.getElementById(task.status).append(card);
    }
    for (const zone of zones) {
      if (!visible.some(task => task.status === zone.id)) {
        const empty = document.createElement('p'); empty.className = 'empty-state column-empty';
        empty.textContent = t(filtered ? 'noMatches' : 'emptyColumn'); zone.append(empty);
      }
    }
    const warning = document.getElementById('storage-warning');
    warning.hidden = !store.getError(); warning.textContent = store.getError() ? t(store.getError()) : '';
  }
  for (const zone of zones) {
    zone.addEventListener('dragover', event => {
      if (!draggedId) return; event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; zone.classList.add('over');
    });
    zone.addEventListener('dragleave', event => { if (!zone.contains(event.relatedTarget)) zone.classList.remove('over'); });
    zone.addEventListener('drop', event => {
      if (!draggedId) return; event.preventDefault();
      const id = draggedId; endDrag();
      store.updateTask(id, {status: zone.id});
      announce('taskMoved');
    });
  }
  document.getElementById('addTask').addEventListener('submit', event => {
    event.preventDefault(); const input = document.getElementById('task');
    if (!input.value.trim()) return;
    store.addTask({title: input.value, dueDate: document.getElementById('new-task-date').value, goalId: document.getElementById('new-task-goal').value});
    input.value = ''; document.getElementById('new-task-date').value = ''; input.focus();
    announce('taskCreated');
  });
  store.subscribe(render); document.addEventListener('nabnak:languagechange', render);
  let lastDay = localDay();
  setInterval(() => {
    if (lastDay !== localDay()) { lastDay = localDay(); render(); document.dispatchEvent(new Event('nabnak:daychange')); }
  }, 30000);
  render();
})();
