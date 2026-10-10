const mockOrder = jest.fn().mockResolvedValue({
  data: [
    { question_id: 'q_pain', answer_text: 'throbbing', provenance: 'patient_reported' },
    { question_id: 'ocr_medication', answer_text: 'aspirin', provenance: 'ocr_extracted' }
  ],
  error: null
});

jest.mock('../src/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'medical_history') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [{ category: 'Past Medical History', value: 'Diabetes' }],
              error: null
            })
          })
        };
      }
      if (table === 'ayush_assessments') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null })
          })
        };
      }
      if (table === 'answers') {
        return {
          select: () => ({
            eq: () => ({
              order: mockOrder
            })
          })
        };
      }
      if (table === 'summaries') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null })
            })
          }),
          insert: () => Promise.resolve({ data: null, error: null }),
          update: () => ({
            eq: () => Promise.resolve({ data: null, error: null })
          })
        };
      }
      if (table === 'sessions') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { id: 's1', chief_complaint: 'Headache' },
                error: null
              })
            })
          })
        };
      }
      return {};
    }
  }
}));

import { generateTriageSummary } from '../src/summary';

describe('Triage Summary Generator', () => {
  it('generates distinct clinical sections from intake and history facts', async () => {
    const result = await generateTriageSummary('s1');
    const summary = result.summary;

    expect(summary.chief_complaint).toBe('Headache');
    expect(summary.hpi.some((h: string) => h.includes('Pain: throbbing') || h.toLowerCase().includes('pain: throbbing'))).toBe(true);
    expect(summary.pmh.some((p: string) => p.includes('Diabetes'))).toBe(true);
    expect(summary.psh).toEqual(['None reported']);
  });
});
