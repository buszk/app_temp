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
  const out = await llm.generate(tmpl, school);
  $('#mod-text').value = out;
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
}

function bootstrap() {
  initTabs();
  initTemplate();
  refreshSchoolsUI();
  refreshSchoolSelect();
  updateDiff();
  initEvents();
  if (!fsapi.isSupported()) $('#root-path').textContent = 'File System Access API not supported in this browser. Use a Chromium browser over http(s).';
}

document.addEventListener('DOMContentLoaded', bootstrap);
