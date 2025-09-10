// Pluggable LLM adapter. Default local transform for MVP.
export const llm = {
  async generate(template, school) {
    // Simple deterministic placeholder replacement as default behavior
    const name = (school || '').trim();
    const out = template.replaceAll('<CUSTOMIZE_TO_SCHOOL>', name);
    return out;
  },
};

