import { postJson, HttpOptions } from './http';

export const SEEDREAM_MODEL = 'ep-20251201112706-xp42j';

export interface SeedreamOptions extends HttpOptions {
  prompt: string;
  size?: string;
  response_format?: string;
  seed?: number;
  guidance_scale?: number;
  watermark?: boolean;
  n?: number;
  image?: string; // for imageToImage
}

export async function textToImage(options: SeedreamOptions) {
  const { prompt, size, response_format = 'url', seed, guidance_scale, watermark = false, n, apiKey } = options || {};
  const body = {
    model: SEEDREAM_MODEL,
    prompt,
    response_format,
    size,
    seed,
    guidance_scale,
    watermark,
    n
  };
  const json = await postJson('/images/generations', body, {}, { apiKey });
  const data = json.data || [];
  const urls = data.map((x: any) => x.url).filter(Boolean);
  const b64 = data.map((x: any) => x.b64_json).filter(Boolean);
  return { urls, b64, data, json };
}

export async function imageToImage(options: SeedreamOptions) {
  const { image, prompt, size, response_format = 'url', seed, guidance_scale, watermark = false, n, apiKey } = options || {};
  const body = {
    model: SEEDREAM_MODEL,
    prompt,
    response_format,
    size,
    seed,
    guidance_scale,
    watermark,
    image,
    n
  };
  const json = await postJson('/images/edits', body, {}, { apiKey });
  const data = json.data || [];
  const urls = data.map((x: any) => x.url).filter(Boolean);
  const b64 = data.map((x: any) => x.b64_json).filter(Boolean);
  return { urls, b64, data, json };
}
