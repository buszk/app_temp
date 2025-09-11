import { storage } from './storage.js';

async function openaiChat({ apiKey, model, messages }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  return (content || '').trim();
}

function fillPrompt(tpl, values) {
  return tpl
    .replaceAll('{{SCHOOL}}', values.school || '')
    .replaceAll('{{TEMPLATE}}', values.template || '')
    .replaceAll('{{RESEARCH}}', values.research || '')
    .replaceAll('{{TAGS}}', values.tags || '');
}

// Pluggable LLM adapter. Tries OpenAI if configured, otherwise local transform.
export const llm = {
  // Returns { text, usedOpenAI, error }
  async generate(template, school) {
    const key = storage.getOpenAIKey();
    const promptTpl = storage.getPrompt();
    const schoolName = (school || '').trim();
    const meta = storage.getSchoolMeta(schoolName);
    const tagsStr = (meta.tags || []).join(', ');

    const localText = template.replaceAll('<CUSTOMIZE_TO_SCHOOL>', schoolName);
    if (!key) {
      return { text: localText, usedOpenAI: false };
    }

    const userPrompt = fillPrompt(promptTpl, {
      template,
      school: schoolName,
      research: meta.research || '',
      tags: tagsStr,
    });
    try {
      const model = 'gpt-4o-mini';
      const output = await openaiChat({
        apiKey: key,
        model,
        messages: [ { role: 'user', content: userPrompt } ],
      });
      const text = output || localText;
      return { text, usedOpenAI: Boolean(output && output.length) };
    } catch (err) {
      console.warn('OpenAI call failed, falling back to local transform:', err);
      return { text: localText, usedOpenAI: false, error: err?.message || String(err) };
    }
  },
};
