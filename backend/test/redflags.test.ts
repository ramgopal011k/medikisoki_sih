// Mock supabase before importing redflags
const updateMock = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) });
const selectMock = jest.fn();

jest.mock('../src/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'answers') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [
                { question_id: 'chief_complaint', answer_text: 'Chest Pain' }
              ]
            })
          })
        };
      }
      if (table === 'sessions') {
        return {
          update: updateMock
        };
      }
      if (table === 'red_flags') {
        return {
          insert: jest.fn().mockResolvedValue({ data: null, error: null })
        };
      }
      return {};
    }
  }
}));

import { evaluateAnswer } from '../src/redflags';

describe('Red Flags Evaluator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('triggers R1 for severe chest pain (7-10 Severe)', async () => {
    await evaluateAnswer({
      session_id: 'test-session-1',
      question_id: 'q_chest_severity',
      answer_text: '7-10 Severe'
    });

    expect(updateMock).toHaveBeenCalledWith({ red_flag: true });
  });

  it('triggers R1 for thunderclap headache (Worst headache of my life)', async () => {
    await evaluateAnswer({
      session_id: 'test-session-2',
      question_id: 'q_headache_severity',
      answer_text: 'Worst headache of my life'
    });

    expect(updateMock).toHaveBeenCalledWith({ red_flag: true });
  });

  it('triggers R2 for chest pain radiating to left arm', async () => {
    await evaluateAnswer({
      session_id: 'test-session-3',
      question_id: 'q_chest_radiation',
      answer_text: 'Left arm'
    });

    expect(updateMock).toHaveBeenCalledWith({ red_flag: true });
  });

  it('triggers R3 for chest pain with shortness of breath', async () => {
    await evaluateAnswer({
      session_id: 'test-session-4',
      question_id: 'q_chest_breath',
      answer_text: 'Yes'
    });

    expect(updateMock).toHaveBeenCalledWith({ red_flag: true });
  });

  it('triggers R4 for coughing blood', async () => {
    await evaluateAnswer({
      session_id: 'test-session-5',
      question_id: 'q_cough_blood',
      answer_text: 'Yes'
    });

    expect(updateMock).toHaveBeenCalledWith({ red_flag: true });
  });

  it('triggers R5 for high fever >103', async () => {
    await evaluateAnswer({
      session_id: 'test-session-6',
      question_id: 'q_fever_temp',
      answer_text: 'High >103'
    });

    expect(updateMock).toHaveBeenCalledWith({ red_flag: true });
  });

  it('does not trigger deterministic red flag for mild fever (Low <100)', async () => {
    // Avoid calling fetch for semantic fallback
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ isFlagged: false })
    } as any);

    await evaluateAnswer({
      session_id: 'test-session-7',
      question_id: 'q_fever_temp',
      answer_text: 'Low <100'
    });

    expect(updateMock).not.toHaveBeenCalledWith({ red_flag: true });
  });
});
