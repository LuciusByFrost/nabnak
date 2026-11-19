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
  function endDrag() {
    zones.forEach(zone => zone.classList.remove('highlight', 'over'));
    draggedCard?.classList.remove('dragging'); draggedId = null; draggedCard = null;
  }
  function render() {
    const snapshot = store.getState();
    const goalSelect = document.getElementById('new-task-goal');
    const selectedGoal = goalSelect.value;
    goalSelect.replaceChildren();
    const emptyGoal = document.createElement('option'); emptyGoal.value = ''; emptyGoal.textContent = t('noGoal'); goalSelect.append(emptyGoal);
    snapshot.goals.forEach(goal => { const option = document.createElement('option'); option.value = goal.id; option.textContent = goal.title; goalSelect.append(option); });
    goalSelect.value = snapshot.goals.some(goal => goal.id === selectedGoal) ? selectedGoal : '';
    for (const zone of zones) zone.replaceChildren();
    for (const task of snapshot.tasks) {
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
        const nextCard = Array.from(document.querySelectorAll('.card')).find(item => item.dataset.taskId === neighbor?.id);
        (nextCard?.querySelector('.card-delete') || document.getElementById('task')).focus();
      });
      const details = document.createElement('div'); details.className = 'card-details';
      if (task.goalId) {
        const label = document.createElement('span'); label.className = 'task-goal';
        label.textContent = snapshot.goals.find(goal => goal.id === task.goalId)?.title || ''; details.append(label);
      }
      if (task.dueDate || task.status === 'done') {
        const badge = document.createElement('span'); const state = taskState(task);
        badge.className = `date-badge ${state}`;
        badge.textContent = `${t(state)}${task.dueDate ? ' - ' + displayDate(task.dueDate) : ''}`;
        details.append(badge);
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
    });
  }
  document.getElementById('addTask').addEventListener('submit', event => {
    event.preventDefault(); const input = document.getElementById('task');
    if (!input.value.trim()) return;
    store.addTask({title: input.value, dueDate: document.getElementById('new-task-date').value, goalId: document.getElementById('new-task-goal').value});
    input.value = ''; document.getElementById('new-task-date').value = ''; input.focus();
  });
  store.subscribe(render); document.addEventListener('nabnak:languagechange', render);
  let lastDay = localDay();
  setInterval(() => {
    if (lastDay !== localDay()) { lastDay = localDay(); render(); document.dispatchEvent(new Event('nabnak:daychange')); }
  }, 30000);
  render();
})();
