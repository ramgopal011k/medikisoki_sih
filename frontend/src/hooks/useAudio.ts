import { useVoiceGuidance } from './useVoiceGuidance';

export function useAudio() {
  const { speak: guidanceSpeak, stop, isPlaying } = useVoiceGuidance();

  const speak = async (text: string, lang = 'en-US', clipId?: string) => {
    return guidanceSpeak({
      clipId,
      fallbackText: text,
      language: lang
    });
  };

  return { speak, stop, isPlaying };
}
