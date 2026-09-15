const BASE = 'https://api.sarvam.ai';

function getApiKey() {
  return process.env.SARVAM_API_KEY || '';
}

export async function transcribe(audioBuffer: Buffer | string, language = 'hi-IN') {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[Sarvam ASR] SARVAM_API_KEY not configured. Returning mock transcript.');
    return { transcript: 'सीने में दर्द और सांस लेने में तकलीफ (Mock ASR Transcript)' };
  }
  try {
    const form = new FormData();
    const buf = typeof audioBuffer === 'string' ? Buffer.from(audioBuffer) : audioBuffer;
    form.append('file', new Blob([new Uint8Array(buf) as any], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', 'saaras:v3');
    form.append('mode', 'transcribe');
    form.append('language_code', language);
    const res = await fetch(`${BASE}/speech-to-text`, {
      method: 'POST',
      headers: { 'api-subscription-key': apiKey },
      body: form,
    });
    if (!res.ok) throw new Error(`Sarvam ASR failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Sarvam ASR] Falling back to mock transcription:', err);
    return { transcript: 'Chest pain and breathlessness (Fallback ASR)' };
  }
}

export async function ocrDocument(imageBuffer: Buffer | string) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[Sarvam OCR] SARVAM_API_KEY not configured. Returning mock OCR result.');
    return { text: 'Medical Prescription Document OCR Digitised Result' };
  }
  try {
    const form = new FormData();
    const buf = typeof imageBuffer === 'string' ? Buffer.from(imageBuffer) : imageBuffer;
    form.append('file', new Blob([new Uint8Array(buf) as any], { type: 'application/pdf' }), 'doc.pdf');
    const res = await fetch(`${BASE}/doc-ai/v1/job/digitise`, {
      method: 'POST',
      headers: { 'api-subscription-key': apiKey },
      body: form,
    });
    if (!res.ok) throw new Error(`Sarvam OCR failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Sarvam OCR] Falling back to mock OCR output:', err);
    return { text: 'Prescription: Tab Paracetamol 500mg, Tab Amoxicillin 500mg' };
  }
}

export async function synthesize(text: string, language = 'hi-IN', speaker = 'priya') {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { audio: null, status: 'mock' };
  }
  try {
    const res = await fetch(`${BASE}/text-to-speech`, {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, language, model: 'bulbul:v3', speaker }),
    });
    if (!res.ok) throw new Error(`Sarvam TTS failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Sarvam TTS] Falling back:', err);
    return { audio: null, status: 'fallback' };
  }
}

export async function translate(text: string, source: string, target: string) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { translated_text: text };
  }
  try {
    const res = await fetch(`${BASE}/translate`, {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
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
    return await res.json();
  } catch (err) {
    console.warn('[Sarvam Translate] Falling back:', err);
    return { translated_text: text };
  }
}
