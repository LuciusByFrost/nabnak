const test = require('node:test');
const assert = require('node:assert/strict');
const {boot} = require('./dom-harness.cjs');

test('Original is the default and retains every existing light, dark and system preference', () => {
  for (const [saved, systemDark, expected] of [[null, false, 'light'], [null, true, 'dark'], ['light', true, 'light'], ['dark', false, 'dark'], ['system', true, 'dark']]) {
    const data = new Map(saved ? [['nabnak.theme', saved]] : []);
    const app = boot(data, {colorScheme: systemDark ? 'dark' : 'light'});
    assert.equal(app.context.NabnakTheme.skin, 'original');
    assert.equal(app.document.documentElement.getAttribute('data-theme'), expected);
    assert.equal(app.$('theme-select').disabled, false);
    assert.equal(data.has('nabnak.skin'), false);
    assert.equal(data.get('nabnak.theme'), saved || undefined);
  }
});

test('preview buttons switch instantly, persist and restore Original without losing its mode', () => {
  const app = boot(new Map([['nabnak.theme', 'dark']]));
  const root = app.document.documentElement;
  for (const [id, skin, mode] of [['skin-cafe', 'lofi-cafe', 'light'], ['skin-midnight', 'lofi-midnight', 'dark'], ['skin-original', 'original', 'dark']]) {
    app.$(id).click();
    assert.equal(root.getAttribute('data-skin'), skin);
    assert.equal(root.getAttribute('data-theme'), mode);
    assert.equal(app.$(id).getAttribute('aria-pressed'), 'true');
    assert.equal(app.document.querySelectorAll('[data-skin-option]').filter(button => button.getAttribute('aria-pressed') === 'true').length, 1);
    assert.equal(app.$('theme-select').disabled, skin !== 'original');
    assert.equal(app.$('theme-select').getAttribute('aria-describedby'), skin === 'original' ? null : 'theme-mode-hint');
    assert.equal(app.data.get('nabnak.theme'), 'dark');
    assert.equal(boot(app.data).context.NabnakTheme.skin, skin);
  }
});

test('lo-fi themes stay stable across OS changes and Original resumes the system setting', () => {
  const app = boot(), scheme = app.media.find(item => item.query.includes('prefers-color-scheme'));
  app.$('skin-cafe').click(); scheme.change(true);
  assert.equal(app.document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(app.document.documentElement.getAttribute('data-original-mode'), 'dark');
  app.$('skin-original').click();
  assert.equal(app.document.documentElement.getAttribute('data-theme'), 'dark');
  app.$('skin-midnight').click(); scheme.change(false);
  assert.equal(app.document.documentElement.getAttribute('data-theme'), 'dark');
  app.$('skin-original').click();
  assert.equal(app.document.documentElement.getAttribute('data-theme'), 'light');
});

test('invalid saved or requested skins fall back safely without rewriting unknown saved values', () => {
  const app = boot(new Map([['nabnak.skin', 'future-theme']]));
  assert.equal(app.context.NabnakTheme.skin, 'original');
  assert.equal(app.data.get('nabnak.skin'), 'future-theme');
  app.context.NabnakTheme.setSkin('invalid');
  assert.equal(app.context.NabnakTheme.skin, 'original');
  assert.equal(app.data.get('nabnak.skin'), 'future-theme');
});

test('illustrations default on in lo-fi only, preserve explicit choices, and persist', () => {
  const app = boot();
  assert.equal(app.context.NabnakTheme.illustrations, false);
  assert.equal(app.$('theme-illustrations').disabled, true);
  app.$('skin-cafe').click();
  assert.equal(app.context.NabnakTheme.illustrations, true);
  assert.equal(app.data.has('nabnak.themeIllustrations'), false);
  app.$('theme-illustrations').checked = false; app.$('theme-illustrations').fire('change');
  assert.equal(boot(app.data).context.NabnakTheme.illustrations, false);
  app.$('skin-midnight').click(); assert.equal(app.context.NabnakTheme.illustrations, false);
  app.$('theme-illustrations').checked = true; app.$('theme-illustrations').fire('change');
  assert.equal(app.document.documentElement.getAttribute('data-illustrations'), 'on');
  const reloaded = boot(app.data);
  assert.equal(reloaded.$('theme-illustrations').checked, true);
  reloaded.$('skin-original').click(); assert.equal(reloaded.$('theme-illustrations').disabled, true);
});

test('legacy true/false illustration preferences and unknown values are preserved', () => {
  for (const [saved, expected] of [['true', true], ['false', false], ['future-value', true]]) {
    const app = boot(new Map([['nabnak.skin', 'lofi-cafe'], ['nabnak.themeIllustrations', saved]]));
    assert.equal(app.context.NabnakTheme.illustrations, expected);
    assert.equal(app.data.get('nabnak.themeIllustrations'), saved);
    app.$('skin-midnight').click(); assert.equal(app.context.NabnakTheme.illustrations, expected);
  }
});

test('all themes preserve saved task, goal, map and language data while switching in every view', () => {
  const app = boot(); const {$, context, data} = app;
  context.NabnakStore.addGoal({title: 'Meta do usuário', dueDate: '2099-01-01', target: 1});
  $('open-mindmaps').click(); $('mm-add').click(); $('mm-title').value = 'Ideia do usuário'; $('mm-title').fire('change');
  const tasks = data.get('nabnak.data'), maps = data.get('nabnak.mindmaps');
  for (const language of ['pt-BR', 'en', 'es']) {
    app.document.querySelector(`input[value="${language}"]`).click();
    for (const id of ['skin-cafe', 'skin-midnight', 'skin-original']) {
      $(id).click();
      for (const view of ['calendar', 'goals', 'mindmaps', 'tasks']) $('open-' + view).click();
      assert.equal(app.document.documentElement.lang, language);
      assert.notEqual(context.NabnakI18n.t('themeIllustrations'), 'themeIllustrations');
      assert.equal(data.get('nabnak.data'), tasks);
      assert.equal(data.get('nabnak.mindmaps'), maps);
    }
  }
});
