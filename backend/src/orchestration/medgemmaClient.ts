const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MEDGEMMA_MODEL = 'medgemma1.5:latest';

export async function medgemmaReason(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MEDGEMMA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`MedGemma failed: ${res.status}`);
    const data = await res.json() as { message: { content: string } };
    return data.message.content;
  } finally {
    clearTimeout(timeoutId);
  }
}
