(() => {
  'use strict';
  const {t} = NabnakI18n;
  const {localDay, dateObject, monthDays, shiftMonth, taskState} = NabnakData;
  const store = NabnakStore;
  const calendar = document.getElementById('calendar-dialog');
  const editor = document.getElementById('task-dialog');
  const goalsDialog = document.getElementById('goals-dialog');
  const goalEditor = document.getElementById('goal-dialog');
  let editingGoalId = null;
  let taskOriginGoal = null;
  let selected = localDay(), month = selected.slice(0, 7), editingId = null;
  const $ = id => document.getElementById(id);
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function show(dialog) { if (!dialog.open) dialog.showModal(); }
  function renderCalendar() {
    $('calendar-month').value = month;
    $('calendar-heading').textContent = new Intl.DateTimeFormat(NabnakI18n.locale, {month: 'long', year: 'numeric'}).format(dateObject(`${month}-01`));
    const week = $('calendar-week'); week.replaceChildren();
    for (let day = 0; day < 7; day++) {
      const date = new Date(2024, 0, 7 + day, 12);
      week.append(make('span', '', new Intl.DateTimeFormat(NabnakI18n.locale, {weekday: 'short'}).format(date)));
    }
    const dates = $('calendar-days'); dates.replaceChildren();
    const allTasks = store.getState().tasks;
    for (const date of monthDays(month)) {
      if (!date) { const blank = make('span', 'calendar-blank'); blank.setAttribute('aria-hidden', 'true'); dates.append(blank); continue; }
      const tasks = allTasks.filter(task => task.dueDate === date);
      const button = make('button', 'calendar-day'); button.type = 'button'; button.dataset.date = date;
      button.setAttribute('aria-pressed', String(date === selected));
      button.setAttribute('aria-label', `${NabnakDisplayDate(date)} · ${t('tasksCount')}: ${tasks.length}`);
      if (date === localDay()) button.setAttribute('aria-current', 'date');
      button.append(make('span', '', String(Number(date.slice(-2)))));
      if (tasks.length) {
        button.append(make('span', 'day-count', String(tasks.length)));
        const dots = make('span', 'day-markers');
        for (const state of new Set(tasks.map(task => taskState(task)))) {
          const dot = make('span', `day-dot ${state}`); dot.title = t(state); dots.append(dot);
        }
        button.append(dots);
      }
      button.addEventListener('click', () => { selected = date; renderCalendar(); dates.querySelector(`[data-date="${date}"]`).focus(); });
      dates.append(button);
    }
    $('selected-date').textContent = NabnakDisplayDate(selected);
    const list = $('calendar-tasks'); list.replaceChildren();
    const tasks = store.tasksOn(selected);
    if (!tasks.length) list.append(make('p', 'empty-state', t('emptyDay')));
    tasks.forEach(task => {
      const row = make('div', 'planner-task');
      const text = make('div', 'planner-task-text');
      text.append(make('span', '', NabnakTaskTitle(task)), make('span', `date-badge ${taskState(task)}`, t(taskState(task))));
      const edit = make('button', '', t('editTask')); edit.type = 'button'; edit.addEventListener('click', () => editTask(task.id));
      row.append(text, edit); list.append(row);
    });
    $('calendar-legend').replaceChildren(...['overdue', 'dueToday', 'completed', 'upcoming'].map(state => make('span', `date-badge ${state}`, t(state))));
  }
  function editTask(id = null, dueDate = '', goalId = '') {
    editingId = id;
    const task = id ? store.getState().tasks.find(task => task.id === id) : null;
    if (id && !task) return;
    $('task-editor-heading').textContent = t(task ? 'editTask' : 'newTask');
    $('edit-task-title').value = task ? NabnakTaskTitle(task) : '';
    $('edit-task-date').value = task?.dueDate || dueDate;
    $('edit-task-status').value = task?.status || 'todo';
    taskOriginGoal = goalId || task?.goalId || null;
    const choices = $('edit-task-goal'); choices.replaceChildren();
    const none = make('option', '', t('noGoal')); none.value = ''; choices.append(none);
    store.getState().goals.forEach(goal => { const option = make('option', '', goal.title); option.value = goal.id; choices.append(option); });
    choices.value = task?.goalId || goalId;
    $('delete-task').hidden = !task; $('task-error').textContent = '';
    show(editor); $('edit-task-title').focus();
  }
  $('open-calendar').addEventListener('click', () => { NabnakI18n.closeMenu(); renderCalendar(); show(calendar); });
  $('calendar-new-task').addEventListener('click', () => editTask(null, selected));
  for (const [id, offset] of [['previous-month', -1], ['next-month', 1], ['previous-year', -12], ['next-year', 12]]) {
    $(id).addEventListener('click', () => { month = shiftMonth(month, offset); selected = `${month}-01`; renderCalendar(); });
  }
  $('calendar-month').addEventListener('change', event => {
    if (!NabnakData.validDate(`${event.target.value}-01`)) return;
    month = event.target.value; selected = `${month}-01`; renderCalendar();
  });
  $('calendar-today').addEventListener('click', () => { selected = localDay(); month = selected.slice(0, 7); renderCalendar(); });
  $('task-editor-form').addEventListener('submit', event => {
    event.preventDefault();
    const current = store.getState().tasks.find(task => task.id === editingId);
    const input = {title: $('edit-task-title').value, dueDate: $('edit-task-date').value, status: $('edit-task-status').value, goalId: $('edit-task-goal').value};
    if (current?.exampleKey && input.title === NabnakTaskTitle(current)) input.title = current.title;
    try {
      if (editingId) store.updateTask(editingId, input); else store.addTask(input);
      editor.close();
    } catch (error) { $('task-error').textContent = t(error.message); }
  });
  $('delete-task').addEventListener('click', () => {
    if (editingId && window.confirm(t('deleteTaskConfirm'))) { store.deleteTask(editingId); editor.close(); }
  });
  function focusGoal(goalId) {
    const card = Array.from($('goals-list').querySelectorAll('.goal-card')).find(card => card.dataset.goalId === goalId);
    (card?.querySelector('h3') || $('new-goal')).focus();
  }
  function renderGoals() {
    const list = $('goals-list'); list.replaceChildren();
    const {goals, tasks} = store.getState();
    if (!goals.length) list.append(make('p', 'empty-state', t('emptyGoals')));
    goals.forEach(goal => {
      const progress = NabnakData.goalProgress(goal, tasks);
      const card = make('article', `goal-card goal-${progress.state}`); card.dataset.goalId = goal.id;
      const heading = make('h3', '', goal.title); heading.tabIndex = -1; card.append(heading);
      if (goal.description) card.append(make('p', 'goal-description', goal.description));
      card.append(make('span', `date-badge ${progress.state}`, `${t(progress.state)} · ${NabnakDisplayDate(goal.dueDate)}`));
      const bar = make('progress'); bar.max = 100; bar.value = progress.percent;
      bar.setAttribute('aria-label', `${goal.title}: ${progress.percent}%`);
      bar.textContent = `${progress.percent}%`; card.append(bar);
      card.append(make('p', 'goal-progress-text', `${progress.completed} / ${goal.target} ${t('tasksCompleted')} · ${progress.percent}%`));
      const actions = make('div', 'planner-actions');
      const edit = make('button', '', t('editGoal')); edit.type = 'button'; edit.addEventListener('click', () => editGoal(goal.id));
      const add = make('button', '', t('newTask')); add.type = 'button'; add.addEventListener('click', () => editTask(null, '', goal.id));
      actions.append(edit, add); card.append(actions);
      card.append(make('h4', '', t('associatedTasks')));
      const associated = tasks.filter(task => task.goalId === goal.id);
      if (!associated.length) card.append(make('p', 'empty-state', t('emptyGoalTasks')));
      associated.forEach(task => {
        const row = make('div', 'planner-task');
        const text = make('div', 'planner-task-text');
        text.append(make('span', '', NabnakTaskTitle(task)), make('span', `date-badge ${taskState(task)}`, t(taskState(task))));
        const editTaskButton = make('button', '', t('editTask')); editTaskButton.type = 'button'; editTaskButton.addEventListener('click', () => editTask(task.id));
        const unlink = make('button', '', t('unlink')); unlink.type = 'button';
        unlink.addEventListener('click', () => { store.updateTask(task.id, {goalId: null}); focusGoal(goal.id); });
        row.append(text, editTaskButton, unlink); card.append(row);
      });
      const available = tasks.filter(task => !task.goalId);
      if (available.length) {
        const form = make('form', 'associate-form');
        const label = make('label', '', t('associateTask'));
        const select = make('select'); select.required = true;
        const placeholder = make('option', '', t('chooseTask')); placeholder.value = ''; select.append(placeholder);
        available.forEach(task => { const option = make('option', '', NabnakTaskTitle(task)); option.value = task.id; select.append(option); });
        label.append(select); form.append(label);
        const submit = make('button', '', t('associate')); submit.type = 'submit'; form.append(submit);
        form.addEventListener('submit', event => {
          event.preventDefault(); if (!select.value) return;
          store.updateTask(select.value, {goalId: goal.id}); focusGoal(goal.id);
        });
        card.append(form);
      }
      list.append(card);
    });
  }
  function editGoal(id = null) {
    editingGoalId = id;
    const goal = store.getState().goals.find(goal => goal.id === id);
    if (id && !goal) return;
    $('goal-editor-heading').textContent = t(goal ? 'editGoal' : 'newGoal');
    $('edit-goal-title').value = goal?.title || '';
    $('edit-goal-description').value = goal?.description || '';
    $('edit-goal-date').value = goal?.dueDate || '';
    $('edit-goal-target').value = goal?.target || 1;
    $('delete-goal').hidden = !goal; $('goal-error').textContent = '';
    show(goalEditor); $('edit-goal-title').focus();
  }
  $('open-goals').addEventListener('click', () => { NabnakI18n.closeMenu(); renderGoals(); show(goalsDialog); });
  $('new-goal').addEventListener('click', () => editGoal());
  $('goal-editor-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = {title: $('edit-goal-title').value, description: $('edit-goal-description').value, dueDate: $('edit-goal-date').value, target: $('edit-goal-target').value};
    try {
      if (editingGoalId) store.updateGoal(editingGoalId, input);
      else editingGoalId = store.addGoal(input).id;
      goalEditor.close();
    } catch (error) { $('goal-error').textContent = t(error.message); }
  });
  $('delete-goal').addEventListener('click', () => {
    if (editingGoalId && window.confirm(t('deleteGoalConfirm'))) { store.deleteGoal(editingGoalId); goalEditor.close(); }
  });
  goalEditor.addEventListener('close', () => { if (goalsDialog.open) focusGoal(editingGoalId); });
  editor.addEventListener('close', () => {
    if (calendar.open) $('calendar-new-task').focus();
    else if (goalsDialog.open) focusGoal(taskOriginGoal);
    else {
      const card = Array.from(document.querySelectorAll('.card')).find(card => card.dataset.taskId === editingId);
      (card?.querySelector('.card-edit') || $('task')).focus();
    }
  });
  for (const dialog of [calendar, editor, goalsDialog, goalEditor]) {
    dialog.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  }
  function refresh() {
    if (calendar.open) renderCalendar();
    if (goalsDialog.open) renderGoals();
  }
  store.subscribe(refresh);
  document.addEventListener('nabnak:languagechange', () => {
    refresh(); if (editor.open) $('task-editor-heading').textContent = t(editingId ? 'editTask' : 'newTask');
    if (editor.open) $('edit-task-goal').querySelector('option').textContent = t('noGoal');
    if (goalEditor.open) $('goal-editor-heading').textContent = t(editingGoalId ? 'editGoal' : 'newGoal');
  });
  document.addEventListener('nabnak:daychange', refresh);
  window.NabnakPlanner = {editTask};
})();
