// Vercel serverless function — free tier.
// Image search via Tavily (TAVILY_API_KEY, already configured). Returns a grid
// of image URLs + short descriptions, plus optional text results. Provider-agnostic
// beyond the single Tavily key.
//
// Body: { query: string, maxResults?: number }
// Returns: { ok, query, images: [{url, description}], results: [{title,url,snippet}] }

const SEARCH_TIMEOUT_MS = 15000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout`)), ms)),
  ]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { query, maxResults } = req.body || {};
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'query required' });
    return;
  }

  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    res.status(200).json({ ok: false, error: 'not_configured' });
    return;
  }

  try {
    const resp = await withTimeout(
      fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: key,
          query,
          max_results: Math.min(Math.max(parseInt(maxResults, 10) || 6, 1), 10),
          include_images: true,
          include_image_descriptions: true,
          include_answer: false,
        }),
      }),
      SEARCH_TIMEOUT_MS,
      'tavily'
    );

    if (!resp.ok) {
      res.status(200).json({ ok: false, error: `tavily_${resp.status}` });
      return;
    }

    const data = await resp.json();
    const images = (data.images || [])
      .map((url, i) => ({ url, description: (data.image_descriptions && data.image_descriptions[i]) || '' }))
      .filter((x) => x.url);
    const results = (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: (r.content || '').slice(0, 300),
    }));

    res.status(200).json({ ok: true, query, images, results });
  } catch (e) {
    res.status(200).json({ ok: false, error: 'search_failed' });
  }
}
