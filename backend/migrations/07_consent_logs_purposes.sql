CREATE TABLE IF NOT EXISTS public.consent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    patient_id TEXT,
    purpose TEXT,
    granted BOOLEAN DEFAULT true,
    consent_status VARCHAR(50) DEFAULT 'granted',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- In case it already exists without purpose/granted
ALTER TABLE public.consent_logs ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE public.consent_logs ADD COLUMN IF NOT EXISTS granted BOOLEAN DEFAULT true;
ALTER TABLE public.consent_logs ALTER COLUMN patient_id TYPE TEXT;

-- RLS Policies
ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public inserts to consent_logs" ON public.consent_logs;
CREATE POLICY "Allow public inserts to consent_logs" ON public.consent_logs
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select on consent_logs" ON public.consent_logs;
CREATE POLICY "Allow select on consent_logs" ON public.consent_logs
FOR SELECT USING (true);
