import { extractDocumentDate } from '../src/services/documentDateExtractor';

describe('documentDateExtractor', () => {
  it('extracts ISO dates (YYYY-MM-DD)', () => {
    expect(extractDocumentDate('Date: 2026-09-20')).toBe('2026-09-20');
    expect(extractDocumentDate('REPORTED: 2026-01-15')).toBe('2026-01-15');
  });

  it('extracts DD-MM-YYYY dates', () => {
    expect(extractDocumentDate('Date: 20-09-2026')).toBe('2026-09-20');
    expect(extractDocumentDate('COLLECTED: 05-11-2025')).toBe('2025-11-05');
  });

  it('extracts MM/DD/YYYY dates', () => {
    expect(extractDocumentDate('Date: 09/20/2026')).toBe('2026-09-20');
    expect(extractDocumentDate('RECEIVED: 12/31/2025')).toBe('2025-12-31');
  });

  it('extracts DD MMM YYYY dates', () => {
    expect(extractDocumentDate('Date: 20 Sep 2026')).toBe('2026-09-20');
    expect(extractDocumentDate('REPORTED DATE: 15 January 2026')).toBe('2026-01-15');
    expect(extractDocumentDate('COLLECTION DATE: 01-Feb-2026')).toBe('2026-02-01');
  });

  it('prefers labeled dates in order: REPORTED > COLLECTED > RECEIVED > DATE', () => {
    const text = `
      DATE: 2026-01-01
      RECEIVED: 2026-02-02
      COLLECTED: 2026-03-03
      REPORTED: 2026-04-04
    `;
    expect(extractDocumentDate(text)).toBe('2026-04-04');

    const text2 = `
      DATE: 2026-01-01
      COLLECTED: 2026-03-03
      RECEIVED: 2026-02-02
    `;
    expect(extractDocumentDate(text2)).toBe('2026-03-03');
  });

  it('extracts date from Doc 1, Doc 2, Doc 3 fixture strings', () => {
    const doc1 = 'Laboratory Report - Clean Text\nPatient: John Doe\nDate: 2026-09-20\nCBC Panel';
    const doc2 = 'Laboratory Report - Image Only\nPatient John Doe\nDate: 2026-09-20\nCBC Panel';
    const doc3 = 'Laboratory Report - Messy Multi-page\nPatient: John Doe\nDate: 2026-09-20\nCBC Panel';

    expect(extractDocumentDate(doc1)).toBe('2026-09-20');
    expect(extractDocumentDate(doc2)).toBe('2026-09-20');
    expect(extractDocumentDate(doc3)).toBe('2026-09-20');
  });

  it('returns null for text with no valid dates', () => {
    expect(extractDocumentDate('')).toBeNull();
    expect(extractDocumentDate('No dates here WBC: 11.8')).toBeNull();
    expect(extractDocumentDate(null as any)).toBeNull();
  });
});
