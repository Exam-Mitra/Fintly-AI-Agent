// Client-side helper that talks to our serverless /api/agent endpoint.
// The actual API keys and multi-model orchestration all happen server-side
// (api/agent.js) so your 5 free API keys are never exposed to the browser.

export async function getFintlyResponse(conversationMessages, { signal } = {}) {
  // Convert our stored { role, text, ts } shape into the { role, content } shape
  // the backend (and each AI provider) expects.
  const messages = conversationMessages.map((m) => ({
    role: m.role,
    content: m.text,
  }));

  const res = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!res.ok) {
    throw new Error('agent_request_failed');
  }

  const data = await res.json();
  if (!data || !data.reply) {
    throw new Error('agent_empty_reply');
  }

  // Returns the full metadata object so the UI can show a "Fintly Pro consulted
  // N engines" transparency panel — { reply, modelsUsed, totalEngines, elapsedMs, engineTimings }.
  return data;
}
