# Datasets Documentation

- **Last Analyzed**: 2026-09-16
- **Git Commit Hash**: `f118085510bdf2fa44785ee3ca5aaf5b4875c209`

---

## Dataset Inventory Summary

The repository includes, processes, or references four distinct dataset collections covering clinical OPD dialogues, traditional Ayurvedic text collections, ICD-10 medical code mappings, and multilingual ASR benchmarks.

---

## 1. OPD Clinical Dialogues Dataset (Synthetic)

- **Name**: Indian OPD Clinical Intake & Triage Dialogues
- **Type**: Synthetic Text (JSONL format)
- **Source / URL**: Local repo file [`training/opd_dialogues.jsonl`](file:///c:/game/pythoncoding/New%20folder/hackathon/training/opd_dialogues.jsonl)
- **Version / Hash**: TODO: verify commit snapshot
- **License**: TODO: verify repository license (MIT)
- **Size**: 1.46 KB (Sample demonstration set)
- **Format**: JSON Lines (`.jsonl`)
- **Local Path**: [`training/opd_dialogues.jsonl`](file:///c:/game/pythoncoding/New%20folder/hackathon/training/opd_dialogues.jsonl)
- **Download / Access Instructions**: Included directly in repository.
- **Preprocessing Steps**: Formatted into Llama 3 ChatML / instruction prompt structure via `format_prompt()` in [`training/qlora_finetune.py:L58-L69`](file:///c:/game/pythoncoding/New%20folder/hackathon/training/qlora_finetune.py#L58-L69).
- **Train / Validation / Test Splits**:
  - Train: 100% (Demonstration split loaded via `load_dataset("json", data_files="opd_dialogues.jsonl", split="train")`)
  - Validation / Test: None
- **Columns / Features / Labels**:
  - `system`: System instruction defining clinical role & triage guidelines.
  - `user`: Patient chief complaint and symptom inputs.
  - `assistant`: Structured clinical assistant triage response.
- **Target Variable**: `assistant` text (causal language modeling target).
- **Where Used in Code**: [`training/qlora_finetune.py:L21`](file:///c:/game/pythoncoding/New%20folder/hackathon/training/qlora_finetune.py#L21), [`training/qlora_finetune.py:L77`](file:///c:/game/pythoncoding/New%20folder/hackathon/training/qlora_finetune.py#L77).
- **Model / Task it Supports**: Meta-Llama-3-8B QLoRA fine-tuning for Indian hospital OPD clinical history taking.
- **Citation**: Synthetic dataset generated for hackathon demonstration.
- **Privacy / Ethical Notes**: 100% synthetic clinical data; contains zero real patient Personally Identifiable Information (PII) or Protected Health Information (PHI).

---

## 2. Ayurveda / Traditional Medicine to ICD-10 Bridge Dataset

- **Name**: `AmareshHebbar/ayurveda-icd-sft` (AxisMapper Medical AI Suite)
- **Type**: Text (JSONL format)
- **Source / URL**: [Hugging Face Dataset - AmareshHebbar/ayurveda-icd-sft](https://huggingface.co/datasets/AmareshHebbar/ayurveda-icd-sft)
- **Version / Hash**: CMS FY2026 ICD-10-CM release baseline
- **License**: Apache 2.0 ([`rag_corpus/raw/ayurveda_icd/README.md:L2`](file:///c:/game/pythoncoding/New%20folder/hackathon/rag_corpus/raw/ayurveda_icd/README.md#L2))
- **Size**: 1.64 MB total across splits (3,002 rows)
- **Format**: JSON Lines (`.jsonl`)
- **Local Path**: [`rag_corpus/raw/ayurveda_icd/`](file:///c:/game/pythoncoding/New%20folder/hackathon/rag_corpus/raw/ayurveda_icd/)
  - [`train.jsonl`](file:///c:/game/pythoncoding/New%20folder/hackathon/rag_corpus/raw/ayurveda_icd/train.jsonl) (1.31 MB)
  - [`validation.jsonl`](file:///c:/game/pythoncoding/New%20folder/hackathon/rag_corpus/raw/ayurveda_icd/validation.jsonl) (162 KB)
  - [`test.jsonl`](file:///c:/game/pythoncoding/New%20folder/hackathon/rag_corpus/raw/ayurveda_icd/test.jsonl) (165 KB)
- **Download / Access Instructions**:
  ```python
  from datasets import load_dataset
  ds = load_dataset("AmareshHebbar/ayurveda-icd-sft")
  ```
- **Preprocessing Steps**: Extracted from public CMS ICD-10-CM Z-codes (health status) and Y-codes (external causes) mapped to traditional Indian medicine terms (Ayurveda, Unani, Siddha, Homeopathy). Formatted as ChatML `messages` list.
- **Train / Validation / Test Splits**:
  - Train: 2,401 rows
  - Validation: 300 rows
  - Test: 301 rows
  - Total: 3,002 rows
- **Columns / Features / Labels**:
  - `messages`: List of chat objects `[{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]`
- **Target Variable**: Assistant message containing ICD-10-CM code, description, and clinical context notes.
- **Where Used in Code**: Parsed by [`backend/src/rag/parse.ts`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/rag/parse.ts) and indexed into vector storage for RAG retrieval during Ayush clinical reasoning.
- **Model / Task it Supports**: Integrative medicine clinical documentation, ABDM ABHA health records integration, and ICD-10 automated coding.
- **Citation**:
  ```bibtex
  @misc{axiomapper2026,
    author    = {Hebbar, Amaresh},
    title     = {AxisMapper: Medical AI Fine-tuning Dataset Suite},
    year      = {2026},
    publisher = {HuggingFace},
    url       = {https://huggingface.co/collections/AmareshHebbar/axiomapper-medical-ai-suite}
  }
  ```
- **Privacy / Ethical Notes**: Extracted strictly from public CMS guidelines and medical coding reference standards; no personal health records used.

---

## 3. Indian Vedas and Ayurveda Corpus

- **Name**: Indian Vedas and Ayurveda Continuous Pre-Training Corpus
- **Type**: Multilingual Text (Sanskrit `sa`, English `en`, Hindi `hi`)
- **Source / URL**: Multi-source digital humanities collections (Griffith, Keith, Gulabkunverba Ayurvedic Society, Bhishagratna, Mookerji, IRJAY journal articles)
- **Version / Hash**: Public domain digital translations
- **License**: Public Domain / Open Educational (`license_name: public-domain` in [`rag_corpus/raw/vedas/README.md:L3`](file:///c:/game/pythoncoding/New%20folder/hackathon/rag_corpus/raw/vedas/README.md#L3))
- **Size**: 39.51 MB (`continueousPreTrainData.jsonl`)
- **Format**: Single unified JSON Lines file (`.jsonl`)
- **Local Path**: [`rag_corpus/raw/vedas/continueousPreTrainData.jsonl`](file:///c:/game/pythoncoding/New%20folder/hackathon/rag_corpus/raw/vedas/continueousPreTrainData.jsonl)
- **Download / Access Instructions**: Included in local repo directory.
- **Preprocessing & Chunking Strategy**:
  - **Vedic Texts (Rig, Sama, Yajur, Atharva Veda)**: Chunked at Hymn (Sukta), Anuvaka, or Verse granularity.
  - **Ayurvedic Samhitas (Charaka, Sushruta, Rasa Jala Nidhi)**: Chunked at Chapter / Section level.
  - **IRJAY Research Papers**: Page-level chunking with 150-character overlap.
- **Train / Validation / Test Splits**: Single continuous pre-training / RAG retrieval split (~10K to ~100K records).
- **Columns / Features / Labels**:
  - `text`: Structured payload formatted with collection title, translator, chapter/sutra heading, and translation text payload.
- **Target Variable**: Unsupervised text / RAG context retrieval payload.
- **Where Used in Code**: Parsed by [`backend/src/rag/parse.ts`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/rag/parse.ts), chunked in [`backend/src/rag/chunk.ts`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/rag/chunk.ts), embedded via Gemini API (`embed.ts`), and queried by [`backend/src/rag/retriever.ts`](file:///c:/game/pythoncoding/New%20folder/hackathon/backend/src/rag/retriever.ts).
- **Model / Task it Supports**: Classical Ayush RAG reasoning engine (`ayushRag.ts`), VedaGPT domain pre-training.
- **Citation**: Rig Veda (Ralph T.H. Griffith 1896), Black Yajur Veda (Arthur Berriedale Keith 1914), Sushruta Samhita (Kaviraj Kunja Lal Bhishagratna 1907), Rasa Jala Nidhi (Rasacharya Kaviraj Bhudeb Mookerji 1926).
- **Privacy / Ethical Notes**: Ancient historical and classical literature; no ethical or privacy constraints.

---

## 4. IndicVoices-ST & FLEURS Speech Datasets (PolyWhisper ASR)

- **Name**: `ai4bharat/indicvoices-st` (Training) & `google/fleurs` (Evaluation)
- **Type**: Audio Speech (.wav) & Transcripts (.txt)
- **Source / URL**:
  - [Hugging Face Datasets - ai4bharat/indicvoices-st](https://huggingface.co/datasets/ai4bharat/indicvoices-st)
  - [Hugging Face Datasets - google/fleurs](https://huggingface.co/datasets/google/fleurs)
- **Version / Hash**: FLEURS Benchmark release
- **License**: Creative Commons Attribution (CC-BY)
- **Size**: ~19k–20k clips per language for IndicVoices-ST
- **Format**: Audio 16kHz WAV + UTF-8 transcript strings
- **Local Path**: External datasets loaded during model training (eval evaluation outputs saved in [`models/polywhisper/eval_*.json`](file:///c:/game/pythoncoding/New%20folder/hackathon/models/polywhisper/))
- **Download / Access Instructions**:
  ```python
  from datasets import load_dataset
  fleurs_hi = load_dataset("google/fleurs", "hi_in")
  indicvoices_hi = load_dataset("ai4bharat/indicvoices-st", "hi")
  ```
- **Preprocessing Steps**: SpecAugment time/frequency masking + 0.9x/1.1x speed perturbation applied selectively to hard languages (Bengali `bn`, Marathi `mr`), clean training for `hi`/`ta`.
- **Train / Validation / Test Splits**: Standard FLEURS train/dev/test splits for Hindi (`hi_in`), Tamil (`ta_in`), Telugu (`te_in`), Bengali (`bn_in`), and Marathi (`mr_in`).
- **Columns / Features / Labels**:
  - Audio array (16,000 Hz float32 waveform)
  - Transcription text label
- **Target Variable**: Audio transcription string.
- **Where Used in Code**: Reference benchmark configs and evaluation files in [`models/polywhisper/README.md`](file:///c:/game/pythoncoding/New%20folder/hackathon/models/polywhisper/README.md) and [`models/polywhisper/baselines_resumable.py`](file:///c:/game/pythoncoding/New%20folder/hackathon/models/polywhisper/baselines_resumable.py).
- **Model / Task it Supports**: PolyWhisper ASR per-language LoRA adapter training & FLEURS word error rate (WER) benchmarking.
- **Citation**:
  ```bibtex
  @inproceedings{fleurs2022,
    title={FLEURS: Few-shot Learning Evaluation of Universal Representations of Speech},
    author={Conneau, Alexis and et al.},
    booktitle={IEEE SLT},
    year={2022}
  }
  ```
- **Privacy / Ethical Notes**: Open CC-BY licensed datasets recorded with contributor consent.
