function lcsMatrix(a, b, eq) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (eq(a[i - 1], b[j - 1])) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

function backtrack(a, b, dp, eq) {
  let i = a.length, j = b.length;
  const ops = [];
  while (i > 0 && j > 0) {
    if (eq(a[i - 1], b[j - 1])) {
      ops.push({ type: 'eq', a: a[i - 1], b: b[j - 1] });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ type: 'del', a: a[i - 1] });
      i--;
    } else {
      ops.push({ type: 'ins', b: b[j - 1] });
      j--;
    }
  }
  while (i > 0) { ops.push({ type: 'del', a: a[i - 1] }); i--; }
  while (j > 0) { ops.push({ type: 'ins', b: b[j - 1] }); j--; }
  ops.reverse();
  return ops;
}

function tokenize(str) {
  // Preserve whitespace tokens; split words vs whitespace blocks
  return str.split(/(\s+)/g).filter((t) => t.length > 0);
}

function isWs(tok) { return /^\s+$/.test(tok); }

function charDiff(a, b) {
  const aa = a.split('');
  const bb = b.split('');
  const dp = lcsMatrix(aa, bb, (x, y) => x === y);
  let i = aa.length, j = bb.length;
  const parts = [];
  while (i > 0 && j > 0) {
    if (aa[i - 1] === bb[j - 1]) { parts.push({ t: 'eq', ch: aa[i - 1] }); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) { parts.push({ t: 'del', ch: aa[i - 1] }); i--; }
    else { parts.push({ t: 'ins', ch: bb[j - 1] }); j--; }
  }
  while (i > 0) { parts.push({ t: 'del', ch: aa[i - 1] }); i--; }
  while (j > 0) { parts.push({ t: 'ins', ch: bb[j - 1] }); j--; }
  parts.reverse();
  return parts;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function computeDiff(aStr, bStr) {
  const at = tokenize(aStr);
  const bt = tokenize(bStr);
  const dp = lcsMatrix(at, bt, (x, y) => x === y);
  const ops = backtrack(at, bt, dp, (x, y) => x === y);

  // Merge consecutive dels/ins for char-level diff when 1:1 non-whitespace
  const merged = [];
  for (let i = 0; i < ops.length; i++) {
    const cur = ops[i];
    const prev = merged[merged.length - 1];
    if (!prev) { merged.push(cur); continue; }
    if (prev.type === 'del' && cur.type === 'ins' && !isWs(prev.a) && !isWs(cur.b)) {
      // Replace the previous del with a replace op
      merged.pop();
      merged.push({ type: 'rep', a: prev.a, b: cur.b });
    } else if (prev.type === cur.type && (cur.type === 'del' || cur.type === 'ins')) {
      // Concatenate same-type tokens
      if (cur.type === 'del') merged[merged.length - 1] = { type: 'del', a: prev.a + cur.a };
      else merged[merged.length - 1] = { type: 'ins', b: prev.b + cur.b };
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

export function renderDiff(container, ops) {
  const out = [];
  for (const op of ops) {
    if (op.type === 'eq') {
      out.push(`<span class=\"tok eq\">${escapeHtml(op.a)}</span>`);
    } else if (op.type === 'del') {
      out.push(`<span class=\"tok del\">${escapeHtml(op.a)}</span>`);
    } else if (op.type === 'ins') {
      out.push(`<span class=\"tok ins\">${escapeHtml(op.b)}</span>`);
    } else if (op.type === 'rep') {
      const parts = charDiff(op.a, op.b).map((p) => {
        const cls = p.t === 'eq' ? 'eq' : (p.t === 'ins' ? 'ins' : 'del');
        return `<span class=\"${cls}\">${escapeHtml(p.ch)}</span>`;
      }).join('');
      out.push(`<span class=\"tok\">${parts}</span>`);
    }
  }
  container.innerHTML = out.join('');
}

