import { describe, it, expect } from 'vitest';
import { cleanTranscript, extractName, parseDemographics } from '../src/lib/transcriptCleaner';

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

    it('removes single and multi-word stutter repetitions', () => {
      const raw = 'I I have severe severe back pain';
      const result = cleanTranscript(raw, { language: 'en' });
      expect(result).toBe('I have severe back pain');
    });

    it('collapses multi-word consecutive stutters (1-4 words)', () => {
      expect(cleanTranscript('I am I am I am Raju')).toBe('I am Raju');
      expect(cleanTranscript('my name is my name is Raju')).toBe('my name is Raju');
      expect(cleanTranscript('I have chest pain chest pain since morning')).toBe('I have chest pain since morning');
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

    it('collapses Hindi multi-word stutter repetitions', () => {
      const raw = 'मेरा नाम मेरा नाम राहुल है';
      const result = cleanTranscript(raw, { language: 'hi' });
      expect(result).toBe('मेरा नाम राहुल है');
    });

    it('handles all-filler Hindi sentence by returning empty string', () => {
      const raw = 'हाँ तो मतलब वो ठीक है अच्छा';
      const result = cleanTranscript(raw, { language: 'hi' });
      expect(result).toBe('');
    });
  });

  describe('Context-Aware Patient Name Extraction (extractName)', () => {
    it('extracts name while stripping prefixes and age info', () => {
      expect(extractName('I am Raju age 30')).toBe('Raju');
      expect(extractName('my name is Priya')).toBe('Priya');
      expect(extractName('I am I am I am Raju')).toBe('Raju');
      expect(extractName('this is Suresh age 25 years old')).toBe('Suresh');
      expect(extractName('mera naam Amit hai')).toBe('Amit');
      expect(extractName('main Rahul hoon age 40')).toBe('Rahul');
      expect(extractName('my name is Anita Kumar 35 years old')).toBe('Anita Kumar');
      expect(extractName('Raju')).toBe('Raju');
      expect(extractName('Priya Sharma')).toBe('Priya Sharma');
    });

    it('ignores isolated command keywords or age digits', () => {
      expect(extractName('Male')).toBe('');
      expect(extractName('Female')).toBe('');
      expect(extractName('30')).toBe('');
      expect(extractName('continue')).toBe('');
    });

    it('falls back to cleaned transcript if extraction has no prefix or suffix', () => {
      expect(extractName('Arun')).toBe('Arun');
      expect(extractName('')).toBe('');
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

  describe('parseDemographics', () => {
    it('extracts name, age, and gender from natural conversation', () => {
      expect(parseDemographics('I am Raju, age 30, male')).toEqual({
        name: 'Raju',
        age: '30',
        gender: 'Male',
      });
      expect(parseDemographics('Mera naam Priya hai, 25 saal, female')).toEqual({
        name: 'Priya',
        age: '25',
        gender: 'Female',
      });
      expect(parseDemographics('I am Ramesh')).toEqual({
        name: 'Ramesh',
        age: null,
        gender: null,
      });
    });

    it('extracts name with fallback when only name is provided', () => {
      expect(parseDemographics('Suresh')).toEqual({
        name: 'Suresh',
        age: null,
        gender: null,
      });
    });

    it('returns null name when only gender or age is spoken', () => {
      expect(parseDemographics('Male, 30 years old')).toEqual({
        name: null,
        age: '30',
        gender: 'Male',
      });
      expect(parseDemographics('Female')).toEqual({
        name: null,
        age: null,
        gender: 'Female',
      });
    });

    it('handles natural phrasing with other gender', () => {
      expect(parseDemographics('My name is Alex, age 28, other')).toEqual({
        name: 'Alex',
        age: '28',
        gender: 'Other',
      });
    });
  });
});
