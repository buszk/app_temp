import { storage, DEFAULT_PROMPT } from './storage.js';
import { fsapi } from './fs.js';
import { llm } from './llm.js';
import { computeDiff, renderDiff } from './diff.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

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
  const result = await llm.generate(tmpl, school);
  const text = typeof result === 'string' ? result : result.text;
  const used = typeof result === 'object' && result.usedOpenAI;
  const err = typeof result === 'object' && result.error;
  $('#mod-text').value = text || '';
  if (err) {
    alert(`OpenAI error: ${err}`);
  }
  const genStatus = document.getElementById('gen-status');
  if (genStatus) {
    if (used) genStatus.textContent = 'Generated with OpenAI';
    else genStatus.textContent = err ? 'Fell back (OpenAI error)' : 'Generated locally';
    setTimeout(()=> genStatus.textContent = '', 1600);
  }
  updateDiff();
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
  const content = $('#mod-text').value || '';
  if (!confirm(`Commit variant for "${school}" to disk?\nPlease review the diff before confirming.`)) return;
  try {
    await fsapi.writeVariant(school, content);
    storage.setVariant(school, content);
    showCommitStatus('Committed to folder.');
  } catch (e) {
    alert(e.message || String(e));
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

  $('#add-school').addEventListener('click', () => {
    const name = $('#school-name').value;
    storage.addSchool(name);
    $('#school-name').value = '';
    refreshSchoolsUI();
    refreshSchoolSelect();
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
    const content = $('#mod-text').value || '';
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
    try {
      await navigator.clipboard.writeText($('#mod-text').value || '');
      showFallbackStatus('Copied to clipboard.');
    } catch (e) {
      alert('Copy failed: ' + (e.message || String(e)));
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
    manageSelect.addEventListener('change', loadManageDetails);
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
  researchEl.value = meta.research || '';
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
