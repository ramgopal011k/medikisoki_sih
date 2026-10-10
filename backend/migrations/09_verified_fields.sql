ALTER TABLE summaries ADD COLUMN IF NOT EXISTS verified_fields TEXT[] DEFAULT '{}';
