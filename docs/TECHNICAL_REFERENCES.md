# Technical References

- **Last Analyzed**: 2026-09-16
- **Git Commit Hash**: `f118085510bdf2fa44785ee3ca5aaf5b4875c209`

---

## 1. Regulatory, Data, and Interoperability Standards

### 1.1 HL7 FHIR R4 (Fast Healthcare Interoperability Resources)
- **Description**: Standard specification for electronic health record exchange. Used to map patient demographic, clinical complaint, AYUSH assessment, and consent data into an interoperable JSON bundle.
- **Why Relevant**: Enables seamless integration with hospital information systems (HIS) and National Health Authority (NHA) registries.
- **Where Used**: [`backend/src/fhir.ts:L3-L157`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/fhir.ts#L3-L157), [`backend/src/app.ts:L185-L193`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/app.ts#L185-L193).
- **Citation / Link**: [HL7 FHIR Release 4 Standard](https://hl7.org/fhir/R4/)

### 1.2 ABDM (Ayushman Bharat Digital Mission) Specs
- **Description**: Specifications for M1 (ABHA creation & Aadhaar OTP authentication), M2 (Care Context linking & FHIR transmission), and M3 (HIU consent flow).
- **Why Relevant**: Supports nationwide digital health ecosystem integration under NHA India.
- **Where Used**: [`backend/src/services/abdm.ts:L1-L260`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/services/abdm.ts#L1-L260), [`backend/src/routes/abdm.ts`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/routes/abdm.ts).
- **Citation / Link**: [ABDM Developer Portal](https://dev.abdm.gov.in/)

### 1.3 Digital Personal Data Protection (DPDP) Act 2023 & Right to Erasure
- **Description**: Indian data privacy framework mandating explicit patient consent logs and hard-deletion (Right to Erasure / consent revocation).
- **Why Relevant**: Ensures legal compliance for capturing health and demographic data in OPD kiosks.
- **Where Used**: [`backend/src/app.ts:L250-L279`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/app.ts#L250-L279), [`backend/src/routes/sessions.ts:L152-L163`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/routes/sessions.ts#L152-L163).
- **Citation / Link**: [DPDP Act 2023 Gazette Notification](https://meity.gov.in/content/digital-personal-data-protection-act-2023)

### 1.4 CMS FY2026 ICD-10-CM Coding System
- **Description**: International Classification of Diseases, Tenth Revision, Clinical Modification used to code clinical diagnoses and traditional medicine bridges.
- **Why Relevant**: Maps clinical summaries and traditional Ayurvedic conditions to standardized billing/diagnostic codes.
- **Where Used**: [`rag_corpus/raw/ayurveda_icd/README.md:L60-L64`](file:///c:/game/pythoncoding/New%20folder/hackathon/rag_corpus/raw/ayurveda_icd/README.md#L60-L64), [`backend/src/summary.ts:L153-L174`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/summary.ts#L153-L174).
- **Citation / Link**: [CMS ICD-10-CM Official Guidelines](https://www.cms.gov/medicare/coding-billing/icd-10-codes)

---

## 2. Artificial Intelligence & Machine Learning Architectures

### 2.1 Google Gemini LLM API (Gemini 3.6 Flash / 3.5 Flash)
- **Description**: Multimodal foundation model for RAG reasoning, document entity extraction, clinical summary generation, ICD-10 coding suggestions, and Hindi clinical translation.
- **Why Relevant**: Primary cloud LLM provider powering semantic triage and clinical summary generation.
- **Where Used**: [`backend/src/app.ts:L158-L160`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/app.ts#L158-L160), [`backend/src/rag/ayushRag.ts:L165-L215`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/rag/ayushRag.ts#L165-L215), [`backend/src/summary.ts:L136-L174`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/summary.ts#L136-L174), [`backend/src/clinicalAnalysis.ts:L12-L55`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/clinicalAnalysis.ts#L12-L55).
- **Citation / Link**: [Google Gemini API Documentation](https://ai.google.dev/docs)

### 2.2 MedGemma 1.5 (via Ollama Local Runtime)
- **Description**: Domain-adapted medical LLM (`medgemma1.5:latest`) executed via Ollama on local hardware.
- **Why Relevant**: Primary offline/local LLM for semantic red-flag detection and off-script Q&A before falling back to Gemini.
- **Where Used**: [`backend/src/orchestration/medgemmaClient.ts:L1-L24`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/orchestration/medgemmaClient.ts#L1-L24), [`backend/src/services/ollamaBootstrap.ts:L1-L56`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/services/ollamaBootstrap.ts#L1-L56).
- **Citation / Link**: TODO: verify official paper citation for MedGemma 1.5.

### 2.3 Sarvam AI API Suite
- **Description**: Sovereign Indic AI models:
  - **Saaras v3**: Multilingual Speech-to-Text (ASR) supporting Hindi, Tamil, Telugu, Bengali, Marathi, etc.
  - **Bulbul v3**: Multilingual Text-to-Speech (TTS).
  - **Doc AI Job Digitise**: Document OCR & structure parsing.
  - **Mayura v1**: Translation model between Indic languages and English.
- **Why Relevant**: Primary server-side Indic speech recognition, voice synthesis, document digitization, and translation.
- **Where Used**: [`backend/src/orchestration/sarvamClient.ts:L1-L119`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/orchestration/sarvamClient.ts#L1-L119), [`backend/src/orchestration/router.ts:L22-L58`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/orchestration/router.ts#L22-L58).
- **Citation / Link**: [Sarvam AI Developer Documentation](https://docs.sarvam.ai/)

### 2.4 PolyWhisper v9 (Whisper-Small + Per-Language LoRA)
- **Description**: Multilingual ASR system pairing a frozen OpenAI Whisper-Small backbone (244M params) with rank-16 per-language LoRA adapters (~14MB each) for Hindi, Tamil, Telugu, Bengali, and Marathi. Includes ONNX INT8 export capabilities for CPU edge inference.
- **Why Relevant**: Efficient local ASR toolkit tailored for Indic vernacular speech recognition.
- **Where Used**: [`models/polywhisper/app.py:L1-L319`](file:///c:/game/pythoncoding/New%20folder/hackathon/models/polywhisper/app.py#L1-L319), [`models/polywhisper/README.md:L1-L276`](file:///c:/game/pythoncoding/New%20folder/hackathon/models/polywhisper/README.md#L1-L276).
- **Citation / Link**:
  ```bibtex
  @misc{polywhisper2026,
    title  = {PolyWhisper: Efficient Multilingual Indic ASR via Frozen Backbone + Per-Language LoRA},
    author = {Eulogik},
    year   = {2026},
    publisher = {HuggingFace},
    url    = {https://huggingface.co/eulogik/polywhisper}
  }
  ```

### 2.5 Meta Llama-3-8B QLoRA SFT Fine-Tuning
- **Description**: 4-bit quantized Low-Rank Adaptation (QLoRA) using `bitsandbytes`, `peft`, `transformers`, and `trl.SFTTrainer` for fine-tuning causal language models on Indian OPD dialogues.
- **Why Relevant**: Reference pipeline for training custom specialized clinical dialogue LLMs.
- **Where Used**: [`training/qlora_finetune.py:L1-L122`](file:///c:/game/pythoncoding/New%20folder/hackathon/training/qlora_finetune.py#L1-L122).
- **Citation / Link**: Dettmers et al., *QLoRA: Efficient Finetuning of Quantized LLMs*, 2023. [arXiv:2305.14314](https://arxiv.org/abs/2305.14314)

### 2.6 Tesseract.js (v7.0.0)
- **Description**: Pure JavaScript OCR engine based on Tesseract C++ engine compiled to WebAssembly.
- **Why Relevant**: Client-side and offline fallback OCR engine for reading medical prescription images.
- **Where Used**: [`backend/src/app.ts:L15`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/app.ts#L15), [`backend/src/app.ts:L627`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/app.ts#L627), [`frontend/package.json:L25`](file:///c:/game/pythoncoding/New%20folder/hackathon/frontend/package.json#L25).
- **Citation / Link**: [Tesseract.js GitHub Repository](https://github.com/naptha/tesseract.js)

---

## 3. Traditional Ayurvedic Literature & Clinical Frameworks

### 3.1 Dashavidha Pariksha (10-Fold Clinical Assessment)
- **Description**: Classical Ayurvedic diagnostic framework evaluating Prakriti, Vikriti, Agni, Koshtha, Sara, Samhanana, Pramana, Satmya, Sattva, Ahara Shakti, Vyayama Shakti, and Vaya.
- **Why Relevant**: Forms the core structure for the 12-dimension AYUSH intake questionnaire and deterministic reasoning module.
- **Where Used**: [`backend/src/ayushReasoning.ts:L1-L150`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/ayushReasoning.ts#L1-L150), [`backend/src/rag/ayushRag.ts:L114-L126`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/rag/ayushRag.ts#L114-L126).
- **Source**: Charaka Samhita, Vimanasthana Chapter 8 (Rogabhishagjitiya Vimana).

### 3.2 Indian Vedas and Classical Ayurveda Corpus
- **Description**: Comprehensive text corpus comprising Rig Veda, Sama Veda, Yajur Veda, Atharva Veda, Charaka Samhita, Sushruta Samhita, Rasa Jala Nidhi, and IRJAY research articles.
- **Why Relevant**: Source raw materials indexed into vector storage for RAG retrieval during Ayush clinical reasoning.
- **Where Used**: [`rag_corpus/raw/vedas/README.md:L1-L151`](file:///c:/game/pythoncoding/New%20folder/hackathon/rag_corpus/raw/vedas/README.md#L1-L151), [`backend/src/rag/retriever.ts:L78-L86`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/rag/retriever.ts#L78-L86).
- **Citation / Link**:
  ```bibtex
  @misc{vedas_ayurveda_corpus_2026,
    title = {Indian Vedas and Ayurveda Corpus},
    year = {2026},
    publisher = {HuggingFace}
  }
  ```

---

## 4. Missing Technical References / TODO
- **TODO: verify** DOI for MedGemma 1.5 paper when published.
- **TODO: verify** Official NHA ABDM OpenAPI 3.0 YAML specification URL.
- **TODO: verify** Exact publication details for PolyWhisper v9 conference or preprint submission.
