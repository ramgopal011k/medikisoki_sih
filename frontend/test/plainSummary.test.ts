import { describe, it, expect } from 'vitest';
import {
  generatePlainSummary,
  extractSessionSummaryInput,
  type PlainSummaryInput
} from '../src/lib/plainSummary';

describe('plainSummary generator', () => {
  it('generates standard EN summary with red flag and duration and medications', () => {
    const input: PlainSummaryInput = {
      chiefComplaint: 'chest_pain',
      duration: '2 days',
      hasRedFlag: true,
      medications: ['Aspirin', 'Metoprolol'],
      condition: 'heart disease',
      language: 'en'
    };

    const result = generatePlainSummary(input);
    expect(result).toBe(
      'You told us you have chest pain that started 2 days ago. Because of this, please tell the doctor right away. You also said you take Aspirin, Metoprolol for heart disease.'
    );
    expect(result.split('.').filter(s => s.trim().length > 0)).toHaveLength(3);
  });

  it('generates standard EN summary without red flag (wait for your turn)', () => {
    const input: PlainSummaryInput = {
      chiefComplaint: 'fever',
      duration: '3 to 7 days',
      hasRedFlag: false,
      medications: 'Paracetamol',
      language: 'en'
    };

    const result = generatePlainSummary(input);
    expect(result).toBe(
      'You told us you have fever that started 3 to 7 days ago. Because of this, please wait for your turn. You also said you take Paracetamol.'
    );
  });

  it('skips medication sentence when no medications are reported', () => {
    const input: PlainSummaryInput = {
      chiefComplaint: 'cough',
      duration: 'less than 2 weeks',
      hasRedFlag: false,
      medications: 'None reported',
      language: 'en'
    };

    const result = generatePlainSummary(input);
    expect(result).toBe(
      'You told us you have cough that started less than 2 weeks ago. Because of this, please wait for your turn.'
    );
    expect(result.split('.').filter(s => s.trim().length > 0)).toHaveLength(2);
  });

  it('skips duration expression when duration is unknown or not provided', () => {
    const input: PlainSummaryInput = {
      chiefComplaint: 'headache',
      duration: undefined,
      hasRedFlag: false,
      medications: '',
      language: 'en'
    };

    const result = generatePlainSummary(input);
    expect(result).toBe(
      'You told us you have headache. Because of this, please wait for your turn.'
    );
    expect(result).not.toContain('that started');
    expect(result.split('.').filter(s => s.trim().length > 0)).toHaveLength(2);
  });

  it('generates Hindi summary with red flag, duration, and medications', () => {
    const input: PlainSummaryInput = {
      chiefComplaint: 'chest_pain',
      duration: 'less_3_days',
      hasRedFlag: true,
      medications: 'Aspirin',
      condition: 'उच्च रक्तचाप',
      language: 'hi'
    };

    const result = generatePlainSummary(input);
    expect(result).toBe(
      'आपने हमें बताया कि आपको छाती में दर्द है जो 3 दिन से कम पहले शुरू हुआ था। इस कारण, कृपया तुरंत डॉक्टर को बताएं। आपने यह भी बताया कि आप उच्च रक्तचाप के लिए Aspirin लेते हैं।'
    );
  });

  it('generates Hindi summary without red flag and skips medication if none reported', () => {
    const input: PlainSummaryInput = {
      chiefComplaint: 'fever',
      duration: undefined,
      hasRedFlag: false,
      medications: 'none',
      language: 'hi'
    };

    const result = generatePlainSummary(input);
    expect(result).toBe(
      'आपने हमें बताया कि आपको बुखार है। इसलिए, कृपया अपनी बारी की प्रतीक्षा करें।'
    );
    expect(result).not.toContain('दवा');
    expect(result).not.toContain('पहले शुरू हुआ था');
  });

  it('caps output at 3 sentences maximum', () => {
    const input: PlainSummaryInput = {
      chiefComplaint: 'abdominal_pain',
      duration: '2 days',
      hasRedFlag: true,
      medications: 'Antacid',
      condition: 'gastritis',
      language: 'en'
    };

    const result = generatePlainSummary(input);
    const sentenceCount = result.split('.').filter(s => s.trim().length > 0).length;
    expect(sentenceCount).toBeLessThanOrEqual(3);
  });

  it('correctly extracts summary fields from session and facts', () => {
    const mockSession = {
      id: 'session-123',
      chief_complaint: 'chest_pain',
      language: 'en',
      red_flag: false
    };

    const mockFacts = [
      { question_id: 'duration', answer_text: '2 days' },
      { question_id: 'cp_radiation', answer_value: 'left_arm', red_flag_id: 'chest_pain_left_arm_radiation' }
    ];

    const mockMh = [
      { category: 'Medications', value: 'Aspirin' },
      { category: 'Conditions', value: 'Hypertension' }
    ];

    const extracted = extractSessionSummaryInput(mockSession, mockFacts, mockMh);
    expect(extracted.chiefComplaint).toBe('chest_pain');
    expect(extracted.duration).toBe('2 days');
    expect(extracted.hasRedFlag).toBe(true);
    expect(extracted.medications).toBe('Aspirin');
    expect(extracted.condition).toBe('Hypertension');
    expect(extracted.language).toBe('en');

    const summary = generatePlainSummary(extracted);
    expect(summary).toContain('tell the doctor right away');
    expect(summary).toContain('Aspirin for Hypertension');
  });
});
