# Project Analysis Summary

- **Last Analyzed**: 2026-09-16
- **Git Commit Hash**: `f118085510bdf2fa44785ee3ca5aaf5b4875c209`

---

## 1. Executive Summary & Purpose

**MediKiosk** is a touch- and voice-enabled clinical intake and triage kiosk platform developed for Indian hospital Outpatient Departments (OPDs), with specific clinical extensions for integrative medicine (Allopathy + AYUSH Dashavidha Pariksha).

The platform addresses high patient volume and language barriers in Indian public hospitals by allowing patients to self-record structured medical histories in English or Hindi before seeing a physician. It provides real-time emergency screening via deterministic red-flag rules, extracts structured data from uploaded prescriptions via OCR, and surfaces a real-time triage summary dashboard to attending clinicians with full data provenance tracking and FHIR R4 export capability.

---

## 2. Architecture Overview

MediKiosk follows a micro-service and layered client-server architecture:

1. **Frontend Kiosk & Doctor Portal** (`frontend/src/`): React 19 / 18 SPA built with Vite and TypeScript. Includes patient kiosk flows (`/welcome`, `/notice`, `/consent`, `/chief-complaint`, `/interview`, `/ayush-assessment`, `/records-upload`, `/preview`) and doctor triage dashboard (`/doctor/dashboard`, `/doctor/triage/:sessionId`). Supports IndexedDB offline buffering (`idb-keyval`).
2. **Backend Express API** (`backend/src/`): Express 5 server on Node.js 22. Manages session lifecycles, Zod schema validations, authentication (`bcryptjs`), real-time emergency evaluation (`redflags.ts`), AYUSH classical RAG reasoning (`ayushRag.ts`), and FHIR bundle generation (`fhir.ts`).
3. **AI & Speech Orchestration Router** (`backend/src/orchestration/router.ts`): Unified task router coordinating calls across:
   - **Sarvam AI**: Saaras v3 ASR, Bulbul v3 TTS, Doc AI digitise OCR, Mayura v1 Translation.
   - **Local MedGemma LLM**: `medgemma1.5:latest` via local Ollama instance for local red-flag and off-script Q&A.
   - **Google Gemini Cloud LLM**: Gemini 3.6 Flash / 3.5 Flash for RAG synthesis, ICD-10 suggestions, entity extraction, and fallback.
4. **Data & Vector Storage** (`Supabase PostgreSQL + pgvector`): Stores relational session tables (`sessions`, `answers`, `ayush_assessments`, `medical_history`, `documents`, `summaries`, `consent_logs`, `audit_logs`) and 768-dimensional embeddings in `rag_chunks` for RAG retrieval. Pushes live updates via Supabase WebSocket Realtime publications.
5. **Indic Speech Recognition Toolkit** (`models/polywhisper/`): Standalone PolyWhisper ASR system using frozen Whisper-Small with rank-16 per-language LoRA adapters for Hindi, Tamil, Telugu, Bengali, and Marathi, with INT8 ONNX graph export support.

---

## 3. Technology Stack Summary

| Layer | Primary Technology | Auxiliary / Fallback Technology |
|---|---|---|
| **Frontend UI** | React 19 + Vite 8 + TypeScript | TailwindCSS + Lucide Icons + Radix UI Slot |
| **Client Storage** | IndexedDB via `idb-keyval` | Web Speech API / Web Speech Synthesis |
| **Backend Framework** | Node.js 22 + Express 5 + TypeScript | Zod + `bcryptjs` + CORS + Multer |
| **Database** | Supabase (PostgreSQL 15) | Realtime WebSockets (`supabase_realtime`) |
| **Vector Search / RAG** | Supabase `pgvector` (`rag_chunks`) | Cosine similarity scoring (`retriever.ts`) |
| **Speech-to-Text (ASR)** | Sarvam AI Saaras v3 | PolyWhisper v9 / Web Speech API |
| **Text-to-Speech (TTS)** | Sarvam AI Bulbul v3 | Web Speech Synthesis |
| **Document OCR** | Sarvam Doc AI digitise | Tesseract.js client-side WebAssembly |
| **Local Clinical AI** | MedGemma 1.5 via Ollama | Gemini 3.6 Flash / 3.5 Flash |
| **Interoperability** | HL7 FHIR R4 Bundle (`fhir.ts`) | Simulated ABDM M1/M2/M3 Services |

---

## 4. End-to-End Workflow Summary

```
[Patient Kiosk Intake]
   ├── 1. DPDP Notice & Consent (/notice, /consent)
   ├── 2. Chief Complaint Selection (/chief-complaint)
   ├── 3. Adaptive Interview (/interview) -> Sarvam ASR / Voice-Match
   ├── 4. 15 Deterministic Red-Flag Rules (redflags.ts) -> Auto-Flag Emergencies
   ├── 5. 12-Dimension AYUSH Assessment -> Classical RAG Retrieval (ayushRag.ts)
   ├── 6. Prescription Document Upload -> OCR & Gemini Entity Extraction
   └── 7. Submission -> Generates Summary & Session Token
            │
            ▼ (Supabase Realtime WebSockets)
[Doctor Triage Dashboard]
   ├── 1. Live OPD Patient Queue with Red-Flag Indicators
   ├── 2. 9-Section Clinical Summary with Provenance Badges
   ├── 3. Inline Fact Verification (flips to 'doctor_entered')
   ├── 4. One-Click HL7 FHIR R4 Bundle Export
   └── 5. ABDM Care Context Linkage
```

---

## 5. Datasets Found in Repository

1. **OPD Clinical Dialogues Dataset** ([`training/opd_dialogues.jsonl`](file:///c:/game/pythoncoding/New%20folder/hackathon/training/opd_dialogues.jsonl)): Synthetic Indian OPD doctor-patient clinical dialogues for QLoRA fine-tuning.
2. **Ayurveda / Traditional Medicine to ICD-10 Bridge Dataset** ([`rag_corpus/raw/ayurveda_icd/`](file:///c:/game/pythoncoding/New%20folder/hackathon/rag_corpus/raw/ayurveda_icd/)): 3,002 rows (`AmareshHebbar/ayurveda-icd-sft`) mapping Ayurvedic concepts to ICD-10 CM codes.
3. **Indian Vedas and Ayurveda Corpus** ([`rag_corpus/raw/vedas/continueousPreTrainData.jsonl`](file:///c:/game/pythoncoding/New%20folder/hackathon/rag_corpus/raw/vedas/continueousPreTrainData.jsonl)): 39.51 MB continuous pre-training corpus containing Rig, Sama, Yajur, Atharva Veda, Charaka Samhita, Sushruta Samhita, Rasa Jala Nidhi, and IRJAY articles.
4. **IndicVoices-ST & FLEURS Speech Benchmarks** ([`models/polywhisper/README.md`](file:///c:/game/pythoncoding/New%20folder/hackathon/models/polywhisper/README.md)): Multilingual ASR training and evaluation speech datasets (`ai4bharat/indicvoices-st` and `google/fleurs`).

---

## 6. Key Project Strengths

1. **Robust Deterministic Safety Layer**: 15 deterministic red-flag emergency rules execute synchronously *before* AI model calls, ensuring critical emergencies (chest pain radiation, severe fever, stroke symptoms, suicidal ideation) are flagged without LLM hallucination risks.
2. **Data Provenance & Audit Trail**: Every clinical fact stores a `provenance` tag (`patient_reported`, `ocr_extracted`, `system_derived`, `doctor_entered`), ensuring full auditability during clinician review.
3. **Integrative Healthcare Support**: Blends Allopathy triage with AYUSH 12-dimension Dashavidha Pariksha, backed by vector RAG retrieval over classical texts.
4. **Multimodal Orchestration & Failover**: Architecture smoothly degrades from Sarvam AI -> MedGemma -> Gemini -> local rule-based fallbacks.
5. **Standards Interoperability**: Native FHIR R4 bundle generation and ABDM M1/M2/M3 specification compliance.

---

## 7. Gaps & Missing Information

### README vs. Code Discrepancies
- Root `README.md` states "Web Speech API (primary) -> Sarvam ASR (fallback)", whereas backend orchestration router (`backend/src/orchestration/router.ts`) uses **Sarvam Saaras v3** as primary server ASR.
- Root `README.md` lists `backend/src/index.ts` as the Express entry point, but `backend/package.json` and actual backend code use `backend/src/index.ts` to launch `app.ts` (with `app.ts` housing express routes).

### Database Schema Organization
- Root workspace contains loose SQL scripts (`add_missing_columns.sql`, `local_schema_updates.sql`, `survival_migration.sql`) alongside `backend/schema.sql` and `backend/migrations/`.

---

## 8. Missing Files

The following files or paths are referenced in code or README files but do not exist in the repository tree:

1. `polywhisper_output/data/audio_fleurs_hi_in/000000.wav` - Referenced as example audio in [`models/polywhisper/app.py:L279`](file:///c:/game/pythoncoding/New%20folder/hackathon/models/polywhisper/app.py#L279).
2. `polywhisper_output/data/audio_fleurs_ta_in/000000.wav` - Referenced as example audio in [`models/polywhisper/app.py:L280`](file:///c:/game/pythoncoding/New%20folder/hackathon/models/polywhisper/app.py#L280).
3. `models/polywhisper/samples/` - Referenced as `SAMPLE_AUDIO_DIR` in [`models/polywhisper/app.py:L32`](file:///c:/game/pythoncoding/New%20folder/hackathon/models/polywhisper/app.py#L32).
4. `./medikiosk-model/` - Output directory path for saved QLoRA fine-tuned weights referenced in [`training/qlora_finetune.py:L22`](file:///c:/game/pythoncoding/New%20folder/hackathon/training/qlora_finetune.py#L22) (created post-training).

---

## 9. Recommendations for Production Readiness

1. **Consolidate SQL Migrations**: Move root `.sql` scripts into `backend/migrations/` with sequential numerical prefixes (`05_...sql`).
2. **Replace ABDM Simulation with Sandbox Keys**: Provide actual NHA gateway client credentials (`ABDM_CLIENT_ID` and `ABDM_CLIENT_SECRET`) to convert simulated ABDM flows into live sandbox integration.
3. **Package Sample Audio Files**: Add sample `.wav` clips into `models/polywhisper/samples/` so that the Gradio app examples load without path errors.
4. **Unify Environment Templates**: Synchronize `.env.example` across backend and frontend to include all active variables (`OLLAMA_URL`, `GEMINI_MODEL`, `FRONTEND_URL`).
