import { API_URL } from '@/lib/api';

export function useVoiceGuidance() {
  const speak = async (text: string, language = 'en-IN') => {
    try {
      const res = await fetch(`${API_URL}/api/sarvam/tts`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer medikiosk-demo-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, language, speaker: 'priya' }),
      });
      const data = await res.json();
      if (data.audios?.[0]) {
        const audio = new Audio(`data:audio/wav;base64,${data.audios[0]}`);
        await audio.play();
      }
    } catch (err) {
      console.warn('Voice guidance TTS notice:', err);
    }
  };
  return { speak };
}
