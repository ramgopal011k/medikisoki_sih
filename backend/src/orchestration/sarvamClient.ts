const BASE = 'https://api.sarvam.ai';

function getApiKey() {
  return process.env.SARVAM_API_KEY || '';
}

export async function transcribe(
  audioBuffer: Buffer | string,
  language = 'hi-IN',
  mimeType = 'audio/webm',
  originalName = 'audio.webm'
) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[Sarvam ASR] SARVAM_API_KEY not configured.');
    throw new Error('SARVAM_API_KEY not configured');
  }
  try {
    const form = new FormData();
    const buf = typeof audioBuffer === 'string' ? Buffer.from(audioBuffer) : audioBuffer;
    // Use the actual MIME type from the client — Sarvam Saaras v3 supports webm, mp4, ogg, wav
    // Never re-wrap as audio/wav; that causes Sarvam to reject mobile-generated audio
    const effectiveMime = mimeType || 'audio/webm';
    const ext = effectiveMime.includes('mp4') || effectiveMime.includes('mpeg') || effectiveMime.includes('mp4a')
      ? 'mp4'
      : effectiveMime.includes('ogg') ? 'ogg'
      : effectiveMime.includes('wav') ? 'wav'
      : 'webm';
    const filename = originalName || `audio.${ext}`;
    console.log(`[Sarvam ASR] Forwarding audio: mime=${effectiveMime}, filename=${filename}, lang=${language}`);
    form.append('file', new Blob([new Uint8Array(buf) as any], { type: effectiveMime }), filename);
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
    console.warn('[Sarvam ASR] Transcription failed:', err);
    throw err;
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
    return { audios: [], status: 'mock' };
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
    return { audios: [], status: 'fallback' };
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
