---
license: other
license_name: public-domain
license_link: LICENSE
language:
- en
- sa
- hi
tags:
- Vedas
- Hindu
- History
- India
- RigVeda
- SamaVeda
- YajurVeda
- AtharvaVeda
- Ayurveda
- Yoga
- CharakaSamhita
- SushrutaSamhita
- RasaJalaNidhi
- IRJAY
- Medicine
- Alchemy
size_categories:
- 10K<n<100K
data_prepared_from:
- Ralph T.H. Griffith's Rig Veda, Sama Veda, White Yajur Veda, and Atharva Veda English translations
- Arthur Berriedale Keith's Black Yajur Veda English translation
- Shree Gulabkunverba Ayurvedic Society's Charaka Samhita English translation
- Kaviraj Kunja Lal Bhishagratna's Sushruta Samhita English translation
- Rasacharya Kaviraj Bhudeb Mookerji's Rasa Jala Nidhi English translation
- Research articles from the International Research Journal of Ayurveda and Yoga (IRJAY)
Chunk_Overlap:
- 150 characters
Chunk_Size:
- Full Hymn / Anuvaka / Verse / Section granularity
---

# 📖 Indian Vedas and Ayurveda Corpus (Rig Veda, Sama Veda, Yajur Veda, Atharva Veda, Charaka Samhita, Sushruta Samhita, Rasa Jala Nidhi, IRJAY)

**Languages:** English (en), Sanskrit (sa), Hindi (hi)
**Dataset size:** ~10K < n < ~100K records (chunks, verses, chapters, and articles combined)

---

## Dataset Summary

This corpus is a comprehensive, highly structured dataset comprising the four primary pillars of ancient Indian literature (the **Rig Veda**, **Sama Veda**, **Yajur Veda**, and **Atharva Veda**) along with foundational classical works of Ayurveda and Indian medicine (the **Charaka Samhita**, **Sushruta Samhita**, and **Rasa Jala Nidhi**) and modern research papers from the **International Research Journal of Ayurveda and Yoga (IRJAY)**. It integrates multiple authoritative translations, offering Sanskrit source verses, English interpretations, and modern Ayurvedic physiological reviews.

The dataset is formatted for continuous pre-training, fine-tuning, and Retrieval-Augmented Generation (RAG) applications in Indology, computational linguistics, historical analysis, ancient medicine, and ancient language model development.

---

## 🏛️ Corpus Composition & Authorship

The dataset brings together works from highly respected translators, scholars, and medical journals:

1. **Rig Veda**: 
   - **Translator**: **Ralph T.H. Griffith** (1896).
   - **Language**: English (en).
   - **Structure**: 10 Mandalas (Books), organized by Suktas (Hymns) and verses.
   
2. **Sama Veda**:
   - **Translators**: 
     - **Ralph T.H. Griffith** (1895) - English translation.
     - **PDF Manuscripts** - High-resolution digital renderings.
   - **Languages**: English (en) | Sanskrit (sa) | Hindi (hi).
   - **Structure**: Part I (Mula/Decades) & Part II (Hymns).

3. **Yajur Veda**:
   - **Translators**:
     - **Black Yajur Veda** (Taittiriya Samhita): **Arthur Berriedale Keith** (1914) - English.
     - **White Yajur Veda** (Vajasaneya Samhita): **Ralph T.H. Griffith** (1899) - English.
   - **Languages**: English (en).
   - **Structure**: Kandas & Prapathakas (Black) | 40 Books & Verses (White).

4. **Atharva Veda**:
   - **Translators**:
     - **Ralph T.H. Griffith** (1895) - English.
   - **Languages**: English (en).
   - **Structure**: 20 Books, Suktas, and Verses.

5. **Charaka Samhita**:
   - **Translator**: **Shree Gulabkunverba Ayurvedic Society**.
   - **Language**: English (en).
   - **Structure**: Comprehensive classical text on medicine, covering general principles (Sutrasthana), diagnosis, treatment, and pharmaceutics.

6. **Sushruta Samhita**:
   - **Translator**: **Kaviraj Kunja Lal Bhishagratna** (1907).
   - **Language**: English (en) | Sanskrit (sa).
   - **Structure**: Core ancient treatise on surgery, anatomy, midwifery, and therapeutics.

7. **Rasa Jala Nidhi**:
   - **Translator**: **Rasacharya Kaviraj Bhudeb Mookerji** (1926).
   - **Language**: English (en).
   - **Structure**: Comprehensive Sanskrit treatise on alchemical metallurgy (Rasa Shastra) and chemistry of medicine.

8. **International Research Journal of Ayurveda and Yoga (IRJAY)**:
   - **Source**: `irjay.com`.
   - **Language**: English (en).
   - **Structure**: Scientific research articles, reviews, and clinical studies on Ayurvedic physiology, immunization, and Yoga practices.

---

## ⚙️ Chunking & Preprocessing Strategies

Two specialized pipelines are used to prepare the Vedic and Ayurvedic data for LLM ingestion:

### 1. Document Page Chunking (PDF pipeline)
Used for the bilingual translation documents (e.g., Sharma's Atharva Veda and PDF versions of Sama Veda) to ensure balanced context sizes.

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Chunk Overlap** | 150 characters | Ensures smooth transitions and preserves semantic boundaries |
| **Chunk Size** | 4 chunks per page | Optimizes sequence length for embedding and context retrieval |
| **Strategy** | Page-level overlapping splits | Preserves adjacent translation pairs (Sanskrit-Hindi) |

### 2. Semantic Structural Scraping (Web pipeline)
Used for the web-scraped books to preserve original ritualistic, musical, narrative, and medical divisions:

*   **Rig Veda & Atharva Veda**: Chunked at the **Hymn (Sukta)** level. This encapsulates full structural themes as single database rows.
*   **Sama Veda**: Chunked at the **Decade/Hymn** level, aligning with Vedic musical metres.
*   **Black Yajur Veda**: Chunked at the **Anuvaka** level, maintaining ritual instruction blocks.
*   **White Yajur Veda**: Chunked at the individual **Verse** level with high-resolution metadata tags.
*   **Charaka, Sushruta & Rasa Jala Nidhi**: Chunked at the **Chapter / Part** level, ensuring holistic medical context is retained.
*   **IRJAY**: Chunked at the **Page** level with summary annotations for dense scientific text.

---

## 📁 Data Structure

Dataset records follow a unified JSON schema containing the text payload alongside hierarchical metadata:

### Scraped Structural Record Example (JSONL)
```json
{
  "text": "[[ Collection: Charaka Samhita | Translator: Shree Gulabkunverba Ayurvedic Society | Title: The Quest for Longevity (dirgha-jivita) ]]\n\nCharaka Samhita (English Translation)\nSutrasthana (Sutra Sthana) — General Principles\nChapter 1 - The Quest for Longevity (dirgha-jivita)\n\n1. We shall now expound the chapter entitled “The Quest for Longevity.”\n\n2. Thus declared the worshipful Atreya...\n..."
}
```

---

## 🚀 Purpose & Applications

*   **Ancient Text Pre-Training**: Ideal for injecting Vedic and Ayurvedic domain knowledge into deep learning models (e.g., VedaGPT).
*   **Bilingual RAG (Retrieval-Augmented Generation)**: High-quality translations allow cross-lingual semantic searches between English, Hindi, and Sanskrit.
*   **Linguistic & Digital Humanities**: Facilitates statistical studies of ancient Sanskrit syntax, meter, and translation structures.
*   **Medical History Research**: Enables research into historical clinical practices, pharmaceutical formulations, and surgical history of ancient India.
