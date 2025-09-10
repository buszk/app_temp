const KEY_TEMPLATE = 'ps_template_v1';
const KEY_SCHOOLS = 'ps_schools_v1';

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
};

