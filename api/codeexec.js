// Vercel serverless function — free tier.
// SAFE, SANDBOXED execution of user JavaScript using Node's `vm` module.
// The code runs in a fresh context with NO access to Node globals (no process,
// require, fs, fetch, network) — only standard JS built-ins + a captured console.
// A hard timeout bounds runaway loops. This is intentionally JS-only; Python/other
// languages need an external sandbox (e.g. e2b) and are rejected with a clear note.
//
// Body: { code: string, language?: 'js'|'javascript' }
// Returns: { ok, logs, result, error? }

import { createContext, Script } from 'node:vm';

const EXEC_TIMEOUT_MS = 6000;

function fmt(v) {
  if (typeof v === 'string') return v;
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { code, language } = req.body || {};
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'code required' });
    return;
  }
  if (language && !['js', 'javascript'].includes(String(language).toLowerCase())) {
    res.status(200).json({
      ok: false,
      error: 'unsupported_language',
      note: 'Only JavaScript runs in this sandbox. Python/other need an external sandbox (e.g. e2b).',
    });
    return;
  }

  const logs = [];
  const consoleShim = {
    log: (...a) => logs.push(a.map(fmt).join(' ')),
    info: (...a) => logs.push(a.map(fmt).join(' ')),
    warn: (...a) => logs.push('[warn] ' + a.map(fmt).join(' ')),
    error: (...a) => logs.push('[error] ' + a.map(fmt).join(' ')),
  };

  const sandbox = { console: consoleShim };
  const context = createContext(sandbox);

  try {
    const script = new Script(code, { filename: 'user_code.js', timeout: EXEC_TIMEOUT_MS });
    const result = script.runInContext(context, { timeout: EXEC_TIMEOUT_MS });

    let returned = null;
    if (result && typeof result.then === 'function') {
      returned = await Promise.race([
        result,
        new Promise((_, reject) => setTimeout(() => reject(new Error('async timeout')), EXEC_TIMEOUT_MS)),
      ]).catch((e) => `[async error: ${e.message}]`);
    } else {
      returned = result;
    }

    res.status(200).json({
      ok: true,
      logs: logs.join('\n'),
      result: returned === undefined ? null : fmt(returned),
    });
  } catch (e) {
    res.status(200).json({
      ok: true,
      logs: logs.join('\n'),
      error: e.message || 'execution_error',
    });
  }
}
