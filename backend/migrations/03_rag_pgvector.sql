-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create rag_chunks table
CREATE TABLE IF NOT EXISTS rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id TEXT UNIQUE NOT NULL,
  text TEXT NOT NULL,
  source TEXT NOT NULL,
  section TEXT,
  chapter TEXT,
  verse TEXT,
  language TEXT DEFAULT 'en',
  dosha_tags TEXT[],
  token_count INT,
  char_count INT,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for cosine similarity search
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx 
  ON rag_chunks 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Match chunks RPC
CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  chunk_id TEXT,
  text TEXT,
  source TEXT,
  section TEXT,
  chapter TEXT,
  verse TEXT,
  language TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    chunk_id,
    text,
    source,
    section,
    chapter,
    verse,
    language,
    1 - (embedding <=> query_embedding) AS similarity
  FROM rag_chunks
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
