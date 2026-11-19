const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {boot} = require('./dom-harness.cjs');
test('new interface dictionaries have identical keys and nonempty values in all three languages', () => {
  const context = vm.createContext({window: {}});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/planner-translations.js'), 'utf8'), context);
  const dictionaries = context.window.NabnakMessages, keys = Object.keys(dictionaries.en).sort();
  for (const lang of ['en', 'pt-BR', 'es']) {
    assert.deepEqual(Object.keys(dictionaries[lang]).sort(), keys);
    for (const key of keys) assert.ok(typeof dictionaries[lang][key] === 'string' && dictionaries[lang][key].length > 0);
  }
});
test('every marked label and interface message resolves in all supported languages', () => {
  const {document, context} = boot();
  const keys = new Set();
  for (const marker of ['data-i18n', 'data-i18n-label', 'data-i18n-alt', 'data-i18n-title', 'data-i18n-content', 'data-i18n-placeholder']) {
    document.querySelectorAll(`[${marker}]`).forEach(element => keys.add(element.getAttribute(marker)));
  }
  const scripts = ['store.js', 'planner.js', 'script.js', 'task-form.js'].map(file => fs.readFileSync(path.join(__dirname, '../js', file), 'utf8')).join('\n');
  for (const match of scripts.matchAll(/(?:\bt\(|throw new Error\()['"]([A-Za-z]+)['"]/g)) if (!['unsupported', 'invalidTasks', 'invalidGoals', 'unavailable'].includes(match[1])) keys.add(match[1]);
  for (const lang of ['en', 'pt-BR', 'es']) {
    document.querySelector(`input[value="${lang}"]`).click();
    for (const key of keys) assert.notEqual(context.NabnakI18n.t(key), key, `${lang}: ${key}`);
  }
});
test('sidebar animation still uses symmetric 350ms slide, fading backdrop and reduced-motion override', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');
  assert.match(css, /transform: translateX\(100%\);/);
  assert.match(css, /transition: transform 350ms ease-in-out, visibility 0s linear 350ms;/);
  assert.match(css, /\.language-menu\.is-open \.language-panel\{[^}]*transform: translateX\(0\);/);
  assert.match(css, /transition: opacity 350ms ease-in-out;/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  const {document, $} = boot();
  $('language-toggle').click(); assert.equal($('language-panel').inert, false);
  document.fire('keydown', {key: 'Escape'}); assert.equal($('language-panel').inert, true); assert.equal($('language-panel').hidden, false);
});
