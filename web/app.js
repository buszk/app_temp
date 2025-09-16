import { storage, DEFAULT_PROMPT } from './storage.js';
import { fsapi } from './fs.js';
import { llm } from './llm.js';
import { computeDiff, renderDiff } from './diff.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Autosave state for research textarea
let _suppressResearchSave = false;
let _researchSaveTimer = null;
let _lastManageSchool = '';
// Autosave state for template textarea
let _templateSaveTimer = null;

function setActiveTab(id) {
  $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${id}`));
}

function initTabs() {
  $$('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  });
}

function refreshSchoolsUI() {
  const list = storage.getSchools();
  const ul = $('#school-list');
  ul.innerHTML = '';
  for (const s of list) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = s;
    const del = document.createElement('button');
    del.textContent = 'Remove';
    del.addEventListener('click', () => {
      storage.removeSchool(s);
      refreshSchoolsUI();
      refreshSchoolSelect();
      refreshManageSelect();
    });
    li.appendChild(name);
    li.appendChild(del);
    ul.appendChild(li);
  }
}

function refreshSchoolSelect() {
  const sel = $('#school-select');
  const schools = storage.getSchools();
  sel.innerHTML = '';
  for (const s of schools) {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    sel.appendChild(opt);
  }
  // Auto-load variant for current selection if present
  loadVariantForSelected();
}

function refreshManageSelect() {
  const sel = document.getElementById('school-manage-select');
  if (!sel) return;
  const schools = storage.getSchools();
  sel.innerHTML = '';
  for (const s of schools) {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    sel.appendChild(opt);
  }
  loadManageDetails();
}

function initTemplate() {
  const t = storage.getTemplate();
  $('#template-input').value = t;
  $('#orig-text').value = t;
  // Initialize OpenAI key and prompt template
  const key = storage.getOpenAIKey();
  const prompt = storage.getPrompt() || DEFAULT_PROMPT;
  const keyEl = document.getElementById('openai-key');
  const promptEl = document.getElementById('prompt-input');
  if (keyEl) keyEl.value = key;
  if (promptEl) promptEl.value = prompt;
}

function showTemplateStatus(msg) { $('#template-status').textContent = msg; setTimeout(()=> $('#template-status').textContent = '', 1200); }
function showCommitStatus(msg) { $('#commit-status').textContent = msg; setTimeout(()=> $('#commit-status').textContent = '', 1600); }
function showImportStatus(msg) { const el = document.getElementById('import-status'); if (el) { el.textContent = msg; setTimeout(()=> el.textContent = '', 1600); } }
function showFallbackStatus(msg) { const el = document.getElementById('fallback-status'); if (el) { el.textContent = msg; setTimeout(()=> el.textContent = '', 1600); } }
function showOpenAIStatus(msg) { const el = document.getElementById('openai-status'); if (el) { el.textContent = msg; setTimeout(()=> el.textContent = '', 1200); } }
function showPromptStatus(msg) { const el = document.getElementById('prompt-status'); if (el) { el.textContent = msg; setTimeout(()=> el.textContent = '', 1200); } }

function updateDiff() {
  const a = $('#orig-text').value || '';
  const b = $('#mod-text').value || '';
  renderDiff($('#diff-view'), computeDiff(a, b));
}

async function onGenerateVariant() {
  const tmpl = $('#orig-text').value || '';
  const school = $('#school-select').value || '';
  const btn = document.getElementById('generate-variant');
  const spinner = btn ? btn.querySelector('.spinner') : null;
  const btnText = btn ? btn.querySelector('.btn-text') : null;
  const genStatus = document.getElementById('gen-status');
  if (genStatus) genStatus.textContent = '';
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.classList.add('loading');
  }
  if (spinner) spinner.classList.remove('hidden');
  if (btn && btnText) {
    const loadingLabel = btn.dataset.loadingLabel || 'Generating...';
    btnText.textContent = loadingLabel;
  }

  try {
    const result = await llm.generate(tmpl, school);
    const text = typeof result === 'string' ? result : result.text;
    const used = typeof result === 'object' && result.usedOpenAI;
    const err = typeof result === 'object' && result.error;
    $('#mod-text').value = text || '';
    if (err) {
      alert(`OpenAI error: ${err}`);
    }
    if (genStatus) {
      if (used) genStatus.textContent = 'Generated with OpenAI';
      else genStatus.textContent = err ? 'Fell back (OpenAI error)' : 'Generated locally';
      setTimeout(()=> genStatus.textContent = '', 1600);
    }
    updateDiff();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.classList.remove('loading');
    }
    if (spinner) spinner.classList.add('hidden');
    if (btn && btnText) {
      const defaultLabel = btn.dataset.defaultLabel || 'Generate Variant';
      btnText.textContent = defaultLabel;
    }
  }
}

async function onChooseRoot() {
  try {
    const name = await fsapi.chooseRoot();
    $('#root-path').textContent = name ? `Chosen: ${name}` : '';
  } catch (e) {
    alert(e.message || String(e));
  }
}

async function onCommit() {
  const school = $('#school-select').value || '';
  if (!school) { alert('Select a school first.'); return; }
  let content = $('#mod-text').value || '';
  if (!content.trim()) {
    const stored = storage.getVariant(school);
    if (stored && stored.trim()) content = stored;
  }
  if (!content.trim()) { alert('No content to commit. Generate or paste a variant first.'); return; }
  if (!confirm(`Commit variant for "${school}" to disk?\nPlease review the diff before confirming.`)) return;
  try {
    // Ensure export directory is chosen; prompt if not yet selected
    if (fsapi.isSupported && typeof fsapi.isSupported === 'function' && fsapi.isSupported() && (!fsapi.getRootName || !fsapi.getRootName())) {
      try {
        const name = await fsapi.chooseRoot();
        const rootEl = document.getElementById('root-path');
        if (rootEl && name) rootEl.textContent = `Chosen: ${name}`;
      } catch (e) {
        // If user cancels, fallback to download
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'personal_statement.txt';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        storage.setVariant(school, content);
        showCommitStatus('Saved locally. Downloaded file since no folder chosen.');
        return;
      }
    }
    await fsapi.writeVariant(school, content);
    storage.setVariant(school, content);
    showCommitStatus('Committed to folder and saved locally.');
  } catch (e) {
    // On error, still save locally and offer download fallback
    storage.setVariant(school, content);
    const msg = e?.message || String(e);
    const proceed = confirm(`Writing to folder failed: ${msg}\nDownload the file instead?`);
    if (proceed) {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'personal_statement.txt';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      showCommitStatus('Saved locally and downloaded file.');
    } else {
      alert(msg);
    }
  }
}

function loadVariantForSelected() {
  const school = $('#school-select').value || '';
  if (!school) return;
  const variant = storage.getVariant(school);
  if (variant) {
    $('#mod-text').value = variant;
    updateDiff();
  }
}

async function onImport() {
  try {
    const map = await fsapi.importAll();
    const schools = storage.getSchools();
    let added = 0;
    for (const [name, text] of Object.entries(map)) {
      if (!schools.includes(name)) schools.push(name);
      storage.setVariant(name, text);
      added++;
    }
    storage.setSchools(schools);
    refreshSchoolsUI();
    refreshSchoolSelect();
    showImportStatus(`Imported ${added} variant(s).`);
  } catch (e) {
    alert(e.message || String(e));
  }
}

function initEvents() {
  $('#save-template').addEventListener('click', () => {
    const txt = $('#template-input').value || '';
    storage.setTemplate(txt);
    $('#orig-text').value = txt;
    updateDiff();
    showTemplateStatus('Saved.');
  });
  // Autosave template on input and blur
  const tplEl = document.getElementById('template-input');
  if (tplEl) {
    const doTplSave = () => {
      const txt = tplEl.value || '';
      storage.setTemplate(txt);
      const orig = document.getElementById('orig-text');
      if (orig) orig.value = txt;
      updateDiff();
      showTemplateStatus('Autosaved');
    };
    tplEl.addEventListener('input', () => {
      if (_templateSaveTimer) clearTimeout(_templateSaveTimer);
      _templateSaveTimer = setTimeout(doTplSave, 600);
    });
    tplEl.addEventListener('blur', () => {
      if (_templateSaveTimer) { clearTimeout(_templateSaveTimer); _templateSaveTimer = null; }
      doTplSave();
    });
  }

  $('#add-school').addEventListener('click', () => {
    const raw = $('#school-name').value || '';
    const name = raw.trim();
    if (!name) return;
    storage.addSchool(name);
    $('#school-name').value = '';
    refreshSchoolsUI();
    refreshSchoolSelect();
    refreshManageSelect();
    const manageSel = document.getElementById('school-manage-select');
    if (manageSel) {
      manageSel.value = name;
      loadManageDetails();
      const researchEl = document.getElementById('school-research');
      if (researchEl) researchEl.focus();
    }
  });

  $('#generate-variant').addEventListener('click', onGenerateVariant);
  $('#choose-root').addEventListener('click', onChooseRoot);
  $('#commit-variant').addEventListener('click', onCommit);
  $('#mod-text').addEventListener('input', updateDiff);
  $('#school-select').addEventListener('change', loadVariantForSelected);

  const importBtn = document.getElementById('import-variants');
  if (importBtn) importBtn.addEventListener('click', onImport);

  // Fallback actions: Download and Copy
  const dlBtn = document.getElementById('download-variant');
  if (dlBtn) dlBtn.addEventListener('click', () => {
    const school = $('#school-select').value || 'school';
    let content = $('#mod-text').value || '';
    if (!content.trim()) {
      // Try stored variant as fallback
      const stored = storage.getVariant(school);
      if (stored && stored.trim()) content = stored;
    }
    if (!content.trim()) {
      alert('No content to download. Generate or paste a variant first.');
      return;
    }
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'personal_statement.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showFallbackStatus(`Downloaded for ${school}.`);
  });

  const copyBtn = document.getElementById('copy-variant');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    let text = $('#mod-text').value || '';
    const school = $('#school-select').value || '';
    if (!text.trim() && school) {
      const stored = storage.getVariant(school);
      if (stored && stored.trim()) text = stored;
    }
    if (!text.trim()) { alert('No content to copy.'); return; }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for insecure contexts
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      showFallbackStatus('Copied to clipboard.');
    } catch (e) {
      alert('Copy failed: ' + (e.message || String(e)));
    }
  });

  // Download all variants as ZIP (via JSZip)
  const zipBtn = document.getElementById('download-zip-all');
  if (zipBtn) zipBtn.addEventListener('click', async () => {
    try {
      const JSZipLib = window.JSZip;
      if (!JSZipLib) { alert('ZIP library not loaded. Check your network connection.'); return; }
      const zip = new JSZipLib();
      const schools = storage.getSchools();
      const selected = (document.getElementById('school-select')?.value || '').trim();
      const editor = (document.getElementById('mod-text')?.value || '').trim();
      for (const s of schools) {
        let v = storage.getVariant(s);
        if ((!v || !v.trim()) && editor && s === selected) {
          v = editor; // include current editor content for selected school
        }
        if (v && v.trim()) {
          zip.file(`${s}/personal_statement.txt`, v);
        }
      }
      const filesCount = Object.keys(zip.files).length;
      if (!filesCount) { alert('No variants found (save or edit one first).'); return; }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'personal_statements.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showFallbackStatus('Downloaded ZIP of all variants.');
    } catch (err) {
      alert('Failed to build ZIP: ' + (err?.message || String(err)));
    }
  });

  // Optional: Save OpenAI API key
  const saveKeyBtn = document.getElementById('save-openai-key');
  if (saveKeyBtn) {
    saveKeyBtn.addEventListener('click', () => {
      const key = (document.getElementById('openai-key')?.value || '');
      storage.setOpenAIKey(key);
      showOpenAIStatus('API key saved.');
    });
  }

  // Optional: Save prompt template
  const savePromptBtn = document.getElementById('save-prompt');
  if (savePromptBtn) {
    savePromptBtn.addEventListener('click', () => {
      const p = (document.getElementById('prompt-input')?.value || '');
      storage.setPrompt(p);
      showPromptStatus('Prompt saved.');
    });
  }
  const resetPromptBtn = document.getElementById('reset-prompt');
  if (resetPromptBtn) {
    resetPromptBtn.addEventListener('click', () => {
      storage.resetPrompt();
      const promptEl = document.getElementById('prompt-input');
      if (promptEl) promptEl.value = storage.getPrompt(); // will be DEFAULT_PROMPT
      showPromptStatus('Prompt reset to default.');
    });
  }

  // Schools management: research and tags
  const manageSelect = document.getElementById('school-manage-select');
  if (manageSelect) {
    manageSelect.addEventListener('change', () => {
      // Save current research before switching
      const prev = _lastManageSchool;
      const researchEl = document.getElementById('school-research');
      if (prev && researchEl) {
        storage.setSchoolResearch(prev, researchEl.value || '');
      }
      loadManageDetails();
    });
  }
  const saveResearchBtn = document.getElementById('save-research');
  if (saveResearchBtn) {
    saveResearchBtn.addEventListener('click', () => {
      const sel = document.getElementById('school-manage-select');
      const school = sel?.value || '';
      const research = (document.getElementById('school-research')?.value || '');
      if (!school) { alert('Select a school.'); return; }
      storage.setSchoolResearch(school, research);
      const el = document.getElementById('research-status');
      if (el) { el.textContent = 'Research saved.'; setTimeout(()=> el.textContent = '', 1200); }
    });
  }
  // Autosave research on input and blur
  const researchEl = document.getElementById('school-research');
  if (researchEl) {
    const doSave = () => {
      const sel = document.getElementById('school-manage-select');
      const school = sel?.value || '';
      if (!school) return;
      const text = researchEl.value || '';
      storage.setSchoolResearch(school, text);
      const el = document.getElementById('research-status');
      if (el) { el.textContent = 'Autosaved'; setTimeout(()=> el.textContent = '', 800); }
    };
    researchEl.addEventListener('input', () => {
      if (_suppressResearchSave) return;
      if (_researchSaveTimer) clearTimeout(_researchSaveTimer);
      _researchSaveTimer = setTimeout(doSave, 600);
    });
    researchEl.addEventListener('blur', () => {
      if (_suppressResearchSave) return;
      if (_researchSaveTimer) { clearTimeout(_researchSaveTimer); _researchSaveTimer = null; }
      doSave();
    });
  }
  const addTagBtn = document.getElementById('add-tag');
  if (addTagBtn) {
    const addTag = () => {
      const sel = document.getElementById('school-manage-select');
      const school = sel?.value || '';
      const input = document.getElementById('school-tag-input');
      if (!school) { alert('Select a school.'); return; }
      const raw = input?.value || '';
      const parts = raw.split(/[\,\n]/g).map(s => s.trim()).filter(Boolean);
      for (const p of parts) storage.addSchoolTag(school, p);
      input.value = '';
      renderTags();
    };
    addTagBtn.addEventListener('click', addTag);
    const tagInput = document.getElementById('school-tag-input');
    if (tagInput) {
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addTag(); }
      });
    }
  }
  const tagsEl = document.getElementById('school-tags');
  if (tagsEl) {
    tagsEl.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.matches('button[data-tag]')) {
        const tag = t.getAttribute('data-tag') || '';
        const sel = document.getElementById('school-manage-select');
        const school = sel?.value || '';
        if (!school) return;
        storage.removeSchoolTag(school, tag);
        renderTags();
      }
    });
  }
}

function bootstrap() {
  initTabs();
  initTemplate();
  refreshSchoolsUI();
  refreshSchoolSelect();
  refreshManageSelect();
  updateDiff();
  initEvents();
  // Optional: pick up a global key if present
  try {
    if (!storage.getOpenAIKey() && window.OPENAI_API_KEY) {
      storage.setOpenAIKey(String(window.OPENAI_API_KEY));
      const keyEl = document.getElementById('openai-key');
      if (keyEl) keyEl.value = String(window.OPENAI_API_KEY);
    }
  } catch {}
  if (!fsapi.isSupported()) {
    $('#root-path').textContent = 'File System Access API not supported. Use Download/Copy fallback.';
    const choose = document.getElementById('choose-root');
    const commit = document.getElementById('commit-variant');
    if (choose) choose.disabled = true;
    if (commit) commit.disabled = true;
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);

function loadManageDetails() {
  const sel = document.getElementById('school-manage-select');
  const school = sel?.value || '';
  const researchEl = document.getElementById('school-research');
  if (!school || !researchEl) return;
  const meta = storage.getSchoolMeta(school);
  _suppressResearchSave = true;
  researchEl.value = meta.research || '';
  _suppressResearchSave = false;
  _lastManageSchool = school;
  renderTags();
}

function renderTags() {
  const sel = document.getElementById('school-manage-select');
  const school = sel?.value || '';
  const tagsEl = document.getElementById('school-tags');
  if (!tagsEl) return;
  tagsEl.innerHTML = '';
  if (!school) return;
  const meta = storage.getSchoolMeta(school);
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  for (const tag of tags) {
    const span = document.createElement('span');
    span.className = 'tag';
    span.innerHTML = `${tag} <button data-tag="${tag}" title="Remove">×</button>`;
    tagsEl.appendChild(span);
  }
}
