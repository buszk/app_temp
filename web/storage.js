const KEY_TEMPLATE = 'ps_template_v1';
const KEY_SCHOOLS = 'ps_schools_v1';
const KEY_OPENAI = 'ps_openai_key_v1';
const KEY_PROMPT = 'ps_prompt_v1';
const KEY_VARIANTS = 'ps_variants_v1';
const KEY_SCHOOL_META = 'ps_school_meta_v1';

export const DEFAULT_PROMPT = `You are an expert editor helping tailor a medical school personal statement.

Authoritative facts (highest priority):
{{RESEARCH}}

Tags (optional context):
{{TAGS}}

Task: Rewrite the full statement by customizing the paragraph where tag <CUSTOMIZE_TO_SCHOOL> appears. The customized content must:
- Prioritize and strictly follow the applicant-provided research facts above about {{SCHOOL}}. Do not invent programs, statistics, or partnerships.
- If details are insufficient, keep statements generic rather than hallucinating specifics.
- Highlight what makes {{SCHOOL}} unique (mission, programs, values) using only supported facts.
- Explain why the applicant is a strong fit specifically for {{SCHOOL}}.
- Maintain the original tone, voice, and structure as much as possible.
- Do not add more than 50 words.

Input statement:
{{TEMPLATE}}

Output requirements:
- Return only the final, full revised statement as plain text.
- Do not add headers or annotations.`;

export const storage = {
  getTemplate() {
    return localStorage.getItem(KEY_TEMPLATE) || '';
  },
  setTemplate(text) {
    localStorage.setItem(KEY_TEMPLATE, text || '');
  },

  getSchools() {
    try {
      const raw = localStorage.getItem(KEY_SCHOOLS);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) return arr;
      return [];
    } catch {
      return [];
    }
  },
  setSchools(list) {
    localStorage.setItem(KEY_SCHOOLS, JSON.stringify(list || []));
  },
  addSchool(name) {
    const clean = (name || '').trim();
    if (!clean) return;
    const list = this.getSchools();
    if (!list.includes(clean)) {
      list.push(clean);
      this.setSchools(list);
    }
  },
  removeSchool(name) {
    const list = this.getSchools().filter((s) => s !== name);
    this.setSchools(list);
  },

  // OpenAI API key
  getOpenAIKey() {
    return localStorage.getItem(KEY_OPENAI) || '';
  },
  setOpenAIKey(key) {
    localStorage.setItem(KEY_OPENAI, key || '');
  },

  // Prompt template
  getPrompt() {
    const p = localStorage.getItem(KEY_PROMPT);
    return p && p.length ? p : DEFAULT_PROMPT;
  },
  setPrompt(prompt) {
    const val = (prompt || '').trim();
    localStorage.setItem(KEY_PROMPT, val || DEFAULT_PROMPT);
  },
  resetPrompt() {
    try { localStorage.removeItem(KEY_PROMPT); } catch {}
  },

  // Variants storage (school -> text)
  getAllVariants() {
    try {
      const raw = localStorage.getItem(KEY_VARIANTS);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' ? obj : {};
    } catch { return {}; }
  },
  getVariant(school) {
    const all = this.getAllVariants();
    return all[school] || '';
  },
  setVariant(school, text) {
    const all = this.getAllVariants();
    all[school] = text || '';
    localStorage.setItem(KEY_VARIANTS, JSON.stringify(all));
  },
  removeVariant(school) {
    const all = this.getAllVariants();
    delete all[school];
    localStorage.setItem(KEY_VARIANTS, JSON.stringify(all));
  },
  // School metadata (research, tags)
  _getAllMeta() {
    try {
      const raw = localStorage.getItem(KEY_SCHOOL_META);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' ? obj : {};
    } catch { return {}; }
  },
  _setAllMeta(obj) {
    localStorage.setItem(KEY_SCHOOL_META, JSON.stringify(obj || {}));
  },
  getSchoolMeta(school) {
    const all = this._getAllMeta();
    const meta = all[school] || {};
    return {
      research: typeof meta.research === 'string' ? meta.research : '',
      tags: Array.isArray(meta.tags) ? meta.tags : [],
    };
  },
  setSchoolResearch(school, research) {
    const all = this._getAllMeta();
    const meta = all[school] || {};
    meta.research = research || '';
    meta.tags = Array.isArray(meta.tags) ? meta.tags : [];
    all[school] = meta;
    this._setAllMeta(all);
  },
  addSchoolTag(school, tag) {
    const clean = (tag || '').trim();
    if (!clean) return;
    const all = this._getAllMeta();
    const meta = all[school] || { research: '', tags: [] };
    meta.tags = Array.isArray(meta.tags) ? meta.tags : [];
    if (!meta.tags.includes(clean)) meta.tags.push(clean);
    all[school] = meta;
    this._setAllMeta(all);
  },
  removeSchoolTag(school, tag) {
    const all = this._getAllMeta();
    const meta = all[school] || { research: '', tags: [] };
    meta.tags = (Array.isArray(meta.tags) ? meta.tags : []).filter((t) => t !== tag);
    all[school] = meta;
    this._setAllMeta(all);
  },
};
