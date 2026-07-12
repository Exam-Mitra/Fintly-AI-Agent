// Client-side helpers for the new tool endpoints (image generation, TTS,
// document generation, web-page fetch). All API keys stay server-side in the
// Vercel functions; these helpers just POST to them and return parsed JSON.

export async function generateImage({ prompt, aspectRatio, editBase64, editMime, signal }) {
  const res = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspectRatio, editBase64, editMime }),
    signal,
  });
  if (!res.ok) throw new Error('image_request_failed');
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'image_generation_failed');
  return data; // { imageBase64, mimeType }
}

export async function synthesizeSpeech({ text, lang, signal }) {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang }),
    signal,
  });
  if (!res.ok) throw new Error('tts_request_failed');
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'tts_failed');
  return data; // { audioBase64, mimeType }
}

export async function generateDocument({ type, title, content, signal }) {
  const res = await fetch('/api/docgen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, title, content }),
    signal,
  });
  if (!res.ok) throw new Error('docgen_request_failed');
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'docgen_failed');
  return data; // { fileBase64, mimeType, filename }
}

export async function fetchWebPage({ url, signal }) {
  const res = await fetch('/api/webfetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal,
  });
  if (!res.ok) throw new Error('webfetch_request_failed');
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'webfetch_failed');
  return data; // { url, title, text, charCount }
}

// Trigger a browser download from a base64 payload.
export function downloadBase64File(base64, mimeType, filename) {
  const link = document.createElement('a');
  link.href = `data:${mimeType};base64,${base64}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Rough language detection for TTS voice selection.
export function detectLang(text) {
  return /[ऀ-ॿ]/.test(text || '') ? 'hi' : 'en';
}

export async function searchImages({ query, signal }) {
  const res = await fetch('/api/imagesearch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!res.ok) throw new Error('imagesearch_request_failed');
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'imagesearch_failed');
  return data; // { query, images: [{url, description}], results: [{title,url,snippet}] }
}

export async function runCode({ code, language, signal }) {
  const res = await fetch('/api/codeexec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language }),
    signal,
  });
  if (!res.ok) throw new Error('codeexec_request_failed');
  const data = await res.json();
  if (!data.ok) {
    const err = new Error(data.error || 'codeexec_failed');
    err.note = data.note;
    throw err;
  }
  return data; // { logs, result, error? }
}
