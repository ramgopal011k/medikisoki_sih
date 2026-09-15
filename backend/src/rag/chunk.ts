import fs from 'fs';
import path from 'path';
import readline from 'readline';

export interface Chunk {
  chunk_id: string;
  text: string;
  source: string;
  section: string;
  chapter: string;
  verse: string | null;
  language: 'en' | 'hi' | 'sa';
  dosha_tags: string[];
  token_count: number;
  char_count: number;
}

export function extractDoshaTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();

  // Vata terms (strict word boundary)
  if (
    /\b(vata|vatic|vatika|vataja|vātika|vāyu|vayu|vātaja|vatavyadhi|apana vayu|prana vayu|samana vayu|vyana vayu|udana vayu)\b/i.test(lower) ||
    /वात|वायु|वातिक|वातज|वातव्याधि/.test(text)
  ) {
    tags.push('vata');
  }

  // Pitta terms (strict word boundary)
  if (
    /\b(pitta|paittika|pittaja|pittic|pittavyadhi|amlapitta|pachakagni)\b/i.test(lower) ||
    /पित्त|पैत्तिक|पित्तज|अम्लपित्त|पित्तव्याधि/.test(text)
  ) {
    tags.push('pitta');
  }

  // Kapha terms (strict word boundary)
  if (
    /\b(kapha|kaphaja|kaphic|shleshma|sleshma|kaphavikara|kaphaja)\b/i.test(lower) ||
    /कफ|श्लेष्मा|श्लैष्मिक|कफज|कफविकार/.test(text)
  ) {
    tags.push('kapha');
  }

  // Agni terms (strict word boundary)
  if (
    /\b(agni|mandagni|tikshnagni|vishamagni|samagni|jatharagni|deepana|pachana|grahani)\b/i.test(lower) ||
    /अग्नि|मन्दाग्नि|तीक्ष्णाग्नि|विषमाग्नि|समाग्नि|दीपन|पाचन|ग्रहणी/.test(text)
  ) {
    tags.push('agni');
  }

  // Constipation terms (strict word boundary)
  if (
    /\b(constipation|vibandha|anaha|krura koshtha|malaavrodha|malasanga)\b/i.test(lower) ||
    /विबंध|मलबद्धता|आनाह|क्रूरकोष्ठ/.test(text)
  ) {
    tags.push('constipation');
  }

  // Ama terms (strict word boundary)
  if (
    /\b(ama|amadosha|amavata|saama|niraama)\b/i.test(lower) ||
    /आम|आमदोष|आमवात|साम/.test(text)
  ) {
    tags.push('ama');
  }

  // Prakriti terms (strict word boundary)
  if (
    /\b(prakriti|prakruti|deha prakriti|dosha prakriti)\b/i.test(lower) ||
    /प्रकृति|देहप्रकृति/.test(text)
  ) {
    tags.push('prakriti');
  }

  // Anidra / Insomnia / Sleep terms
  if (
    /\b(anidra|insomnia|nidranasha|sleeplessness|loss of sleep|hypersomnia)\b/i.test(lower) ||
    /अनिद्रा|निद्रानाश/.test(text)
  ) {
    tags.push('anidra');
  }

  return Array.from(new Set(tags));
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.trim().split(/\s+/).length * 1.3);
}

export async function chunkDataset(
  jsonlPath: string = path.resolve(__dirname, '../../../rag_corpus/raw/vedas/continueousPreTrainData.jsonl'),
  outputPath: string = path.resolve(__dirname, '../../../rag_corpus/chunks/mini_chunks.jsonl'),
  limit: number = 100
): Promise<Chunk[]> {
  const chunksDir = path.dirname(outputPath);
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  const fileStream = fs.createReadStream(jsonlPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const classicalSourceDocs: {
    source: string;
    section: string;
    chapter: string;
    verse: string | null;
    text: string;
  }[] = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      const text = entry.text || '';
      if (text.includes('IJRAY') || text.includes('International Research Journal')) continue;

      const headerEnd = text.indexOf(']]');
      const header = headerEnd !== -1 ? text.slice(0, headerEnd) : '';
      const body = headerEnd !== -1 ? text.slice(headerEnd + 2).trim() : text.trim();

      let source = 'Classical Ayurvedic Text';
      if (header.includes('Charaka Samhita') || body.includes('Charaka Samhita')) source = 'Charaka Samhita';
      else if (header.includes('Sushruta Samhita') || body.includes('Sushruta Samhita')) source = 'Sushruta Samhita';
      else if (header.includes('Rasa Jala Nidhi') || body.includes('Rasa Jala Nidhi')) source = 'Rasa Jala Nidhi';
      else if (header.includes('Atharva Veda') || body.includes('Atharva Veda')) source = 'Atharva Veda';
      else continue;

      let section = 'General';
      const secMatch = header.match(/Section:\s*([^|\]]+)/i) || header.match(/Book:\s*([^|\]]+)/i);
      if (secMatch) section = secMatch[1].trim();

      let chapter = 'General';
      const chapMatch = header.match(/Chapter:\s*([^|\]]+)/i) || header.match(/Hymn:\s*([^|\]]+)/i);
      if (chapMatch) chapter = chapMatch[1].trim();

      let verse: string | null = null;
      const verseMatch = header.match(/Verse:\s*([^|\]]+)/i);
      if (verseMatch) verse = verseMatch[1].trim();

      const paragraphs = body.split(/\n\s*\n+/);
      let block = '';
      for (const p of paragraphs) {
        const pt = p.trim();
        if (pt.length < 20) continue;
        if (block.length + pt.length + 2 <= 1100) {
          block = block ? block + '\n\n' + pt : pt;
        } else {
          if (block.length >= 120 && block.length <= 1800) {
            classicalSourceDocs.push({ source, section, chapter, verse, text: block });
          }
          block = pt;
        }
      }
      if (block.length >= 120 && block.length <= 1800) {
        classicalSourceDocs.push({ source, section, chapter, verse, text: block });
      }
    } catch (e) {}
  }

  const chunks: Chunk[] = [];
  let chunkIndex = 1;

  for (const doc of classicalSourceDocs.slice(0, limit)) {
    chunks.push({
      chunk_id: `chunk_${String(chunkIndex).padStart(4, '0')}`,
      text: doc.text,
      source: doc.source,
      section: doc.section,
      chapter: doc.chapter,
      verse: doc.verse,
      language: 'en',
      dosha_tags: extractDoshaTags(doc.text),
      token_count: estimateTokenCount(doc.text),
      char_count: doc.text.length,
    });
    chunkIndex++;
  }

  const lines = chunks.map((c) => JSON.stringify(c)).join('\n');
  fs.writeFileSync(outputPath, lines, 'utf8');
  return chunks;
}
