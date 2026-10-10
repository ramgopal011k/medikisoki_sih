import { describe, it, expect } from 'vitest';
import { cleanTranscript } from '../src/lib/transcriptCleaner';

describe('Universal ASR Transcript Cleaner', () => {
  describe('English speech cleaning', () => {
    it('removes common English fillers and hesitations accurately', () => {
      const raw = 'Uh so I have, um, chest pain since you know yesterday';
      const result = cleanTranscript(raw, { language: 'en' });
      expect(result).toBe('I have chest pain since yesterday');
    });

    it('removes multi-word English fillers (sort of, kind of, i mean, you know)', () => {
      const raw = 'I sort of feel dizzy and you know kind of nauseous';
      const result = cleanTranscript(raw, { language: 'en' });
      expect(result).toBe('I feel dizzy and nauseous');
    });

    it('removes stutter word repetitions', () => {
      const raw = 'I I have severe severe back pain';
      const result = cleanTranscript(raw, { language: 'en' });
      expect(result).toBe('I have severe back pain');
    });

    it('handles all-filler English sentence by returning empty string', () => {
      const raw = 'Uh um ah so well basically';
      const result = cleanTranscript(raw, { language: 'en' });
      expect(result).toBe('');
    });
  });

  describe('Hindi speech cleaning', () => {
    it('removes Hindi conversational fillers and hesitations', () => {
      const raw = 'हाँ तो मुझे, मतलब, सीने में दर्द है';
      const result = cleanTranscript(raw, { language: 'hi' });
      expect(result).toBe('मुझे सीने में दर्द है');
    });

    it('removes multi-word Hindi filler ठीक है and single-word fillers', () => {
      const raw = 'अरे, ठीक है, मुझे बुखार है';
      const result = cleanTranscript(raw, { language: 'hi' });
      expect(result).toBe('मुझे बुखार है');
    });

    it('collapses Hindi stutter repetitions', () => {
      const raw = 'दर्द दर्द बहुत तेज है';
      const result = cleanTranscript(raw, { language: 'hi' });
      expect(result).toBe('दर्द बहुत तेज है');
    });

    it('handles all-filler Hindi sentence by returning empty string', () => {
      const raw = 'हाँ तो मतलब वो ठीक है अच्छा';
      const result = cleanTranscript(raw, { language: 'hi' });
      expect(result).toBe('');
    });
  });

  describe('Robustness and formatting', () => {
    it('collapses consecutive whitespace and trims surrounding punctuation', () => {
      const raw = '   , um,   fever since 2 days.   ';
      const result = cleanTranscript(raw, { language: 'en' });
      expect(result).toBe('fever since 2 days');
    });

    it('handles null, undefined, or empty string gracefully', () => {
      expect(cleanTranscript('')).toBe('');
      expect(cleanTranscript(null as any)).toBe('');
      expect(cleanTranscript(undefined as any)).toBe('');
    });

    it('defaults to English when language is unspecified', () => {
      const raw = 'Uh I have a headache';
      expect(cleanTranscript(raw)).toBe('I have a headache');
    });
  });
});
