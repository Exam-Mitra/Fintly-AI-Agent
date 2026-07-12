// Vercel serverless function — free tier.
// Text-to-speech via Google Gemini TTS (GEMINI_API_KEY, already configured).
// Gemini emits raw 16-bit PCM ("audio/L16"); we wrap it in a WAV header so the
// client gets a downloadable/playable .wav file. No new API key required.
//
// Body: { text: string, lang?: 'en'|'hi'|'en-IN'|'hi-IN'|... }
// Returns: { ok, audioBase64, mimeType } or { ok:false, error }

const TTS_TIMEOUT_MS = 25000;
const MAX_TEXT_CHARS = 4000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout`)), ms)),
  ]);
}

function buildWavHeader(sampleRate, numChannels, bitsPerSample, dataLen) {
  const buffer = Buffer.alloc(44);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLen, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28); // byte rate
  buffer.writeUInt16LE((numChannels * bitsPerSample) / 8, 32); // block align
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLen, 40);
  return buffer;
}

function pcmBase64ToWav(base64Pcm, sampleRate = 24000) {
  const pcm = Buffer.from(base64Pcm, 'base64');
  const header = buildWavHeader(sampleRate, 1, 16, pcm.length);
  return Buffer.concat([header, pcm]).toString('base64');
}

// Pick a Gemini TTS voice that supports the requested language.
function pickVoice(lang) {
  const l = (lang || 'en').toLowerCase();
  if (l.startsWith('hi')) return 'Puck'; // Hindi-capable
  return 'Kore'; // English (and broadly capable)
}

async function synthesize(text, voiceName) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('not_configured');
  const model = 'gemini-2.5-flash-preview-tts';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`tts_${res.status}`);
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  const b64 = part?.inlineData?.data;
  if (!b64) throw new Error('tts_empty');
  return pcmBase64ToWav(b64, 24000);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { text, lang } = req.body || {};
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text required' });
    return;
  }
  const trimmed = text.slice(0, MAX_TEXT_CHARS);

  try {
    const voice = pickVoice(lang);
    const wavBase64 = await withTimeout(synthesize(trimmed, voice), TTS_TIMEOUT_MS, 'tts');
    res.status(200).json({ ok: true, audioBase64: wavBase64, mimeType: 'audio/wav' });
  } catch (e) {
    res.status(200).json({ ok: false, error: e.message || 'tts_failed' });
  }
}
