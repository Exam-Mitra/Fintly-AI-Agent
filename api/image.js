// Vercel serverless function — free tier.
// Image generation + image editing/restyle via Google Gemini (GEMINI_API_KEY,
// already configured for vision + the judge). No new API key required.
//
// Generation uses Imagen 3 with a Gemini flash image model as fallback.
// Editing uses the Gemini flash image model with an input image + instruction.
//
// Body (generate):  { prompt: string, aspectRatio?: '1:1'|'3:4'|'4:3'|'16:9'|'9:16' }
// Body (edit):      { prompt: string, editBase64: string, editMime: string }
// Returns: { ok, imageBase64, mimeType } or { ok:false, error }

const IMAGE_TIMEOUT_MS = 25000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout`)), ms)),
  ]);
}

async function generateWithImagen(prompt, aspectRatio) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('not_configured');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: aspectRatio || '1:1', safetySetting: 'block_only_high' },
      }),
    }
  );
  if (!res.ok) throw new Error(`imagen_${res.status}`);
  const data = await res.json();
  const pred = data?.predictions?.[0];
  const b64 = pred?.bytesBase64Encoded;
  if (!b64) throw new Error('imagen_empty');
  return { imageBase64: b64, mimeType: pred?.mimeType || 'image/png' };
}

async function generateWithGeminiFlash(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('not_configured');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    }
  );
  if (!res.ok) throw new Error(`geminiimg_${res.status}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData);
  if (!img?.inlineData?.data) throw new Error('geminiimg_empty');
  return { imageBase64: img.inlineData.data, mimeType: img.inlineData.mimeType || 'image/png' };
}

async function editWithGeminiFlash(prompt, editBase64, editMime) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('not_configured');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType: editMime, data: editBase64 } },
            ],
          },
        ],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    }
  );
  if (!res.ok) throw new Error(`gemini_edit_${res.status}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData);
  if (!img?.inlineData?.data) throw new Error('gemini_edit_empty');
  return { imageBase64: img.inlineData.data, mimeType: img.inlineData.mimeType || 'image/png' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { prompt, aspectRatio, editBase64, editMime } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'prompt required' });
    return;
  }
  const safePrompt = prompt.slice(0, 1500);

  try {
    let result;
    if (editBase64 && editMime) {
      result = await withTimeout(
        editWithGeminiFlash(safePrompt, editBase64, editMime),
        IMAGE_TIMEOUT_MS,
        'gemini_edit'
      );
    } else {
      try {
        result = await withTimeout(generateWithImagen(safePrompt, aspectRatio), IMAGE_TIMEOUT_MS, 'imagen');
      } catch {
        result = await withTimeout(generateWithGeminiFlash(safePrompt), IMAGE_TIMEOUT_MS, 'geminiimg');
      }
    }
    res.status(200).json({ ok: true, ...result });
  } catch (e) {
    res.status(200).json({ ok: false, error: e.message || 'image_generation_failed' });
  }
}
