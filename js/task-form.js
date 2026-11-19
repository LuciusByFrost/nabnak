// Presentation of the existing task form. Values and persistence stay with script.js.
(() => {
  'use strict';
  const form = document.getElementById('addTask');
  const {t} = NabnakI18n;
  const controls = [
    {button: 'task-date-toggle', panel: 'task-date-panel', input: 'new-task-date', summary: 'task-date-summary', key: 'dueButton'},
    {button: 'task-goal-toggle', panel: 'task-goal-panel', input: 'new-task-goal', summary: 'task-goal-summary', key: 'goalButton'}
  ].map(control => ({...control,
    button: document.getElementById(control.button), panel: document.getElementById(control.panel),
    input: document.getElementById(control.input), summary: document.getElementById(control.summary)
  }));
  function close(control, restoreFocus = false) {
    if (restoreFocus) control.button.focus();
    control.panel.hidden = true;
    control.button.setAttribute('aria-expanded', 'false');
  }
  function open(control) {
    controls.forEach(other => close(other));
    control.panel.hidden = false;
    control.button.setAttribute('aria-expanded', 'true');
    control.input.focus();
  }
  function refresh() {
    const goals = NabnakStore.getState().goals;
    controls.forEach(control => {
      let summary = '';
      if (control.key === 'dueButton' && NabnakData.validDate(control.input.value)) {
        summary = new Intl.DateTimeFormat(NabnakI18n.locale, {dateStyle: 'short'}).format(NabnakData.dateObject(control.input.value));
      } else if (control.key === 'goalButton') {
        summary = goals.find(goal => goal.id === control.input.value)?.title || '';
      }
      const label = summary ? `${t(control.key)}: ${summary}` : t(control.key);
      control.summary.textContent = summary || t(control.key);
      control.button.setAttribute('aria-label', label);
      control.button.setAttribute('title', label);
      control.button.classList.toggle('is-selected', Boolean(summary));
    });
  }
  controls.forEach(control => {
    control.button.addEventListener('click', () => control.panel.hidden ? open(control) : close(control));
    control.input.addEventListener('change', () => { refresh(); close(control, true); });
    // A partially entered native date must remain reachable if validation fails.
    control.input.addEventListener('invalid', () => open(control));
  });
  document.addEventListener('click', event => {
    if (!form.contains(event.target)) controls.forEach(control => close(control));
  });
  document.addEventListener('focusin', event => {
    if (!form.contains(event.target)) controls.forEach(control => close(control));
  });
  form.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const active = controls.find(control => !control.panel.hidden);
    if (active) { event.preventDefault(); event.stopPropagation(); close(active, true); }
  });
  // The existing submit handler runs first and clears the date after creating a task.
  form.addEventListener('submit', () => { controls.forEach(control => close(control)); refresh(); });
  NabnakStore.subscribe(refresh);
  document.addEventListener('nabnak:languagechange', refresh);
  refresh();
})();
