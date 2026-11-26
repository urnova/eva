import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

function cleanTtsText(raw) {
  return String(raw || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[ACTION:[\s\S]*?\]/g, '')
    .replace(/\[SUGGESTIONS:[\s\S]*?\]/g, '')
    .replace(/[*#_`~>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  let tts = null;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const text = cleanTtsText(body.text);
    if (!text) {
      return res.status(400).json({ ok: false, error: 'TEXT_REQUIRED' });
    }

    const reqVoice = typeof body.voice === 'string' ? body.voice.trim() : '';
    const voice = /^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9]+Neural$/.test(reqVoice)
      ? reqVoice
      : 'fr-FR-DeniseNeural';
    const rate = (typeof body.rate === 'string' && /^[+-]\d{1,3}%$/.test(body.rate.trim()))
      ? body.rate.trim()
      : undefined;

    tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text, rate ? { rate } : undefined);

    const audioBuf = await new Promise((resolve, reject) => {
      const chunks = [];
      const timer = setTimeout(() => reject(new Error('EDGE_TTS_TIMEOUT')), 12000);
      audioStream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      audioStream.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
      audioStream.on('error', (err) => { clearTimeout(timer); reject(err); });
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(audioBuf);
  } catch (err) {
    return res.status(502).json({ ok: false, error: err?.message || String(err) });
  } finally {
    try { tts?.close(); } catch (_) {}
  }
}
