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
    .replaceAll('{{TEMPLATE}}', values.template || '');
}

// Pluggable LLM adapter. Tries OpenAI if configured, otherwise local transform.
export const llm = {
  async generate(template, school) {
    const key = storage.getOpenAIKey();
    const promptTpl = storage.getPrompt();
    const schoolName = (school || '').trim();

    // If no key, fallback to deterministic local replacement
    if (!key) {
      return template.replaceAll('<CUSTOMIZE_TO_SCHOOL>', schoolName);
    }

    // Build prompt
    const userPrompt = fillPrompt(promptTpl, { template, school: schoolName });
    try {
      const model = 'gpt-4o-mini';
      const output = await openaiChat({
        apiKey: key,
        model,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      });
      return output || template.replaceAll('<CUSTOMIZE_TO_SCHOOL>', schoolName);
    } catch (err) {
      console.warn('OpenAI call failed, falling back to local transform:', err);
      return template.replaceAll('<CUSTOMIZE_TO_SCHOOL>', schoolName);
    }
  },
};
