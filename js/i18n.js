(() => {
  'use strict';

  // Add a dictionary and a matching radio option to support another language.
  const translations = {
    en: {
      myTasks: 'My tasks', tasksSubtitle: 'Organize your day with ease.',
      language: 'Language', menuLabel: 'Language menu',
      todo: 'To do', doing: 'In progress', done: 'Done',
      addTask: 'ADD TASK', addTaskLabel: 'Add task', garbage: 'Garbage',
      garbageHint: 'Drag a task here to remove it',
      sloganFirst: 'a simple', sloganSecond: 'kanban board',
      description: 'A simple kanban board.',
      exampleTodo: 'This task is waiting! (Try adding more tasks above.)',
      exampleDoing: 'This task is in progress! (Try dragging it to another column.)',
      exampleDone: 'This task is complete! (Try removing it with its delete button.)'
    },
    'pt-BR': {
      myTasks: 'Minhas tarefas', tasksSubtitle: 'Organize seu dia de forma simples',
      language: 'Idioma', menuLabel: 'Menu de idiomas',
      todo: 'A Fazer', doing: 'Em Andamento', done: 'Concluído',
      addTask: 'ADICIONAR TAREFA', addTaskLabel: 'Adicionar tarefa', garbage: 'Lixeira',
      garbageHint: 'Arraste uma tarefa aqui para removê-la',
      sloganFirst: 'um simples', sloganSecond: 'quadro kanban',
      description: 'Um simples quadro kanban.',
      exampleTodo: 'Esta é uma tarefa em espera! (Experimente adicionar outras tarefas logo acima.)',
      exampleDoing: 'Esta é uma tarefa sendo feita! (Experimente arrastá-la para outra coluna.)',
      exampleDone: 'Esta é uma tarefa concluída! (Experimente removê-la pelo botão de excluir.)'
    },
    es: {
      myTasks: 'Mis tareas', tasksSubtitle: 'Organiza tu día de forma sencilla.',
      language: 'Idioma', menuLabel: 'Menú de idiomas',
      todo: 'Por hacer', doing: 'En curso', done: 'Completado',
      addTask: 'AÑADIR TAREA', addTaskLabel: 'Añadir tarea', garbage: 'Papelera',
      garbageHint: 'Arrastra una tarea aquí para eliminarla',
      sloganFirst: 'un sencillo', sloganSecond: 'tablero kanban',
      description: 'Un sencillo tablero kanban.',
      exampleTodo: '¡Esta tarea está pendiente! (Prueba a añadir más tareas arriba.)',
      exampleDoing: '¡Esta tarea está en curso! (Prueba a arrastrarla a otra columna.)',
      exampleDone: '¡Esta tarea está terminada! (Prueba a eliminarla con su botón de eliminar.)'
    }
  };
  for (const [language, messages] of Object.entries(window.NabnakMessages || {})) {
    Object.assign(translations[language], messages);
  }
  const storageKey = 'nabnak.language';
  const menu = document.querySelector('.language-menu');
  const toggle = document.getElementById('language-toggle');
  const panel = document.getElementById('language-panel');
  const backdrop = menu.querySelector('.language-backdrop');
  const toggleIcon = toggle.querySelector('[aria-hidden]');
  const options = panel.querySelectorAll('input[name="language"]');
  const desktop = window.matchMedia?.('(min-width: 1100px)');
  let sidebarPreference = true;
  try { sidebarPreference = localStorage.getItem('nabnak.sidebar') !== 'collapsed'; } catch { /* Session only. */ }

  const markers = [
    ['data-i18n', null], ['data-i18n-label', 'aria-label'],
    ['data-i18n-alt', 'alt'], ['data-i18n-title', 'title'],
    ['data-i18n-content', 'content'], ['data-i18n-placeholder', 'placeholder']
  ];
  const t = key => translations[document.documentElement.lang]?.[key] ?? translations.en[key] ?? key;
  function translate(root = document) {
    markers.forEach(([marker, attribute]) => {
      root.querySelectorAll(`[${marker}]`).forEach(element => {
        const text = t(element.getAttribute(marker));
        if (attribute) element.setAttribute(attribute, text);
        else element.textContent = text;
      });
    });
  }

  function applyLanguage(language) {
    const selected = Object.hasOwn(translations, language) ? language : 'en';
    document.documentElement.lang = selected;
    translate();
    options.forEach(option => { option.checked = option.value === selected; });
    document.dispatchEvent(new Event('nabnak:languagechange'));
  }

  function setOpen(open, restoreFocus = false, persist = false) {
    // Keep the panel rendered during exit; CSS delays visibility until it ends.
    if (!open && (restoreFocus || panel.contains(document.activeElement))) {
      toggle.focus();
    }
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
    menu.classList.toggle('is-open', open);
    document.body.setAttribute('data-sidebar', open ? 'open' : 'collapsed');
    toggle.setAttribute('aria-expanded', String(open));
    toggleIcon.textContent = open ? '×' : '☰';
    if (persist && desktop?.matches) {
      sidebarPreference = open;
      try { localStorage.setItem('nabnak.sidebar', open ? 'open' : 'collapsed'); } catch { /* Session only. */ }
    }
    for (const content of document.querySelectorAll('.workspace, .planner-view, .mm-view')) content.inert = open && !desktop?.matches;
    if (open && !desktop?.matches) panel.querySelector('[aria-current="page"]')?.focus();
  }

  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('is-open'), true, true));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('click', event => {
    if (!desktop?.matches && !menu.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('is-open') && (!desktop?.matches || menu.contains(event.target))) {
      setOpen(false, true, true);
    }
    if (event.key === 'Tab' && !desktop?.matches && menu.classList.contains('is-open')) {
      const controls = [toggle, ...panel.querySelectorAll('button, input, select, summary')].filter(control => !control.disabled && (!control.closest('details') || control.tagName === 'SUMMARY' || control.tagName === 'summary' || control.closest('details').open));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  options.forEach(option => option.addEventListener('change', () => {
    applyLanguage(option.value);
    try { localStorage.setItem(storageKey, option.value); } catch {
      // Translation still works when browser storage is unavailable.
    }
  }));

  window.NabnakI18n = {t, translate, get locale() { return document.documentElement.lang; }, closeMenu() { if (!desktop?.matches) setOpen(false, true); }};
  let savedLanguage = 'en';
  try { savedLanguage = localStorage.getItem(storageKey) || 'en'; } catch {
    // Use English when browser storage is unavailable.
  }
  applyLanguage(savedLanguage);
  setOpen(Boolean(desktop?.matches && sidebarPreference));
  desktop?.addEventListener('change', () => setOpen(Boolean(desktop.matches && sidebarPreference)));
})();
