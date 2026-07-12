// Vercel serverless function — free tier.
// This is the "Fintly Pro" engine: it queries up to 5 free AI providers in parallel,
// then uses one of them as a "judge" to synthesize all the independent answers into
// a single, more accurate, polished final response. If some providers are
// rate-limited, down, or slow, it proceeds with whichever ones responded in time —
// it never fully fails as long as at least one provider works.
//
// It also reports back ANONYMIZED timing/engine metadata (never real provider names —
// just "Engine 1", "Engine 2", etc.) so the client can show a transparency panel.
//
// Required environment variables (Vercel -> Project Settings -> Environment Variables):
//   GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, CEREBRAS_API_KEY,
//   HUGGINGFACE_API_KEY, TAVILY_API_KEY

const BASE_SYSTEM_PROMPT = `You are Fintly Pro, a helpful, accurate, and knowledgeable AI assistant.

CORE BEHAVIOR
- Answer clearly, correctly, and stay well-organized. Be concise unless more detail is asked for.
- Format in clean Markdown: use **bold**, headings, and bullet lists where helpful. For code, always use a fenced block with the correct language tag (e.g. \`\`\`python). Never wrap plain code identifiers, object attributes, or method calls (like iris.data, user.name, object.method()) in markdown link syntax — they are not URLs. Only use [text](url) for real web links, and never fabricate URLs.

LANGUAGE
- Reply in the SAME language (or mix) the user writes in: Hindi -> Hindi; Hinglish (Latin-script Hindi-English) -> natural Hinglish; English -> English. Only switch languages if explicitly asked.

USING PROVIDED CONTEXT
- You may receive web search results, attached file/text content, or image context. Use it when relevant. Cite web sources inline as [1], [2] using only the provided URLs. Do not invent sources or URLs.

WHEN TO CLARIFY
- If a request is genuinely ambiguous in a way that changes the answer (missing goal, audience, output format, or key constraint), ask ONE short, focused clarifying question before answering. Do not over-ask for trivial or clearly-scoped requests.

ACTING ON THE USER'S BEHALF
- Fintly can perform real tasks: it can use the camera, microphone, and files the user provides in this chat, and it can act through services the user has connected (for example a Google account) and confirmed.
- Never take a consequential action (send a message, place a booking, change an account, or perform any action with real-world effect) without the user's explicit confirmation. Propose the action, show exactly what will happen, and wait for a clear "yes".
- Only act through a service the user has actually connected and authorized. If a service isn't connected yet, tell the user how to connect it — don't pretend or guess.

ACCURACY & HONESTY
- Strive for accuracy; state when you are uncertain rather than guessing. Never present fabricated facts, prices, URLs, or citations.
- For important financial, legal, medical, or safety matters, give helpful general information but advise verifying with a qualified professional or official source.
- Be safe: decline to help with anything illegal or harmful.

BEST PRACTICE
- Follow any stated goal, audience, format, language/tone, and constraints. If none are given, reasonable defaults are fine unless ambiguity is high (see "When to clarify").`;

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

const PROVIDER_TIMEOUT_MS = 20000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout`)), ms)),
  ]);
}

const SEARCH_TRIGGER_PATTERNS = [
  /\b(latest|recent|current|today|this week|this month|this year|right now|breaking)\b/i,
  /\b(news|headline|update[sd]?)\b/i,
  /\b(price|stock|share market|sensex|nifty|crypto|bitcoin)\b/i,
  /\b(weather|forecast|temperature)\b/i,
  /\b(score|match result|who won|election result)\b/i,
  /\b(20(2[5-9]|3\d))\b/,
  /\bwho is (the )?(current|new)\b/i,
  /\bwhen (is|was|will)\b/i,
];

function needsWebSearch(text) {
  if (!text) return false;
  return SEARCH_TRIGGER_PATTERNS.some((re) => re.test(text));
}

async function searchWeb(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: 5,
        include_answer: false,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: (r.content || '').slice(0, 400),
    }));
    if (!results.length) return null;
    return results;
  } catch {
    return null;
  }
}

function buildSearchContext(results) {
  return `Here are current web search results that may be relevant to your question (retrieved just now):\n\n${results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
    .join('\n\n')}\n\nUse these results to inform your answer where relevant, especially for anything time-sensitive or factual you're not fully certain about. When you use information from a specific result, you may cite it inline like [1] or [2] matching the numbers above. Do not fabricate URLs — only reference the ones given above.`;
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

async function synthesize(userQuestion, candidateAnswers) {
  const judgePrompt = `You are Fintly Pro, an AI that synthesizes multiple independent AI-generated answers into one single, best, accurate, well-written final answer for the user.

Below are ${candidateAnswers.length} independent AI-generated answers to the same user question. They may vary in completeness, phrasing, or occasionally disagree on details.

User question: "${userQuestion}"

${candidateAnswers.map((a, i) => `--- Answer ${i + 1} ---\n${a}`).join('\n\n')}

Your task: Write ONE final, synthesized answer that combines the best, most accurate, most complete information from all the answers above. Do not mention that you are combining multiple answers, and do not say things like "Answer 1 says" — just give a single clean, confident, well-written final answer as if you knew this yourself. If the answers disagree on facts, use your own best judgment for what is most likely correct.

Formatting rules (important):
- Format your response in clean Markdown (headings, **bold**, bullet lists where helpful).
- Preserve any code blocks exactly, correctly formatted with fenced code blocks and a language tag (e.g. \`\`\`python).
- Never wrap plain code identifiers, object attributes, or method calls (like iris.data, user.name, or object.method()) in markdown link syntax [text](url) — they are not URLs and must stay as plain code text. Only use real link formatting for actual web URLs.
- Reply in the same language the user's question was written in (match Hindi, Hinglish, English, etc. as appropriate) — look at the candidate answers' language too, since they were likely already answering in the right language.
- Never fabricate facts, prices, URLs, or citations. If the candidate answers disagree and you are unsure, say so rather than guessing.`;

  const judgeMessages = [{ role: 'user', content: judgePrompt }];

  try {
    return await withTimeout(callGemini(judgeMessages), PROVIDER_TIMEOUT_MS, 'judge_gemini');
  } catch {
    try {
      return await withTimeout(callGroq(judgeMessages), PROVIDER_TIMEOUT_MS, 'judge_groq');
    } catch {
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

  const trimmedHistory = messages.slice(-16);
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  let searchResults = null;
  if (needsWebSearch(lastUserMessage)) {
    searchResults = await searchWeb(lastUserMessage);
  }

  let systemPrompt = buildSystemPrompt(customInstructions, memories);
  if (searchResults) {
    systemPrompt += `\n\n${buildSearchContext(searchResults)}`;
  }
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...trimmedHistory];

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
        sources: searchResults || [],
      });
    } catch (err) {
      res.status(200).json({
        reply: "I couldn't analyze that image right now — please try again in a moment.",
        modelsUsed: 0,
        totalEngines: 1,
        elapsedMs: Date.now() - overallStart,
        engineTimings: [{ id: 1, ok: false, ms: Date.now() - overallStart }],
        sources: [],
      });
    }
    return;
  }

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
      sources: searchResults || [],
    });
    return;
  }

  if (successfulAnswers.length === 1) {
    res.status(200).json({
      reply: successfulAnswers[0],
      modelsUsed: 1,
      totalEngines: providerCalls.length,
      elapsedMs: Date.now() - overallStart,
      engineTimings,
      sources: searchResults || [],
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
      sources: searchResults || [],
    });
  } catch (err) {
    res.status(200).json({
      reply: successfulAnswers[0],
      modelsUsed: successfulAnswers.length,
      totalEngines: providerCalls.length,
      elapsedMs: Date.now() - overallStart,
      engineTimings,
      sources: searchResults || [],
    });
  }
}i
