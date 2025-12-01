const BASE_URL = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_API_KEY = process.env.ARK_API_KEY;

export interface HttpOptions {
  apiKey?: string;
}

export async function postJson(path: string, payload: any, extraHeaders: any = {}, options?: HttpOptions) {
  const apiKey = (options && options.apiKey) || DEFAULT_API_KEY;
  if (!apiKey) throw new Error('ARK_API_KEY not set');
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: Object.assign({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }, extraHeaders || {}),
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text);
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
export { BASE_URL };
