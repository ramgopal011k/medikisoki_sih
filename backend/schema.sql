-- Supabase Schema for MediKiosk
-- Updated to match actual codebase usage

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. hospitals
CREATE TABLE IF NOT EXISTS hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_name TEXT,
    name TEXT,
    location TEXT,
    hospital_type TEXT,
    contact TEXT,
    bed_count INTEGER DEFAULT 100,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. doctors
CREATE TABLE IF NOT EXISTS doctors (
    doctor_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    hospital_id UUID REFERENCES hospitals(id),
    uid TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES hospitals(id),
    patient_name TEXT NOT NULL DEFAULT 'Anonymous Patient',
    dummy_aadhaar TEXT NOT NULL DEFAULT '00000000000000',
    language TEXT NOT NULL DEFAULT 'en',
    chief_complaint TEXT,
    status TEXT DEFAULT 'active',
    red_flag BOOLEAN DEFAULT false,
    locked BOOLEAN DEFAULT false,
    age TEXT,
    gender TEXT,
    phone TEXT,
    patient_type TEXT DEFAULT 'existing',
    session_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. answers (replaces history_facts — this is the table actually used by the code)
CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    answer_text TEXT,
    provenance TEXT CHECK (provenance IN ('patient_reported', 'doctor_entered', 'system_derived', 'ocr_extracted')),
    verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES doctors(doctor_id),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. medical_history
CREATE TABLE IF NOT EXISTS medical_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    value TEXT NOT NULL,
    provenance TEXT CHECK (provenance IN ('patient_reported', 'doctor_entered', 'system_derived', 'ocr_extracted')),
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. ayush_assessments
CREATE TABLE IF NOT EXISTS ayush_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    dimension TEXT NOT NULL,
    value TEXT NOT NULL,
    reasoning JSONB,
    provenance TEXT CHECK (provenance IN ('patient_reported', 'doctor_entered', 'system_derived', 'ocr_extracted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    upload_status TEXT DEFAULT 'pending',
    ocr_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. ocr_extractions
CREATE TABLE IF NOT EXISTS ocr_extractions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extraction_id UUID DEFAULT uuid_generate_v4(),
    document_id UUID,
    field_name TEXT NOT NULL,
    field_value TEXT,
    confidence NUMERIC,
    raw_text TEXT,
    corrected_value TEXT,
    provenance TEXT CHECK (provenance IN ('patient_reported', 'doctor_entered', 'system_derived', 'ocr_extracted')),
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. red_flags
CREATE TABLE IF NOT EXISTS red_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_id UUID DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL,
    triggered_fact_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acknowledged_by UUID REFERENCES doctors(doctor_id),
    acknowledged_at TIMESTAMP WITH TIME ZONE
);

-- 10. summaries
CREATE TABLE IF NOT EXISTS summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    content JSONB,
    hindi_content JSONB,
    icd_codes JSONB,
    doctor_verified BOOLEAN DEFAULT false,
    finalized BOOLEAN DEFAULT false,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. consent_logs
CREATE TABLE IF NOT EXISTS consent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    patient_id TEXT,
    consent_status TEXT DEFAULT 'granted',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES doctors(doctor_id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- REALTIME CONFIGURATION
-- Enable replication for specific tables to allow Supabase Realtime to work
BEGIN;
  -- Remove the supabase_realtime publication if it exists
  DROP PUBLICATION IF EXISTS supabase_realtime;
  
  -- Create it again with the necessary tables
  CREATE PUBLICATION supabase_realtime FOR TABLE sessions, answers, red_flags, medical_history;
COMMIT;

-- SEED DATA
INSERT INTO hospitals (id, name)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '{"name":"City General Hospital","location":"Civil Lines, Central District","type":"General","contact":"+91 141 2345678","bed_count":250}'),
  ('22222222-2222-2222-2222-222222222222', '{"name":"Ayush Wellness Center","location":"North Ayurvedic Zone","type":"Ayush","contact":"+91 141 8765432","bed_count":80}'),
  ('33333333-3333-3333-3333-333333333333', '{"name":"All India Institute of Ayurveda","location":"South Campus, Green Enclave","type":"Ayush","contact":"+91 11 26789000","bed_count":150}'),
  ('44444444-4444-4444-4444-444444444444', '{"name":"District Civil Multi-Specialty Hospital","location":"Sector 5, Outer Ring","type":"General","contact":"+91 141 2998877","bed_count":400}')
ON CONFLICT (id) DO NOTHING;
