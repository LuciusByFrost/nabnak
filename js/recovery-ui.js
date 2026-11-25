(() => {
  'use strict';
  const R = NabnakRecovery, $ = id => document.getElementById(id), {t} = NabnakI18n;
  const report = key => { $('recovery-message').textContent = t(key); };
  function download() {
    try {
      const unsaved = {};
      if (['storageWriteError', 'storageConflict'].includes(NabnakStore.getError())) unsaved['nabnak.data'] = JSON.stringify(NabnakStore.getState());
      if (['mmWriteError', 'storageConflict'].includes(NabnakMindmaps.store.getError())) unsaved['nabnak.mindmaps'] = JSON.stringify(NabnakMindmaps.store.getState());
      const url = URL.createObjectURL(new Blob([R.backup(localStorage, unsaved)], {type: 'application/json'}));
      const link = document.createElement('a'); link.href = url; link.download = 'nabnak-recovery-v1.json';
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { report('recoveryError'); }
  }
  $('backup-data').addEventListener('click', download);
  $('restore-data').addEventListener('click', () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        if (file.size > R.MAX_BYTES) throw new Error('resourceLimit');
        const entries = R.validate(await file.text(), NabnakData, NabnakMindData);
        if (!window.confirm(t('restoreConfirm'))) return;
        // Retain exact current bytes before any replacement, including unreadable data.
        const before = R.backup(localStorage); R.restore(localStorage, entries);
        window.NabnakRecoveryPrevious = before;
        report('recoveryDone'); window.location?.reload?.();
      } catch (error) { report(['resourceLimit', 'unsafeKeys', 'unsupportedVersion'].includes(error.message) ? error.message : 'recoveryError'); }
    }); input.click();
  });
  $('clear-data').addEventListener('click', () => {
    if (!window.confirm(t('clearDataConfirm'))) return;
    try { R.clear(localStorage); report('clearDone'); window.location?.reload?.(); } catch { report('recoveryError'); }
  });
})();
