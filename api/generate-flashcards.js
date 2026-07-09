// Vercel serverless function — free tier. Converts any block of text (an
// existing Fintly Pro answer) into a set of Q&A flashcards. Deliberately
// uses a SINGLE fast free model (Groq) rather than the full 5-engine +
// judge pipeline used for normal chat — flashcard generation is a simple,
// mechanical transformation task where one good model is plenty, and
// keeping it to one call keeps this fast and avoids burning through all 5
// providers' free-tier quotas for a lightweight secondary feature.
//
// Required environment variable (already set for the main chat feature):
//   GROQ_API_KEY

const MAX_SOURCE_CHARS = 6000;

async function callGroq(messages) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('not_configured');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages,
      temperature: 0.4,
      max_tokens: 1200,
      reasoning_effort: 'low',
    }),
  });
  if (!res.ok) throw new Error(`groq_${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('groq_empty');
  return text;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { sourceText, count } = req.body || {};
  if (!sourceText || typeof sourceText !== 'string') {
    res.status(400).json({ error: 'sourceText required' });
    return;
  }

  const cardCount = Math.min(Math.max(parseInt(count, 10) || 8, 3), 15);
  const trimmedSource = sourceText.slice(0, MAX_SOURCE_CHARS);

  const prompt = `Turn the following study material into exactly ${cardCount} flashcards for exam revision. Each flashcard tests ONE clear fact, concept, or definition from the text — mix definition-recall, short-answer, and "fill in the key term" style questions where appropriate.

Reply using EXACTLY this format for every card, with a blank line between cards, and nothing else before, after, or in between (no numbering, no headers, no extra commentary):

Q: <question here>
A: <answer here>

Q: <next question>
A: <next answer>

Study material:
"""
${trimmedSource}
"""`;

  try {
    const text = await callGroq([{ role: 'user', content: prompt }]);
    res.status(200).json({ text });
  } catch (err) {
    res.status(200).json({ error: 'generation_failed' });
  }
}
