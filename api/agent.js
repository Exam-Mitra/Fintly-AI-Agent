// Vercel serverless function — free tier.
// This is the "Fintly Pro" engine: it queries up to 5 free AI providers in parallel
// (Groq, Gemini, OpenRouter, Cerebras, Hugging Face), then uses one of them as a
// "judge" to synthesize all the independent answers into a single, more accurate,
// polished final response. If some providers are rate-limited, down, or slow, it
// proceeds with whichever ones responded in time — it never fully fails as long as
// at least one provider works.
//
// Required environment variables (set these in Vercel -> Project Settings -> Environment Variables):
//   GROQ_API_KEY
//   GEMINI_API_KEY
//   OPENROUTER_API_KEY
//   CEREBRAS_API_KEY
//   HUGGINGFACE_API_KEY

const SYSTEM_PROMPT = `You are a helpful, accurate, knowledgeable assistant. Answer clearly and correctly. Keep responses focused and well-organized. If asked for code, provide complete, working code.`;

const PROVIDER_TIMEOUT_MS = 20000; // don't let one slow provider hold up the whole response forever

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout`)), ms)),
  ]);
}

async function callGroq(messages) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('not_configured');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages,
      temperature: 0.7,
      max_tokens: 900,
      reasoning_effort: 'low',
    }),
  });
  if (!res.ok) throw new Error(`groq_${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('groq_empty');
  return text;
}

async function callGemini(messages) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('not_configured');
  const sys = messages.find((m) => m.role === 'system');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const body = { contents };
  if (sys) body.systemInstruction = { parts: [{ text: sys.content }] };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`gemini_${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('gemini_empty');
  return text;
}

async function callOpenRouter(messages) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('not_configured');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      messages,
      max_tokens: 900,
    }),
  });
  if (!res.ok) throw new Error(`openrouter_${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('openrouter_empty');
  return text;
}

async function callCerebras(messages) {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) throw new Error('not_configured');
  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-oss-120b',
      messages,
      max_tokens: 900,
    }),
  });
  if (!res.ok) throw new Error(`cerebras_${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('cerebras_empty');
  return text;
}

async function callHuggingFace(messages) {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error('not_configured');
  const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'meta-llama/Llama-3.1-8B-Instruct:fastest',
      messages,
      max_tokens: 600,
    }),
  });
  if (!res.ok) throw new Error(`hf_${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('hf_empty');
  return text;
}

// Synthesizes multiple independent AI answers into one polished final answer.
// Uses Gemini as the judge (fast, generous free quota, good synthesis quality).
// If Gemini is unavailable, falls back to Groq as judge, then to just returning
// the single best candidate answer if no judge model is reachable at all.
async function synthesize(userQuestion, candidateAnswers) {
  const judgePrompt = `You are Fintly Pro, an AI that synthesizes multiple independent AI-generated answers into one single, best, accurate, well-written final answer for the user.

Below are ${candidateAnswers.length} independent AI-generated answers to the same user question. They may vary in completeness, phrasing, or occasionally disagree on details.

User question: "${userQuestion}"

${candidateAnswers.map((a, i) => `--- Answer ${i + 1} ---\n${a}`).join('\n\n')}

Your task: Write ONE final, synthesized answer that combines the best, most accurate, most complete information from all the answers above. Do not mention that you are combining multiple answers, and do not say things like "Answer 1 says" — just give a single clean, confident, well-written final answer as if you knew this yourself. If the answers disagree on facts, use your own best judgment for what is most likely correct. Preserve any code blocks exactly and correctly formatted.`;

  const judgeMessages = [{ role: 'user', content: judgePrompt }];

  try {
    return await withTimeout(callGemini(judgeMessages), PROVIDER_TIMEOUT_MS, 'judge_gemini');
  } catch {
    try {
      return await withTimeout(callGroq(judgeMessages), PROVIDER_TIMEOUT_MS, 'judge_groq');
    } catch {
      // No judge model reachable — fall back to the first candidate answer as-is.
      return candidateAnswers[0];
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    res.status(400).json({ error: 'messages array required' });
    return;
  }

  // Keep the payload reasonably small — send only recent turns to each provider.
  const trimmedHistory = messages.slice(-16);
  const fullMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...trimmedHistory];
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  const providerCalls = [
    { name: 'groq', fn: () => callGroq(fullMessages) },
    { name: 'gemini', fn: () => callGemini(fullMessages) },
    { name: 'openrouter', fn: () => callOpenRouter(fullMessages) },
    { name: 'cerebras', fn: () => callCerebras(fullMessages) },
    { name: 'huggingface', fn: () => callHuggingFace(fullMessages) },
  ];

  const settled = await Promise.allSettled(
    providerCalls.map((p) => withTimeout(p.fn(), PROVIDER_TIMEOUT_MS, p.name))
  );
  const successfulAnswers = settled
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);

  if (successfulAnswers.length === 0) {
    res.status(200).json({
      reply: "I'm having trouble reaching any of my AI models right now. Please try again in a moment.",
      modelsUsed: 0,
    });
    return;
  }

  // If only one model responded, no need to synthesize — just return it directly.
  if (successfulAnswers.length === 1) {
    res.status(200).json({ reply: successfulAnswers[0], modelsUsed: 1 });
    return;
  }

  try {
    const merged = await synthesize(lastUserMessage, successfulAnswers);
    res.status(200).json({ reply: merged, modelsUsed: successfulAnswers.length });
  } catch (err) {
    // Synthesis itself failed for some reason — fall back to the first successful answer.
    res.status(200).json({ reply: successfulAnswers[0], modelsUsed: successfulAnswers.length });
  }
}
