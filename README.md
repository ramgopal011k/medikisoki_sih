# 🏥 MediKiosk – Patient Case-Taking Kiosk

> **Multilingual clinical history kiosk for OPD settings with Allopathy & AYUSH Dashavidha Pariksha support**  
> *Developed for All India Institute of Ayurveda, Ministry of Ayush (Smart India Hackathon — MedTech/HealthTech)*

---

## 📌 Project Overview

MediKiosk is an offline-resilient, touch/voice-enabled clinical triage kiosk for Indian hospital OPDs. Patients self-record structured clinical histories in English or Hindi before seeing a physician, using voice input (Web Speech API), touch, or document OCR (Tesseract.js). The system surfaces red-flag emergencies in real-time to a clinician dashboard and records both Allopathic triage and AYUSH Dashavidha Pariksha assessments — all persisted to Supabase with full data provenance tagging.

---

## 🏗️ Architecture (As Built)

```
┌──────────────────────────────────────────────────────────────────┐
│                        PATIENT KIOSK                             │
│  React 18 + Vite + TypeScript                                    │
│  ├─ Multilingual UI (English / Hindi)                            │
│  ├─ ASR: Web Speech API (primary) → Sarvam ASR (fallback)        │
│  ├─ TTS: Web Speech Synthesis (primary) → Sarvam TTS (fallback)  │
│  ├─ OCR: Tesseract.js client-side (primary) → Sarvam Vision (fb) │
│  └─ Offline Buffer: IndexedDB via idb-keyval                     │
└─────────────────────────────┬────────────────────────────────────┘
                              │ HTTP / REST  (VITE_API_URL)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   MEDIKIOSK BACKEND API                          │
│  Node.js + Express + TypeScript  (Port 3001)                     │
│  ├─ Session & answer management (backend/src/index.ts)           │
│  ├─ 15 deterministic red-flag rules (backend/src/redflags.ts)    │
│  ├─ AYUSH deterministic reasoning (backend/src/ayushReasoning.ts)│
│  ├─ FHIR R4 Bundle generator (backend/src/fhir.ts)               │
│  ├─ Zod payload validation (backend/src/schemas/index.ts)        │
│  └─ Origin-based CSRF + bcrypt auth + rate limiting              │
└─────────────────────────────┬────────────────────────────────────┘
                              │ Supabase Client SDK + Realtime WS
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL + Realtime)               │
│  sessions · answers · ayush_assessments · red_flags              │
│  medical_history · documents · ocr_extractions · summaries       │
│  doctors · hospitals                                             │
└─────────────────────────────┬────────────────────────────────────┘
                              │ Realtime WebSocket subscriptions
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   DOCTOR TRIAGE DASHBOARD                        │
│  ├─ Live OPD queue with red-flag alerts (Supabase Realtime)      │
│  ├─ 9-section triage summary with provenance badges              │
│  ├─ Inline fact verification → flips to doctor_entered           │
│  └─ One-click FHIR R4 Bundle export                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack (As Built — Not Aspirational)

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | React 18 + Vite + TypeScript | |
| Styling | TailwindCSS + Lucide Icons | Custom sand/forest Ayurvedic theme |
| ASR (speech input) | **Sarvam Saaras v3** (primary) | Web Speech API (fallback) |
| TTS (readback) | **Sarvam Bulbul v3** | Web Speech Synthesis fallback |
| OCR (document scan) | **Sarvam Doc AI** (primary) | Tesseract.js client-side fallback |
| Translation | **Sarvam Mayura v1** | Multilingual translation engine |
| Local LLM | **MedGemma 1.5** via Ollama | Local clinical AI reasoning & triage |
| Cloud LLM | **Gemini 3.6 Flash** | RAG reasoning & off-script Q&A |
| RAG Engine | **Supabase pgvector + Gemini Embeddings** | AYUSH classical text retrieval |
| Offline storage | `idb-keyval` (IndexedDB) | Auto-flushes to backend on reconnect |
| Backend runtime | Node.js + Express + TypeScript | |
| Database | Supabase (PostgreSQL + Realtime) | |
| Red flag engine | 15 deterministic rules + MedGemma AI | Safety & emergency detection |
| AYUSH reasoning | Classical RAG + Deterministic mapping | Dashavidha Pariksha assessment |
| Auth (doctor) | bcrypt password hash + Bearer token | Demo allowlist in `auth.ts` |
| FHIR export | FHIR R4 Bundle generator (`fhir.ts`) | Interoperability standard |
| Payload validation | Zod schemas (`schemas/index.ts`) | |
| **ABDM gateway** | **Simulated** | Format-correct, ready for NHA sandbox |

---

## ⚠️ Known Limitations & Design Decisions

1. **ABDM Sandbox**: ABDM M1/M2/M3 flows are simulated with format-valid payloads for offline/hackathon reliability.
2. **Local AI Hardware Requirements**: MedGemma 1.5 via Ollama requires ~4GB VRAM/RAM; automatically falls back to Gemini 3.6 Flash if Ollama is not running.
3. **Storage Security**: Session data is purged every 24 hours in compliance with DPDP Act 2023.

---

## 🎮 Demo Instructions

### Local Demo (One Command)

One command starts everything (Ollama + MedGemma + backend + frontend):

```bash
npm run demo
```

**Requires:**
- Ollama installed ([ollama.com](https://ollama.com))
- `medgemma1.5:latest` model pulled (`ollama pull medgemma1.5:latest`)

To stop cleanly:
```bash
npm run demo:stop
```

---

### Patient Kiosk Flow
1. Open **http://localhost:5173/** — this is the Hospital Admin / entry point
2. Or go directly to **http://localhost:5173/welcome** → choose language + hospital
3. **Flow order:**
   - `/welcome` → Language & hospital selection
   - `/notice` → DPDP Data Fiduciary Notice (mandatory)
   - `/consent` → Patient consent (4 checkboxes)
   - `/chief-complaint` → Select chief complaint
   - `/interview` → Adaptive follow-up questions
   - `/medical-history` → Conditions, medications, allergies
   - `/ayush-assessment` → 12-dimension Dashavidha Pariksha
   - `/records-upload` → Optional: upload prescriptions (Tesseract OCR)
   - `/preview` → Review before submit
   - `/submitted` → Token issued

### Doctor Dashboard
- **URL:** http://localhost:5173/doctor/login
- **Email:** `doctor@demo.com`
- **Password:** `demo123`
- *(Or click "Quick Dev Access" for instant bypass — dev only)*
- After login: http://localhost:5173/doctor/dashboard
- Click any patient card → http://localhost:5173/doctor/triage/:sessionId

### Patient Portal (Visit History)
- **URL:** http://localhost:5173/patient/login
- Enter ABHA/Aadhaar ID to look up visit history + download FHIR bundles

### Triggering a Red Flag (Demo)
1. Complete patient flow with "Chest pain" as chief complaint
2. On the severity question, select **"7-10 Severe"** → triggers Rule R1
3. Doctor dashboard will update **without manual refresh** (Supabase Realtime)

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```env
PORT=3001
SUPABASE_URL=           # Required: your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=  # Required: service role key (not anon)

SARVAM_API_KEY=         # Optional: enables Sarvam ASR/TTS/Vision fallback
GEMINI_API_KEY=         # Optional: enables AI clinical summaries
DEMO_AUTH_TOKEN=        # Optional: custom demo bearer token (default: medikiosk-demo-token)
FRONTEND_URL=           # Optional: comma-separated allowed CORS origins
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:3001   # Backend URL
VITE_SUPABASE_URL=                   # Same Supabase project URL
VITE_SUPABASE_ANON_KEY=              # Supabase anon key (public)
```

---

## 🚀 Local Dev Setup

### 1. Install Dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure Supabase
1. Create a Supabase project at https://supabase.com
2. Open **SQL Editor** → run `backend/schema.sql` to create all tables
3. If updating an existing DB, also run `backend/migrations/02_ayush_reasoning.sql`
4. Enable Realtime on tables: `sessions`, `answers`, `red_flags`, `medical_history`

### 3. Set Environment Variables
Copy the templates above into `backend/.env` and `frontend/.env`, filling in your Supabase URL and keys.

### 4. Start Development Servers
```bash
# Terminal 1: Backend
cd backend
npm run dev
# → http://localhost:3001

# Terminal 2: Frontend  
cd frontend
npm run dev
# → http://localhost:5173
```

### 5. Run Tests
```bash
cd backend
npm run test        # 17 tests, 3 suites — all should pass
npx tsc --noEmit    # TypeScript check
cd ../frontend
npx tsc --noEmit
npm run lint
```

---

## ✅ What's Implemented vs Future Work

### Implemented
- [x] Multilingual patient kiosk UI (English + Hindi)
- [x] Voice input via **Web Speech API** (browser-native, no API key needed)
- [x] TTS readback via **Web Speech Synthesis**
- [x] Document OCR via **Tesseract.js** (runs in-browser, no API key needed)
- [x] 15 deterministic red-flag rules (`backend/src/redflags.ts`)
- [x] Red-flag realtime alert to doctor dashboard (Supabase Realtime on `red_flags` table)
- [x] AYUSH Dashavidha Pariksha — all 12 dimensions (`frontend/src/pages/AyushFlow.tsx`)
- [x] AYUSH deterministic clinical reasoning (`backend/src/ayushReasoning.ts`)
- [x] DPDP Act — Data Fiduciary Notice before consent (`frontend/src/pages/Kiosk/DataFiduciaryNotice.tsx`)
- [x] 4-checkbox patient consent with right to erasure
- [x] Doctor triage dashboard with 9-section clinical summary
- [x] Provenance badges (`patient_reported`, `doctor_entered`, `ocr_extracted`, `system_derived`)
- [x] Inline fact verification by doctor
- [x] FHIR R4 Bundle export (`backend/src/fhir.ts`)
- [x] Offline-first IndexedDB buffering with sync-on-reconnect
- [x] 10-minute session idle timeout with 30-second warning modal
- [x] bcrypt password hashing for doctor accounts
- [x] Zod payload validation on all POST/PATCH endpoints
- [x] Origin-based CSRF protection
- [x] Rate limiting on auth and AI routes
- [x] Patient portal — ABHA-based visit history + FHIR download
- [x] Admin — hospital management
- [x] ABHA/Aadhaar format simulation (standards-compliant, no live NHA)

### Deferred (Future Work)
- [ ] **LLM integration** — MedGemma, AyurParam, RAG pipeline (explicitly deferred)
- [ ] **Sarvam ASR/TTS** as primary (currently fallback; needs `SARVAM_API_KEY`)
- [ ] **Live ABDM/ABHA gateway** — currently simulated
- [ ] **ABHA Health Records** write-back to national registry
- [ ] **JWT authentication** — current auth uses allowlisted

## 🛠️ Tech Stack (As Built — Not Aspirational)

- **Frontend**: React 18, Vite, TypeScript, TailwindCSS, Lucide Icons, Web Speech API
- **Backend**: Node.js, Express, TypeScript, Zod, bcrypt, node-cron
- **AI & Orchestration Layer**:
  - **Sarvam AI**: Multi-lingual Indian voice ASR, Document OCR, and TTS voice guidance (`hi-IN`, `en-IN`, etc.)
  - **Google Gemini 3.6 Flash**: Multi-lingual clinical entity extraction & RAG classical text translation
  - **MedGemma**: Open-weights clinical model for off-script symptom reasoning & semantic emergency red-flag checking
  - **Classical AYUSH RAG Engine**: Vector store pre-seeded with classical Charaka & Sushruta Samhita texts
- **Database & Realtime**: Supabase (PostgreSQL + Realtime WebSocket subscriptions)

---

## 🚀 Quick Start / Local Demo

Start the complete MediKiosk stack (Backend + Frontend) in one command:

```bash
npm run demo
```

Verify service status:
- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001/health` → `{"status":"ok"}`

---

## 🔐 Environment Variables

Key variables required in `backend/.env` (no sensitive keys exposed):
```env
PORT=3001
FRONTEND_URL=http://localhost:5173,http://localhost:3000
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SARVAM_API_KEY=<your-sarvam-api-key>
GEMINI_API_KEY=<your-gemini-api-key>
DEMO_AUTH_TOKEN=medikiosk-demo-token
```

---

## ⚠️ Known Limitations

1. **ABDM is simulated** — ABHA IDs are format-correct but return simulated sandbox responses when live credentials are not configured
2. **PII in localStorage** — Patient name, phone, age, gender are stored in browser localStorage for session continuity (demo limitation; see `.agent/decisions.md`)
3. **Handwritten Hindi OCR** — Tesseract.js fallback performs poorly on handwritten Devanagari prescriptions; printed text & Sarvam Vision work best
4. **Auth is demo-grade** — Doctor auth uses a hardcoded token allowlist (`mock-doctor-token`); not JWT in demo environment
5. **CSRF is prototype-grade** — Origin-matching header check; production requires signed anti-CSRF tokens
6. **No SMS OTP** — Phone verification is simulated for kiosk demo convenience
7. **Single-node backend** — Supabase handles DB concurrency; single process Express server

---

## 🔒 Security Architecture

| Control | Implementation | File |
|---|---|---|
| Password hashing | bcrypt, 10 salt rounds | `backend/src/index.ts` |
| API auth | Bearer token (demo allowlist) | `backend/src/middleware/auth.ts` |
| Payload validation | Zod schemas, strict parse | `backend/src/schemas/index.ts` |
| CSRF | Origin-header matching (prototype) | `backend/src/index.ts` |
| Rate limiting | In-memory token bucket | `backend/src/index.ts` |
| Security headers | nosniff, DENY frame, XSS | `backend/src/index.ts` |
| CORS | Explicit origin allowlist | `backend/src/index.ts` |
| Input sanitization | Adversarial delimiter stripping | `backend/src/index.ts` |

---

## 🏛️ Compliance

- **DPDP Act (India):** Data Fiduciary Notice displayed before consent; right-to-erasure endpoint (`DELETE /api/sessions/:id`)
- **Clinical Safety:** 15 red-flag rules triggering immediate doctor alert; zero-tolerance pattern for cardiac, neurological, and psychiatric emergencies
- **FHIR R4:** Bundle export for ABDM interoperability
- **Data Provenance:** Every clinical fact tagged with source (`patient_reported`, `doctor_entered`, `ocr_extracted`, `system_derived`)

---

## 📁 Key Source Files

| Feature | File |
|---|---|
| Backend entry point + all API routes | `backend/src/index.ts` |
| Red-flag engine (15 rules) | `backend/src/redflags.ts` |
| AYUSH reasoning engine | `backend/src/ayushReasoning.ts` |
| FHIR R4 generator | `backend/src/fhir.ts` |
| Zod validation schemas | `backend/src/schemas/index.ts` |
| Auth middleware | `backend/src/middleware/auth.ts` |
| DB schema (full) | `backend/schema.sql` |
| Patient kiosk routes | `frontend/src/App.tsx` |
| DPDP Notice | `frontend/src/pages/Kiosk/DataFiduciaryNotice.tsx` |
| AYUSH flow (12 dimensions) | `frontend/src/pages/AyushFlow.tsx` |
| Doctor dashboard | `frontend/src/pages/Doctor/DoctorDashboard.tsx` |
| Triage summary (9 sections) | `frontend/src/pages/TriageSummary.tsx` |

---

## 📚 Additional Docs

- Architecture diagram: [`medikiosk_technical_approach.html`](medikiosk_technical_approach.html)
- Decision log: [`.agent/decisions.md`](.agent/decisions.md)
- DB schema: [`backend/schema.sql`](backend/schema.sql)

---

## 🔮 Future Work & Roadmap

1. **Sign-Language AI Avatar**: Interactive 3D sign-language avatar for deaf/hard-of-hearing patients.
2. **Hospital Analytics Dashboard**: Real-time hospital operational intelligence (patient volume, red-flag frequency, AYUSH case-mix distribution).
3. **Live ABDM Sandbox Gateway**: Production integration with NHA ABDM M1/M2/M3 Sandbox APIs.
4. **Fine-Tuned AYUSH Model**: Domain-specific fine-tuned LLM for classical Ayurvedic, Unani, and Siddha literature retrieval.
5. **Multi-Hospital Analytics & Cross-OPD Telemetry**: Enterprise multi-facility OPD performance benchmarking.
- AYUSH reasoning migration: [`backend/migrations/02_ayush_reasoning.sql`](backend/migrations/02_ayush_reasoning.sql)
