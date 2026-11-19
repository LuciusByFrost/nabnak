(() => {
  'use strict';

  // Add a dictionary and a matching radio option to support another language.
  const translations = {
    en: {
      language: 'Language', menuLabel: 'Language menu',
      todo: 'TO-DO', doing: 'DOING', done: 'DONE!',
      addTask: 'ADD TASK', addTaskLabel: 'Add task', garbage: 'Garbage',
      garbageHint: 'Drag a task here to remove it',
      sloganFirst: 'a simple', sloganSecond: 'kanban board',
      description: 'A simple kanban board.',
      exampleTodo: 'This task is waiting! (Try adding more tasks above.)',
      exampleDoing: 'This task is in progress! (Try dragging it to another column.)',
      exampleDone: 'This task is complete! (Try removing it with its delete button.)'
    },
    'pt-BR': {
      language: 'Idioma', menuLabel: 'Menu de idiomas',
      todo: 'A FAZER', doing: 'EM ANDAMENTO', done: 'CONCLUÍDO!',
      addTask: 'ADICIONAR TAREFA', addTaskLabel: 'Adicionar tarefa', garbage: 'Lixeira',
      garbageHint: 'Arraste uma tarefa aqui para removê-la',
      sloganFirst: 'um simples', sloganSecond: 'quadro kanban',
      description: 'Um simples quadro kanban.',
      exampleTodo: 'Esta é uma tarefa em espera! (Experimente adicionar outras tarefas logo acima.)',
      exampleDoing: 'Esta é uma tarefa sendo feita! (Experimente arrastá-la para outra coluna.)',
      exampleDone: 'Esta é uma tarefa concluída! (Experimente removê-la pelo botão de excluir.)'
    },
    es: {
      language: 'Idioma', menuLabel: 'Menú de idiomas',
      todo: 'POR HACER', doing: 'EN CURSO', done: '¡HECHO!',
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

  function setOpen(open, restoreFocus = false) {
    // Keep the panel rendered during exit; CSS delays visibility until it ends.
    if (!open && (restoreFocus || panel.contains(document.activeElement))) {
      toggle.focus();
    }
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggleIcon.textContent = open ? '×' : '☰';
    if (open) panel.querySelector('input:checked').focus();
  }

  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('click', event => {
    if (!menu.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) {
      setOpen(false, true);
    }
  });
  options.forEach(option => option.addEventListener('change', () => {
    applyLanguage(option.value);
    try { localStorage.setItem(storageKey, option.value); } catch {
      // Translation still works when browser storage is unavailable.
    }
  }));

  window.NabnakI18n = {t, translate, get locale() { return document.documentElement.lang; }, closeMenu() { setOpen(false, true); }};
  let savedLanguage = 'en';
  try { savedLanguage = localStorage.getItem(storageKey) || 'en'; } catch {
    // Use English when browser storage is unavailable.
  }
  applyLanguage(savedLanguage);
})();
