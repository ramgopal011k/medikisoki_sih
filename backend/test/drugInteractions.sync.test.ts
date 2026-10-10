import fs from 'fs';
import path from 'path';

describe('Drug Interaction Rules Synchronization Test', () => {
  const backendFilePath = path.resolve(__dirname, '../src/rules/drugInteractions.ts');
  const frontendFilePath = path.resolve(__dirname, '../../frontend/src/lib/drugInteractions.ts');

  function extractRuleIds(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const matches = content.match(/id:\s*'DI-\d+'/g) || [];
    return matches.map(m => {
      const idMatch = m.match(/DI-\d+/);
      return idMatch ? idMatch[0] : m;
    });
  }

  it('backend and frontend drug interaction rule IDs must be identical', () => {
    expect(fs.existsSync(backendFilePath)).toBe(true);
    expect(fs.existsSync(frontendFilePath)).toBe(true);

    const backendIds = extractRuleIds(backendFilePath);
    const frontendIds = extractRuleIds(frontendFilePath);

    const missingInFrontend = backendIds.filter(id => !frontendIds.includes(id));
    const extraInFrontend = frontendIds.filter(id => !backendIds.includes(id));

    if (missingInFrontend.length > 0 || extraInFrontend.length > 0) {
      const errorMsg = [
        '⚠️ DRUG INTERACTION RULES SYNC MISMATCH:',
        `Backend rules count: ${backendIds.length}`,
        `Frontend rules count: ${frontendIds.length}`,
        missingInFrontend.length > 0 ? `Missing in frontend: [${missingInFrontend.join(', ')}]` : '',
        extraInFrontend.length > 0 ? `Extra in frontend (not in backend): [${extraInFrontend.join(', ')}]` : '',
        'Ensure backend/src/rules/drugInteractions.ts and frontend/src/lib/drugInteractions.ts have identical rule IDs.'
      ].filter(Boolean).join('\n');

      throw new Error(errorMsg);
    }

    expect(frontendIds).toEqual(backendIds);
    expect(backendIds.length).toBeGreaterThan(0);
  });
});
