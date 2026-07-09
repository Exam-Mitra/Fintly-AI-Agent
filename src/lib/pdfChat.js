import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// "Chat with a PDF" — fully free, runs entirely in the browser (no server
// round-trip, no paid embeddings API). We extract the PDF's text, split it
// into overlapping chunks, and for every question the user asks, pick the
// handful of chunks that share the most words with that question (simple
// TF keyword overlap — no vector database needed) and fold just those into
// the prompt sent to Fintly Pro. This lets a user "chat with" a 20+ page
// PDF without ever exceeding what our free AI providers can accept in one
// request, and without the AI needing the ENTIRE document re-sent on every
// single follow-up question.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export const MAX_PDF_PAGES = 60; // generous for study notes/assignments, keeps extraction fast on a phone
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
const MAX_CONTEXT_CHUNKS = 5;

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of', 'and', 'or', 'in',
  'on', 'for', 'with', 'this', 'that', 'it', 'as', 'at', 'by', 'from', 'what', 'how', 'why',
  'when', 'where', 'who', 'which', 'do', 'does', 'can', 'you', 'me', 'my', 'i', 'please',
  'explain', 'tell', 'about',
]);

// Extracts all readable text from a PDF File object, page by page. Throws a
// user-facing Error if the PDF is empty, too long, or unreadable (e.g. a
// scanned image-only PDF with no selectable text layer — those would need
// OCR, which we don't do here, so we surface a clear message instead of
// silently returning nothing).
export async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new Error(`That PDF has ${pdf.numPages} pages — please use one under ${MAX_PDF_PAGES} pages for now.`);
  }

  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    fullText += `\n\n[Page ${pageNum}]\n${pageText}`;
  }

  const trimmed = fullText.trim();
  if (!trimmed) {
    throw new Error("Couldn't find any readable text in that PDF — it might be a scanned/image-only document.");
  }

  return { text: trimmed, pageCount: pdf.numPages };
}

// Splits the extracted text into overlapping chunks so a relevant passage
// that happens to straddle a chunk boundary isn't lost.
export function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

function tokenize(str) {
  return (str.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

// Scores every chunk by how many of the question's meaningful words it
// contains, and returns the top N chunks joined into one context block. If
// scoring finds nothing relevant at all (score 0 everywhere — e.g. a vague
// question like "explain this"), falls back to the first few chunks so the
// AI still has SOME grounding rather than none.
export function selectRelevantChunks(chunks, question) {
  const queryWords = tokenize(question);
  if (!queryWords.length || !chunks.length) return chunks.slice(0, MAX_CONTEXT_CHUNKS);

  const scored = chunks.map((chunk, index) => {
    const chunkWords = tokenize(chunk);
    const wordSet = new Set(chunkWords);
    const score = queryWords.reduce((sum, w) => sum + (wordSet.has(w) ? 1 : 0), 0);
    return { index, chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, MAX_CONTEXT_CHUNKS).filter((s) => s.score > 0);

  if (!top.length) return chunks.slice(0, MAX_CONTEXT_CHUNKS);

  // Restore original document order among the selected chunks so the
  // context reads naturally instead of jumbled by relevance score.
  return top.sort((a, b) => a.index - b.index).map((s) => s.chunk);
}

export function buildPdfContext(fileName, relevantChunks) {
  return `The user has attached a PDF document called "${fileName}" and is asking a question about it. Here are the most relevant excerpts from that document:\n\n${relevantChunks.join('\n\n---\n\n')}\n\nAnswer the user's question using only the information in these excerpts where relevant. If the excerpts don't contain enough information to answer confidently, say so honestly rather than guessing.`;
}
