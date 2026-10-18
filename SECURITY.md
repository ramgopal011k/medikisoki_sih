# MediKiosk Security Posture & Architecture Disclosure

> **Notice for Hackathon Judges & Evaluators**  
> **Build Environment:** Hackathon Demonstration / Prototype  
> **Status:** Active Demo Build with Critical Hardening Applied

---

## 1. Prototype Context & Architecture Scope

The current deployment of **MediKiosk** represents a functional **Hackathon Demo Build** engineered to showcase multi-lingual kiosk-based intake, autonomous clinical history extraction, dynamic tree follow-ups, and on-device MedGemma clinical reasoning.

- **Demo Authentication Mode (`ALLOW_DEMO_MOCK_AUTH=true`):**  
  To allow seamless judge evaluation, local offline execution, and frictionless interface walkthroughs without requiring judges to register phone numbers, pass multi-factor verification, or pre-seed clinical credentials in a remote database, demo authentication tokens (e.g. `mock-doctor-token`, `medikiosk-demo-token`) are supported when this environment flag is explicitly enabled.
- **Production Flag Separation:** In production deployments, `ALLOW_DEMO_MOCK_AUTH` is strictly set to `false`, disabling all mock tokens and enforcing cryptographically signed JSON Web Tokens (HS256) issued through verified provider authentication.

---

## 2. Synthetic Data Disclosure (Zero Real PII)

- **100% Synthetic Patient Records:**  
  **No real patient data or protected health information (PHI) is collected, stored, or processed anywhere within this repository or associated databases.**
- **Simulated Identifiers:**  
  All ABHA numbers (e.g. `91-0000-0000-0001`), Aadhaar numbers, and patient demographics are purely synthetic seed values adhering to ABDM format standards for testing and interoperability compliance.
- **Synthetic Medical Artifacts:**  
  All lab reports and clinical prescriptions utilized in OCR evaluation are synthetically generated mock documents.

---

## 3. Implemented Security Controls (Emergency Hardening)

As part of continuous security hardening, the following controls have been implemented:

1. **Zero Hardcoded Secrets:**  
   - All legacy fallback keys have been removed from source code (`supabase.ts`, `auth.ts`).
   - The backend service throws a fatal initialization exception if `SUPABASE_SERVICE_ROLE_KEY` or `JWT_SECRET` is missing from the environment.
2. **Locked Down Sensitive Endpoints:**  
   - `GET /api/fhir/:sessionId` — Protected with `requireAuth` middleware to prevent unauthenticated bundle downloads.
   - `POST /api/patient/visits/:sessionId/revoke` — Protected with `requireAuth` middleware to prevent unauthorized data purging / DPDPA erasure manipulation.
   - `POST /history-facts`, `POST /answers`, `POST /medical-history` — Protected with `requireAuth` to eliminate anonymous database poisoning.
3. **Defense-in-Depth Frontend Token Injection:**  
   - The frontend automatically passes bearer authentication tokens (`Authorization: Bearer <token>`) across all backend API calls via explicit headers and transparent browser fetch interception.
4. **Input Sanitization & Injection Defense:**  
   - Prompt sanitization (`sanitizePromptInput`) strips system instruction injections and markdown escapes before LLM reasoning prompts.
5. **Rate Limiting & Security Headers:**  
   - Helmet-style security headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options) applied globally.
   - Dedicated in-memory rate limiting applied on authentication routes (50 req/15m) and AI orchestration routes (60 req/min).

---

## 4. Production Security Roadmap (Q1)

For production deployment and hospital pilot environments, the following architecture milestones are scheduled:

1. **Database-Level Row Level Security (RLS):**  
   - Transition all database queries from backend service-role bypass to user-scoped Supabase RLS policies tied to JWT `sub` and `hospital_id` claims.
2. **ABDM Sandbox Integration:**  
   - Direct integration with the National Health Authority (NHA) ABDM M1/M2/M3 gateway using official public key infrastructure (PKI) and OTP verification.
3. **Session Ownership Cryptographic Tokens:**  
   - Issue temporary, cryptographically signed session tokens upon kiosk check-in that restrict write capabilities strictly to the active patient session ID.
4. **Comprehensive Zod Validation:**  
   - Expand strict schema validation from core AI, history-facts, answers, and medical-history endpoints to 100% of API endpoints.
5. **Encrypted At-Rest Field-Level PII:**  
   - AES-GCM client-side envelope encryption for all demographic identifiers prior to database persistence.
