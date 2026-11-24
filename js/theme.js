// Runs before styles paint. Preferences never share a key with user content.
(() => {
  'use strict';
  const key = 'nabnak.theme';
  const skinKey = 'nabnak.skin', illustrationKey = 'nabnak.themeIllustrations';
  const skins = ['original', 'lofi-cafe', 'lofi-midnight'];
  const system = window.matchMedia?.('(prefers-color-scheme: dark)');
  let preference = 'system';
  let skin = 'original', illustrations = null;
  try { preference = localStorage.getItem(key) || 'system'; } catch { /* Session only. */ }
  try {
    skin = localStorage.getItem(skinKey) || 'original';
    const savedIllustrations = localStorage.getItem(illustrationKey);
    illustrations = savedIllustrations === 'true' ? true : savedIllustrations === 'false' ? false : null;
  } catch { /* Session only. */ }
  if (!['light', 'dark', 'system'].includes(preference)) preference = 'system';
  if (!skins.includes(skin)) skin = 'original';
  const illustrationsEnabled = () => illustrations ?? (skin !== 'original');
  function apply() {
    const originalMode = preference === 'system' ? (system?.matches ? 'dark' : 'light') : preference;
    const mode = skin === 'lofi-cafe' ? 'light' : skin === 'lofi-midnight' ? 'dark' : originalMode;
    document.documentElement.setAttribute('data-original-mode', originalMode);
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-skin', skin);
    document.documentElement.setAttribute('data-illustrations', illustrationsEnabled() ? 'on' : 'off');
    document.dispatchEvent(new Event('nabnak:themechange'));
  }
  apply();
  system?.addEventListener('change', apply);
  window.NabnakTheme = {
    get preference() { return preference; },
    get skin() { return skin; },
    get illustrations() { return illustrationsEnabled(); },
    set(value) {
      if (!['light', 'dark', 'system'].includes(value)) return;
      preference = value; apply();
      try { localStorage.setItem(key, value); } catch { /* Keep the choice for this session. */ }
    },
    setSkin(value) {
      if (!skins.includes(value)) return;
      skin = value; apply();
      try { localStorage.setItem(skinKey, value); } catch { /* Session only. */ }
    },
    setIllustrations(value) {
      illustrations = Boolean(value); apply();
      try { localStorage.setItem(illustrationKey, String(illustrations)); } catch { /* Session only. */ }
    }
  };
})();
