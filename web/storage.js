const KEY_TEMPLATE = 'ps_template_v1';
const KEY_SCHOOLS = 'ps_schools_v1';
const KEY_OPENAI = 'ps_openai_key_v1';
const KEY_PROMPT = 'ps_prompt_v1';
const KEY_VARIANTS = 'ps_variants_v1';

export const DEFAULT_PROMPT = `You are an expert editor helping tailor a medical school personal statement.

Task: Rewrite the full statement by integrating a compelling, school-specific paragraph where the tag <CUSTOMIZE_TO_SCHOOL> appears. The customized content should:
- Highlight what makes {{SCHOOL}} unique (programs, mission, location, values).
- Explain why the applicant is a strong fit specifically for {{SCHOOL}}.
- Maintain the original tone, voice, and structure as much as possible.

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
};
