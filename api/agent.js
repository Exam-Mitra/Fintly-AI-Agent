// Vercel serverless function — free tier.
// This is the "Fintly Pro" engine: it queries up to 5 free AI providers in parallel,
// then uses one of them as a "judge" to synthesize all the independent answers into
// a single, more accurate, polished final response. If some providers are
// rate-limited, down, or slow, it proceeds with whichever ones responded in time —
// it never fully fails as long as at least one provider works.
//
// It also reports back ANONYMIZED timing/engine metadata (never real provider names —
// just "Engine 1", "Engine 2", etc.) so the client can show a transparency panel like
// "Fintly Pro consulted 5 engines, 4 responded, in 12.3s" without ever leaking which
// underlying AI companies are actually powering it.
//
// Required environment variables (set these in Vercel -> Project Settings -> Environment Variables):
//   GROQ_API_KEY
//   GEMINI_API_KEY
//   OPENROUTER_API_KEY
//   CEREBRAS_API_KEY
//   HUGGINGFACE_API_KEY

const BASE_SYSTEM_PROMPT = `You are a helpful, accurate, knowledgeable assistant. Answer clearly and correctly. Keep responses focused and well-organized. Format your response in clean Markdown (use **bold**, headings, and bullet lists where helpful). If asked for code, provide complete, working code in a fenced code block with the correct language tag (e.g. \`\`\`python). Never wrap plain code identifiers, object attributes, or method calls (like iris.data, user.name, or object.method()) in markdown link syntax — they are not URLs. Only use [text](url) formatting for real, actual web links.`;

// Builds the final system prompt by folding in the user's saved Custom
// Instructions and remembered facts (from Settings), so every one of the 5
// engines + the judge all respect them consistently.
function buildSystemPrompt(customInstructions, memories) {
  let prompt = BASE_SYSTEM_PROMPT;

  if (Array.isArray(memories) && memories.length) {
    prompt += `\n\nHere are some facts the user has asked you to remember about them, across all their chats — keep these in mind when relevant, but don't force them into every answer unnaturally:\n${memories.map((m) => `- ${m}`).join('\n')}`;
  }

  if (customInstructions && customInstructions.trim()) {
    prompt += `\n\nThe user has also given these custom instructions for how you should behave — follow them closely unless they conflict with being safe, accurate, or helpful:\n"""${customInstructions.trim()}"""`;
  }

  return prompt;
}

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

// Vision-capable variant of callGemini — attaches an inline image to the LAST
// user turn (the one carrying the actual question about the image), while
// keeping the rest of the conversation as normal text turns for context.
// Gemini is the only one of our 5 free engines with a usable free vision tier,
// so image questions are answered by this single call rather than the usual
// 5-engine + judge pipeline.
async function callGeminiVision(messages, attachment) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('not_configured');
  const sys = messages.find((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  const contents = nonSystem.map((m, i) => {
    const isLastUserTurn = i === nonSystem.length - 1 && m.role === 'user';
    const parts = [{ text: m.content }];
    if (isLastUserTurn) {
      parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.dataBase64 } });
    }
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });

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
  if (!res.ok) throw new Error(`gemini_vision_${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('gemini_vision_empty');
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

Your task: Write ONE final, synthesized answer that combines the best, most accurate, most complete information from all the answers above. Do not mention that you are combining multiple answers, and do not say things like "Answer 1 says" — just give a single clean, confident, well-written final answer as if you knew this yourself. If the answers disagree on facts, use your own best judgment for what is most likely correct.

Formatting rules (important):
- Format your response in clean Markdown (headings, **bold**, bullet lists where helpful).
- Preserve any code blocks exactly, correctly formatted with fenced code blocks and a language tag (e.g. \`\`\`python).
- Never wrap plain code identifiers, object attributes, or method calls (like iris.data, user.name, or object.method()) in markdown link syntax [text](url) — they are not URLs and must stay as plain code text. Only use real link formatting for actual web URLs.`;

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

  const { messages, customInstructions, memories, imageAttachment } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    res.status(400).json({ error: 'messages array required' });
    return;
  }

  const overallStart = Date.now();

  // Keep the payload reasonably small — send only recent turns to each provider.
  const trimmedHistory = messages.slice(-16);
  const systemPrompt = buildSystemPrompt(customInstructions, memories);
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...trimmedHistory];
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  // An image was attached — only Gemini (of our 5 free engines) has a usable
  // free vision tier, so we skip the usual 5-engine + judge pipeline entirely
  // and answer directly with a single vision-capable call.
  if (imageAttachment && imageAttachment.dataBase64) {
    try {
      const reply = await withTimeout(
        callGeminiVision(fullMessages, imageAttachment),
        PROVIDER_TIMEOUT_MS,
        'gemini_vision'
      );
      res.status(200).json({
        reply,
        modelsUsed: 1,
        totalEngines: 1,
        elapsedMs: Date.now() - overallStart,
        engineTimings: [{ id: 1, ok: true, ms: Date.now() - overallStart }],
      });
    } catch (err) {
      res.status(200).json({
        reply: "I couldn't analyze that image right now — please try again in a moment.",
        modelsUsed: 0,
        totalEngines: 1,
        elapsedMs: Date.now() - overallStart,
        engineTimings: [{ id: 1, ok: false, ms: Date.now() - overallStart }],
      });
    }
    return;
  }

  // NOTE: providers are only ever identified by anonymous index (1..5) anywhere
  // this data leaves the server — real provider names must never reach the client.
  const providerCalls = [
    () => callGroq(fullMessages),
    () => callGemini(fullMessages),
    () => callOpenRouter(fullMessages),
    () => callCerebras(fullMessages),
    () => callHuggingFace(fullMessages),
  ];

  const results = await Promise.all(
    providerCalls.map((fn) => {
      const start = Date.now();
      return withTimeout(fn(), PROVIDER_TIMEOUT_MS, 'provider').then(
        (value) => ({ ok: true, ms: Date.now() - start, value }),
        () => ({ ok: false, ms: Date.now() - start })
      );
    })
  );

  const successfulAnswers = results.filter((r) => r.ok).map((r) => r.value);
  const engineTimings = results.map((r, i) => ({ id: i + 1, ok: r.ok, ms: r.ms }));

  if (successfulAnswers.length === 0) {
    res.status(200).json({
      reply: "I'm having trouble reaching any of my AI engines right now. Please try again in a moment.",
      modelsUsed: 0,
      totalEngines: providerCalls.length,
      elapsedMs: Date.now() - overallStart,
      engineTimings,
    });
    return;
  }

  // If only one model responded, no need to synthesize — just return it directly.
  if (successfulAnswers.length === 1) {
    res.status(200).json({
      reply: successfulAnswers[0],
      modelsUsed: 1,
      totalEngines: providerCalls.length,
      elapsedMs: Date.now() - overallStart,
      engineTimings,
    });
    return;
  }

  try {
    const merged = await synthesize(lastUserMessage, successfulAnswers);
    res.status(200).json({
      reply: merged,
      modelsUsed: successfulAnswers.length,
      totalEngines: providerCalls.length,
      elapsedMs: Date.now() - overallStart,
      engineTimings,
    });
  } catch (err) {
    // Synthesis itself failed for some reason — fall back to the first successful answer.
    res.status(200).json({
      reply: successfulAnswers[0],
      modelsUsed: successfulAnswers.length,
      totalEngines: providerCalls.length,
      elapsedMs: Date.now() - overallStart,
      engineTimings,
    });
  }
}
