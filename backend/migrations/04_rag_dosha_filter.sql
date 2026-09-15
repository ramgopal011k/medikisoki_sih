-- Enhanced match_rag_chunks with dosha filtering and classical source weighting
CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 5,
  dosha_filter TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  chunk_id TEXT,
  text TEXT,
  source TEXT,
  section TEXT,
  chapter TEXT,
  verse TEXT,
  language TEXT,
  dosha_tags TEXT[],
  similarity FLOAT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  SET LOCAL ivfflat.probes = 100;
  RETURN QUERY
  SELECT
    r.chunk_id,
    r.text,
    r.source,
    r.section,
    r.chapter,
    r.verse,
    r.language,
    r.dosha_tags,
    (
      (1 - (r.embedding <=> query_embedding))
      * CASE 
          WHEN r.source ILIKE '%Charaka%' THEN 1.15
          WHEN r.source ILIKE '%Sushruta%' THEN 1.15
          WHEN r.source ILIKE '%Rasa Jala Nidhi%' THEN 1.10
          WHEN r.source ILIKE '%Veda%' THEN 1.05
          ELSE 0.90
        END
      * CASE
          WHEN dosha_filter IS NOT NULL AND r.dosha_tags && dosha_filter THEN 1.12
          WHEN dosha_filter IS NOT NULL AND NOT (r.dosha_tags && dosha_filter) THEN 0.90
          ELSE 1.0
        END
    )::FLOAT AS similarity
  FROM rag_chunks r
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
