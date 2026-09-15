---
license: apache-2.0
language:
- en
tags:
- medical
- ayurveda
- traditional-medicine
- icd-10
- india
- integrative-medicine
task_categories:
- text-generation
pretty_name: "Ayurveda / Traditional Medicine to ICD-10 Bridge"
size_categories:
- 1K<n<10K
---

# Ayurveda / Traditional Medicine to ICD-10 Bridge

Part of the **[AxisMapper Medical AI Suite](https://huggingface.co/collections/AmareshHebbar/axiomapper-medical-ai-suite)** — 16 domain-specific SFT datasets for fine-tuning medical LLMs.

**Built by [AmareshHebbar](https://huggingface.co/AmareshHebbar) | Studio Ilios / Humanova Minds**

---

## What this dataset does

Traditional / Ayurvedic medicine concepts → nearest ICD-10-CM code

## Why download this

Bridge traditional Indian medicine (Ayurveda, Unani, Siddha, Homeopathy) to ICD-10 for ABDM integration, ABHA health records, and integrative medicine clinical documentation.

## Dataset stats

| Split | Rows |
|-------|------|
| Train | 2,401 |
| Validation | 300 |
| Test | 301 |
| **Total** | **3,002** |

## Data format

Every row is a `messages` list in chat format — compatible with **Unsloth**, **TRL SFTTrainer**, **LLaMA-Factory**, and any OpenAI-style fine-tuning pipeline:

```json
{
  "messages": [
    {"role": "system",    "content": "You are a ..."},
    {"role": "user",      "content": "Traditional/integrative medicine concept: Contact with and exposure to other animate mechanical forces"},
    {"role": "assistant", "content": "ICD-10-CM Code: W64
Description: Contact with and exposure to other animate mechanical forces
Note: This code is used when traditional or alternative medicine context is clinically relevant."}
  ]
}
```

## Data source

**CMS FY2026 ICD-10-CM — Z codes (health factors) + Y codes (external causes) + traditional medicine terms**
→ https://www.cms.gov/medicare/coding-billing/icd-10-codes

All data is extracted from authoritative public sources. No LLM-generated or synthetic content.

## Who should use this

AYUSH practitioners, integrative medicine hospitals, ABDM health record implementers, Indian health IT developers.

## Quick start

```python
from datasets import load_dataset

ds = load_dataset("AmareshHebbar/ayurveda-icd-sft")
print(ds["train"][0])
```

## Fine-tuning example (Unsloth)

```python
from unsloth import FastLanguageModel
from trl import SFTTrainer
from datasets import load_dataset

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Qwen2.5-3B-Instruct",
    max_seq_length=2048,
    load_in_4bit=True,
)

dataset = load_dataset("AmareshHebbar/ayurveda-icd-sft", split="train")

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    dataset_text_field="messages",
    max_seq_length=2048,
)
trainer.train()
```

## Related datasets in this collection

| Dataset | Task | Rows |
|---------|------|------|
| [icd10-coder-sft](https://huggingface.co/datasets/AmareshHebbar/icd10-coder-sft) | ICD-10-CM coding | 74.7k |
| [symptom-diagnoser-sft](https://huggingface.co/datasets/AmareshHebbar/symptom-diagnoser-sft) | Symptom → diagnosis | 119k |
| [clinical-summarizer-sft](https://huggingface.co/datasets/AmareshHebbar/clinical-summarizer-sft) | SOAP summarization | 30k |
| [discharge-qa-sft](https://huggingface.co/datasets/AmareshHebbar/discharge-qa-sft) | Discharge summary QA | 30k |
| [pmjay-classifier-sft](https://huggingface.co/datasets/AmareshHebbar/pmjay-classifier-sft) | PM-JAY packages | 11.1k |
| [radiology-coder-sft](https://huggingface.co/datasets/AmareshHebbar/radiology-coder-sft) | Radiology coding | 25k |
| [medical-ner-sft](https://huggingface.co/datasets/AmareshHebbar/medical-ner-sft) | Clinical NER | 16.7k |
| [hindi-medical-sft](https://huggingface.co/datasets/AmareshHebbar/hindi-medical-sft) | Hindi medical QA | 19.7k |

## Citation

```bibtex
@misc{axiomapper2026,
  author    = {Hebbar, Amaresh},
  title     = {AxisMapper: Medical AI Fine-tuning Dataset Suite},
  year      = {2026},
  publisher = {HuggingFace},
  url       = {https://huggingface.co/collections/AmareshHebbar/axiomapper-medical-ai-suite}
}
```

---

*AxisMapper is an open-source project. Star the repo, open issues, and contribute at [GitHub](https://github.com/amareshhebbar/AxisMapper).*
