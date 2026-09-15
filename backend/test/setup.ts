process.env.NODE_ENV = 'test';
jest.setTimeout(15000);

jest.mock('../src/supabase', () => {
  const result = { data: [], error: null };
  const query: any = {
    select: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
    upsert: jest.fn(() => query),
    eq: jest.fn(() => query),
    neq: jest.fn(() => query),
    gte: jest.fn(() => query),
    lt: jest.fn(() => query),
    in: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    single: jest.fn(async () => ({ data: { id: 'test-session-id' }, error: null })),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return { supabase: { from: jest.fn(() => query) } };
});

jest.mock('../src/rag/ayushRag', () => ({
  reasonAyushWithRag: jest.fn(async () => ({
    dominant_dosha: 'Vata',
    citations: [],
  })),
}));
