import { SYSTEM_PROMPT } from './prompt.js';

/**
 * @param {Array<{role: string, content: string}>} history
 * @returns {Promise<{need_clarification?: string, services?: Array<{name: string, qty: number, unit: string}>}>}
 */
export async function askLLM(history) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? '';

  // Strip possible markdown code fences
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  return JSON.parse(cleaned);
}
