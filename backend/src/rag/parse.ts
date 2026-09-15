import fs from 'fs';
import path from 'path';
import readline from 'readline';

export interface ParsedDocument {
  source: string;
  section?: string;
  chapter?: string;
  verse?: string;
  title?: string;
  raw_text: string;
  language: 'en' | 'hi' | 'sa';
}

export async function parseVedasDataset(
  jsonlPath: string = path.resolve(__dirname, '../../../rag_corpus/raw/vedas/continueousPreTrainData.jsonl'),
  outputDir: string = path.resolve(__dirname, '../../../rag_corpus/parsed')
): Promise<number> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (!fs.existsSync(jsonlPath)) {
    throw new Error(`Raw dataset not found at ${jsonlPath}`);
  }

  const fileStream = fs.createReadStream(jsonlPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let parsedCount = 0;
  const parsedDocs: ParsedDocument[] = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      const text = entry.text || '';
      
      // Extract header metadata: [[ Collection: X | ... ]]
      let source = 'Classical Ayurvedic Text';
      let section = '';
      let chapter = '';
      let verse = '';
      let title = '';

      const headerMatch = text.match(/\[\[(.*?)\]\]/s);
      let contentText = text;
      if (headerMatch) {
        const header = headerMatch[1];
        contentText = text.replace(headerMatch[0], '').trim();

        const colMatch = header.match(/Collection:\s*([^|\]]+)/i);
        if (colMatch) source = colMatch[1].trim();

        const secMatch = header.match(/Section:\s*([^|\]]+)/i) || header.match(/Book:\s*([^|\]]+)/i);
        if (secMatch) section = secMatch[1].trim();

        const chapMatch = header.match(/Chapter:\s*([^|\]]+)/i) || header.match(/Hymn:\s*([^|\]]+)/i);
        if (chapMatch) chapter = chapMatch[1].trim();

        const verseMatch = header.match(/Verse:\s*([^|\]]+)/i);
        if (verseMatch) verse = verseMatch[1].trim();

        const titleMatch = header.match(/Title:\s*([^|\]]+)/i);
        if (titleMatch) title = titleMatch[1].trim();
      }

      // Detect language
      let language: 'en' | 'hi' | 'sa' = 'en';
      const devanagariCount = (contentText.match(/[\u0900-\u097F]/g) || []).length;
      if (devanagariCount > 30) {
        language = 'sa';
      }

      parsedDocs.push({
        source,
        section,
        chapter,
        verse,
        title,
        raw_text: contentText,
        language,
      });

      parsedCount++;
    } catch (err) {
      console.warn('Error parsing line in jsonl:', err);
    }
  }

  // Write out parsed documents summary / combined parsed file
  const outPath = path.join(outputDir, 'parsed_vedas.json');
  fs.writeFileSync(outPath, JSON.stringify(parsedDocs, null, 2), 'utf8');
  console.log(`Successfully parsed ${parsedCount} documents to ${outPath}`);
  return parsedCount;
}

if (require.main === module) {
  parseVedasDataset().catch(console.error);
}
