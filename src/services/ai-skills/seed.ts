import { postJson, HttpOptions } from './http';

//export const SEED_MODEL = 'ep-20251201112513-srd7n';
export const SEED_MODEL = 'doubao-seed-1-6-flash-250828';
function toContentText(content: any) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(p => p && p.type === 'text' ? p.text : '').join('');
  return '';
}

export interface SeedImageToTextOptions extends HttpOptions {
  image_url: string;
  question?: string;
}

export async function imageToText(options: SeedImageToTextOptions) {
  const { image_url, question, apiKey } = options || {};
  const body = {
    model: SEED_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: image_url } },
          { type: 'text', text: question || '' }
        ]
      }
    ]
  };
  const json = await postJson('/chat/completions', body, {}, { apiKey });
  const c = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  const text = toContentText(c);
  return { text, json };
}

export interface SeedTextToTextOptions extends HttpOptions {
  input: string;
  system?: string;
  temperature?: number;
  max_tokens?: number;
}

export async function textToText(options: SeedTextToTextOptions) {
  const { input, system, temperature, max_tokens = 32000, apiKey } = options || {};
  const messages = [];
  const thinking={
         type:"disabled"
     }
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: input });
  const body = {
    model: SEED_MODEL,
    messages,
    temperature,
    max_tokens,
    thinking: thinking
  };
  const json = await postJson('/chat/completions', body, {}, { apiKey });
  const c = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  const text = toContentText(c);
  return { text, json };
}
