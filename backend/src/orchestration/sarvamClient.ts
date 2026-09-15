const SARVAM_KEY = process.env.SARVAM_API_KEY!;
const BASE = 'https://api.sarvam.ai';

export async function transcribe(audioBuffer: Buffer, language = 'hi-IN') {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audioBuffer) as any], { type: 'audio/wav' }), 'audio.wav');
  form.append('model', 'saaras:v3');
  form.append('mode', 'transcribe');
  form.append('language_code', language);
  const res = await fetch(`${BASE}/speech-to-text`, {
    method: 'POST',
    headers: { 'api-subscription-key': SARVAM_KEY },
    body: form,
  });
  if (!res.ok) throw new Error(`Sarvam ASR failed: ${res.status}`);
  return res.json();
}

export async function ocrDocument(imageBuffer: Buffer) {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(imageBuffer) as any], { type: 'application/pdf' }), 'doc.pdf');
  const res = await fetch(`${BASE}/doc-ai/v1/job/digitise`, {
    method: 'POST',
    headers: { 'api-subscription-key': SARVAM_KEY },
    body: form,
  });
  if (!res.ok) throw new Error(`Sarvam OCR failed: ${res.status}`);
  return res.json();
}

export async function synthesize(text: string, language = 'hi-IN', speaker = 'priya') {
  const res = await fetch(`${BASE}/text-to-speech`, {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, language, model: 'bulbul:v3', speaker }),
  });
  if (!res.ok) throw new Error(`Sarvam TTS failed: ${res.status}`);
  return res.json();
}

export async function translate(text: string, source: string, target: string) {
  const res = await fetch(`${BASE}/translate`, {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      source_language_code: source,
      target_language_code: target,
      model: 'mayura:v1',
    }),
  });
  if (!res.ok) throw new Error(`Sarvam translate failed: ${res.status}`);
  return res.json();
}
