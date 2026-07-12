// Vercel serverless function — free tier.
// Fetches a public web page server-side and returns cleaned text so Fintly
// Pro can read full articles/pages (not just Tavily snippets). Provider-agnostic;
// no API key required. Respects only http(s) and a strict size/timeout budget.
//
// Body: { url: string, maxChars?: number }
// Returns: { ok, url, title, text, charCount } or { ok:false, error }

const FETCH_TIMEOUT_MS = 15000;
const MAX_OUTPUT_CHARS = 20000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout`)), ms)),
  ]);
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—');
}

function stripHtml(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : '';
  text = text.replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text);
  text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return { title, text };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url, maxChars } = req.body || {};
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'url required' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: 'invalid url' });
    return;
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    res.status(400).json({ error: 'only http(s) allowed' });
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const resp = await withTimeout(
      fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FintlyBot/1.0)' },
        signal: controller.signal,
      }),
      FETCH_TIMEOUT_MS,
      'fetch'
    );
    clearTimeout(timer);

    if (!resp.ok) {
      res.status(200).json({ ok: false, error: `status_${resp.status}` });
      return;
    }

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      res.status(200).json({ ok: false, error: 'not_an_html_page' });
      return;
    }

    const html = await resp.text();
    const { title, text } = stripHtml(html);
    const limit = Math.min(Math.max(parseInt(maxChars, 10) || 12000, 1000), MAX_OUTPUT_CHARS);
    const clipped = text.length > limit ? text.slice(0, limit) + '\n\n[…truncated…]' : text;

    res.status(200).json({ ok: true, url, title, text: clipped, charCount: text.length });
  } catch (e) {
    res.status(200).json({ ok: false, error: 'fetch_failed' });
  }
}
