(() => {
  'use strict';
  const theme = document.getElementById('theme-select');
  const skinButtons = Array.from(document.querySelectorAll('[data-skin-option]'));
  const illustrations = document.getElementById('theme-illustrations');
  const illustrationLabel = illustrations.parentElement.querySelector('[data-i18n]');
  const sidebarNav = document.querySelector('.planner-nav'), sidebarPreferences = document.querySelector('.sidebar-preferences');
  function positionScene() {
    if (NabnakTheme.skin === 'original' || !NabnakTheme.illustrations) return;
    const available = sidebarPreferences.getBoundingClientRect().top - sidebarNav.getBoundingClientRect().bottom - 8;
    sidebarPreferences.style.setProperty('--lofi-sidebar-free', `${Math.max(0, Math.min(160, available))}px`);
  }
  function syncAppearance() {
    const original = NabnakTheme.skin === 'original';
    theme.disabled = !original;
    if (original) theme.removeAttribute('aria-describedby');
    else theme.setAttribute('aria-describedby', 'theme-mode-hint');
    theme.value = original ? NabnakTheme.preference : document.documentElement.getAttribute('data-theme');
    document.getElementById('theme-mode-hint').hidden = original;
    illustrations.checked = NabnakTheme.illustrations;
    illustrations.disabled = original;
    const labelKey = original ? 'themeIllustrations' : 'sceneIllustrations';
    illustrationLabel.setAttribute('data-i18n', labelKey); illustrationLabel.textContent = NabnakI18n.t(labelKey);
    skinButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.skinOption === NabnakTheme.skin)));
    positionScene();
  }
  skinButtons.forEach(button => button.addEventListener('click', () => NabnakTheme.setSkin(button.dataset.skinOption)));
  illustrations.addEventListener('change', () => NabnakTheme.setIllustrations(illustrations.checked));
  document.addEventListener('nabnak:themechange', syncAppearance);
  syncAppearance();
  if (window.ResizeObserver) {
    const sceneResize = new ResizeObserver(positionScene);
    for (const element of [document.getElementById('language-panel'), sidebarNav, sidebarPreferences]) sceneResize.observe(element);
  }
  window.addEventListener?.('resize', positionScene);
  document.fonts?.ready.then(positionScene);
  theme.addEventListener('change', () => NabnakTheme.set(theme.value));
  const buttons = Array.from(document.querySelectorAll('[data-view]'));
  const views = {
    tasks: [document.querySelector('.workspace'), 'workspace-title'],
    calendar: [document.getElementById('calendar-dialog'), 'calendar-title'],
    goals: [document.getElementById('goals-dialog'), 'goals-title'],
    mindmaps: [document.getElementById('mindmap-view'), 'mm-heading']
  };
  function show(view, focus = true) {
    if (!views[view]) return;
    if (!views.mindmaps[0].hidden && view !== 'mindmaps') NabnakMindmaps.suspend();
    for (const [key, [element]] of Object.entries(views)) element.hidden = key !== view;
    buttons.forEach(button => button.dataset.view === view ? button.setAttribute('aria-current', 'page') : button.removeAttribute('aria-current'));
    document.body.setAttribute('data-view', view);
    document.querySelector('.skip-link').setAttribute('href', '#' + views[view][1]);
    NabnakI18n.closeMenu();
    if (focus) document.getElementById(views[view][1]).focus();
  }
  const tasks = () => show('tasks');
  document.getElementById('open-tasks').addEventListener('click', tasks);
  document.querySelectorAll('[data-back-tasks]').forEach(button => button.addEventListener('click', tasks));
  window.NabnakShell = {show, tasks};
})();
