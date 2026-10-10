ALTER TABLE public.history_facts ADD COLUMN IF NOT EXISTS field_name TEXT;
ALTER TABLE public.history_facts ADD COLUMN IF NOT EXISTS field_value TEXT;

-- Also ensure RLS policies exist on history_facts
ALTER TABLE public.history_facts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public inserts to history_facts" ON public.history_facts;
CREATE POLICY "Allow public inserts to history_facts" ON public.history_facts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow select on history_facts" ON public.history_facts;
CREATE POLICY "Allow select on history_facts" ON public.history_facts FOR SELECT USING (true);
