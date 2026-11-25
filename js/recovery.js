/* Recovery files contain private plaintext. Only explicitly owned keys are touched. */
(function (root, factory) {
  const common = typeof module === 'object' && module.exports;
  const api = factory(common ? require('./security.js') : root.NabnakSecurity, common ? require('./store.js') : root.NabnakData, common ? require('./mindmap-data.js') : root.NabnakMindData);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NabnakRecovery = api;
})(typeof window === 'object' ? window : globalThis, function (S, T, D) {
  'use strict';
  const dataKeys = ['nabnak.data', 'nabnak.mindmaps', 'nabnak.mindMaps', 'nabnak.maps'];
  const preferences = {'nabnak.language': ['en', 'pt-BR', 'es'], 'nabnak.theme': ['system', 'light', 'dark'], 'nabnak.skin': ['original', 'lofi-cafe', 'lofi-midnight'], 'nabnak.themeIllustrations': ['true', 'false'], 'nabnak.sidebar': ['open', 'collapsed']};
  const keys = [...dataKeys, ...dataKeys.map(key => key + '.backup'), ...Object.keys(preferences)];
  const PREVIOUS_KEY = 'nabnak.recovery.previous';
  const MAX_BYTES = 24 * 1024 * 1024;
  function backup(storage, unsaved = {}, includePrevious = true) {
    const entries = {};
    for (const key of keys) { const raw = storage.getItem(key); if (raw !== null) entries[key] = raw; }
    const envelope = {format: 'nabnak-recovery', version: 1, createdAt: new Date().toISOString(), entries, unsaved};
    if (includePrevious) { const previous = storage.getItem(PREVIOUS_KEY); if (previous !== null) envelope.previous = previous; }
    return JSON.stringify(envelope, null, 2);
  }
  function validate(raw, taskData, mindData) {
    const envelope = S.parse(raw, MAX_BYTES);
    if (envelope?.format !== 'nabnak-recovery' || envelope.version !== 1 || !envelope.entries || typeof envelope.entries !== 'object' || Array.isArray(envelope.entries)) throw new Error('recoveryError');
    const entries = {};
    const unsaved = envelope.unsaved ?? {}; S.object(unsaved);
    if (Object.keys(unsaved).some(key => !['nabnak.data', 'nabnak.mindmaps'].includes(key))) throw new Error('recoveryError');
    const effective = {...envelope.entries, ...unsaved};
    for (const [key, value] of Object.entries(unsaved)) {
      const old = envelope.entries[key];
      if (typeof old === 'string' && effective[key + '.backup'] === undefined) effective[key + '.backup'] = old;
    }
    for (const [key, value] of Object.entries(effective)) {
      if (!keys.includes(key) || typeof value !== 'string') throw new Error('recoveryError');
      if (preferences[key]) { if (!preferences[key].includes(value)) throw new Error('invalidInput'); }
      else if (key.endsWith('.backup')) {
        if (value.length > S.limits.bytes) throw new Error('resourceLimit');
      } else {
        S.parse(value);
        if (key.startsWith('nabnak.data')) {
          const memory = {getItem: name => name === taskData.STORAGE_KEY ? value : null, setItem() {}};
          if (taskData.createStore(memory).getError()) throw new Error('recoveryError');
        } else mindData.decode(S.parse(value), true);
      }
      entries[key] = value;
    }
    return entries;
  }
  function restore(storage, entries) {
    entries = validate(JSON.stringify({format: 'nabnak-recovery', version: 1, entries}), T, D);
    const before = new Map(Object.keys(entries).map(key => [key, storage.getItem(key)]));
    const written = [];
    try {
      // Durable, single-generation retention. If it cannot be saved, do not replace any content.
      storage.setItem(PREVIOUS_KEY, backup(storage, {}, false));
      for (const [key, value] of Object.entries(entries)) { storage.setItem(key, value); written.push(key); }
    } catch {
      // localStorage has no multi-key transaction. Roll back completed writes; never clear unrelated data.
      for (const key of written.reverse()) { const raw = before.get(key); try { if (raw === null) storage.removeItem(key); else storage.setItem(key, raw); } catch { /* Caller retains exported recovery file. */ } }
      throw new Error('recoveryError');
    }
  }
  function clear(storage) { for (const key of [...keys, PREVIOUS_KEY]) storage.removeItem(key); }
  return {keys: Object.freeze([...keys, PREVIOUS_KEY]), PREVIOUS_KEY, MAX_BYTES, backup, validate, restore, clear};
});
