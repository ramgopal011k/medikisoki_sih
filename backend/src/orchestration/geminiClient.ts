import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function geminiReason(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function matchVoice(transcript: string, options: string[]): Promise<string | null> {
  const prompt = `Match: "${transcript}" to one of: ${options.join(', ')}. Return ONLY the match or "NO_MATCH".`;
  const result = await geminiReason(prompt);
  const text = result.trim();
  return text === 'NO_MATCH' ? null : text;
}
