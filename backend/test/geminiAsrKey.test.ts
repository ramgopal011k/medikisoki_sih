import { GoogleGenerativeAI } from '@google/generative-ai';
import { transcribeAudioWithGemini } from '../src/orchestration/geminiClient';

jest.mock('@google/generative-ai');

describe('GEMINI_ASR_API_KEY dedicated key and fallback', () => {
  const origAsrKey = process.env.GEMINI_ASR_API_KEY;
  const origMainKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.GEMINI_ASR_API_KEY = origAsrKey;
    process.env.GEMINI_API_KEY = origMainKey;
  });

  it('uses GEMINI_ASR_API_KEY when present', async () => {
    process.env.GEMINI_ASR_API_KEY = 'test-asr-key-123';
    process.env.GEMINI_API_KEY = 'test-main-key-456';

    const mockGenerateContent = jest.fn().mockResolvedValue({
      response: { text: () => 'transcribed speech' }
    });
    const mockGetModel = jest.fn().mockReturnValue({
      generateContent: mockGenerateContent
    });
    (GoogleGenerativeAI as unknown as jest.Mock).mockImplementation((key: string) => ({
      getGenerativeModel: mockGetModel
    }));

    const result = await transcribeAudioWithGemini(Buffer.from('dummy audio'));

    expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-asr-key-123');
    expect(result).toBe('transcribed speech');
  });

  it('falls back to GEMINI_API_KEY when GEMINI_ASR_API_KEY is not set', async () => {
    delete process.env.GEMINI_ASR_API_KEY;
    process.env.GEMINI_API_KEY = 'test-fallback-main-key';

    const mockGenerateContent = jest.fn().mockResolvedValue({
      response: { text: () => 'fallback transcribed speech' }
    });
    const mockGetModel = jest.fn().mockReturnValue({
      generateContent: mockGenerateContent
    });
    (GoogleGenerativeAI as unknown as jest.Mock).mockImplementation((key: string) => ({
      getGenerativeModel: mockGetModel
    }));

    const result = await transcribeAudioWithGemini(Buffer.from('dummy audio'));

    expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-fallback-main-key');
    expect(result).toBe('fallback transcribed speech');
  });

  it('throws an error if neither key is configured', async () => {
    delete process.env.GEMINI_ASR_API_KEY;
    delete process.env.GEMINI_API_KEY;

    await expect(transcribeAudioWithGemini(Buffer.from('dummy audio'))).rejects.toThrow(
      'GEMINI_ASR_API_KEY not configured for audio transcription'
    );
  });
});
