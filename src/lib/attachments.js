// Client-side helpers for the file/image attach feature. Keeps things simple
// and free: images go to Gemini's vision endpoint (the only one of our 5 free
// engines that supports vision), plain text-based files (code, notes, CSV,
// markdown, etc.) get their text content folded directly into the prompt so
// every engine can use them normally, and PDFs get their text extracted +
// chunked client-side (see lib/pdfChat.js) so a user can "chat with" a whole
// document without ever exceeding our free providers' request-size limits.
//
// pdfChat.js is imported statically (not dynamically) — Chat.jsx also
// imports it directly for chunk re-selection on every follow-up question,
// so a dynamic import here would be a no-op anyway (a module can only be
// split into its own lazy-loaded chunk if EVERY importer treats it as
// dynamic).
import { extractPdfText, chunkText } from './pdfChat.js';

export const MAX_TEXT_CHARS = 8000; // keep prompt payload sane across all 5 providers

// Vercel's free-tier serverless functions reject request bodies over ~4.5MB.
// Base64 encoding inflates raw bytes by ~33%, so we resize/recompress every
// attached photo down to a safe target before sending — this also makes
// uploads much faster on mobile data, with no visible quality loss for what
// the AI needs to read/understand an image.
const MAX_IMAGE_DIMENSION = 1600; // px, long edge
const IMAGE_JPEG_QUALITY = 0.82;
const MAX_ENCODED_IMAGE_BYTES = 3 * 1024 * 1024; // raw bytes ceiling after compression, well under Vercel's limit once base64-encoded

const TEXT_EXTENSIONS = [
  '.txt', '.md', '.markdown', '.csv', '.json', '.js', '.jsx', '.ts', '.tsx',
  '.py', '.html', '.css', '.java', '.c', '.cpp', '.cs', '.go', '.rb', '.php',
  '.sql', '.yml', '.yaml', '.log',
];

export function isImageFile(file) {
  return file.type.startsWith('image/');
}

export function isSupportedTextFile(file) {
  const lower = file.name.toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext)) || file.type === 'text/plain';
}

export function isPdfFile(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image file.'));
    img.src = dataUrl;
  });
}

// Resizes the image (if needed) to fit within MAX_IMAGE_DIMENSION on its
// longest side, then re-encodes as JPEG at IMAGE_JPEG_QUALITY. Returns a
// { dataUrl, base64, mimeType } result that is always safely small enough
// to send in a single Vercel serverless request.
async function compressImage(file) {
  const originalDataUrl = await readAsDataURL(file);
  const img = await loadImageElement(originalDataUrl);

  let { width, height } = img;
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const compressedDataUrl = canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY);
  const base64 = compressedDataUrl.split(',')[1] || '';

  return { dataUrl: compressedDataUrl, base64, mimeType: 'image/jpeg' };
}

// Returns a normalized attachment object, or throws a user-facing Error
// message if the file can't be handled (too big / unsupported type).
export async function processAttachedFile(file) {
  if (isPdfFile(file)) {
    const { text, pageCount } = await extractPdfText(file);
    return {
      kind: 'pdf',
      name: file.name,
      pageCount,
      fullText: text,
      chunks: chunkText(text),
    };
  }

  if (isImageFile(file)) {
    const { dataUrl, base64, mimeType } = await compressImage(file);
    // Rough estimate of decoded byte size from a base64 string length.
    const approxBytes = Math.ceil((base64.length * 3) / 4);
    if (approxBytes > MAX_ENCODED_IMAGE_BYTES) {
      throw new Error('That image is too large even after compression — please try a smaller photo.');
    }
    return {
      kind: 'image',
      name: file.name,
      mimeType,
      dataBase64: base64,
      previewUrl: dataUrl,
    };
  }

  if (isSupportedTextFile(file)) {
    const raw = await readAsText(file);
    const truncated = raw.length > MAX_TEXT_CHARS ? raw.slice(0, MAX_TEXT_CHARS) + '\n\n[...truncated...]' : raw;
    return {
      kind: 'text',
      name: file.name,
      content: truncated,
    };
  }

  throw new Error('That file type isn\'t supported yet. Try an image (jpg/png) or a text-based file (.txt, .md, .csv, code files, etc).');
}
