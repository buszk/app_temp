const dmp = (() => {
  if (typeof diff_match_patch === 'undefined') {
    console.error('diff-match-patch library is not loaded.');
    return null;
  }
  const instance = new diff_match_patch();
  instance.Diff_Timeout = 0; // Run to completion for local diffs.
  return instance;
})();

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function computeDiff(aStr, bStr) {
  if (!dmp) return [];
  const diffs = dmp.diff_main(aStr || '', bStr || '');
  dmp.diff_cleanupSemantic(diffs);
  dmp.diff_cleanupEfficiency(diffs);
  return diffs;
}

export function renderDiff(container, diffs) {
  if (!container) return;
  if (!Array.isArray(diffs) || diffs.length === 0) {
    container.innerHTML = '';
    return;
  }

  const out = diffs.map((diff) => {
    const type = diff[0];
    const text = diff[1] ?? '';
    const cls = type === 0 ? 'eq' : (type === 1 ? 'ins' : 'del');
    return `<span class="tok ${cls}">${escapeHtml(text)}</span>`;
  });

  container.innerHTML = out.join('');
}
