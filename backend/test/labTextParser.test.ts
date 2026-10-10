import { parseLabRows } from '../src/services/labTextParser';

describe('labTextParser', () => {
  it('parses clean text', () => {
    const text = 'WBC: 11.8 H (4.5-11.0\\ Hemoglobin: 13.1 L (13.5-17.5\\ Platelet: 268 (150-400\\ Glucose: 112 H (70-99\\ Cholesterol: 228 H (<200\\ HDL: 38 L (>40\\ HbA1c: 5.9 H (4.0-5.6\\ Vitamin D: 24.6 L (30-100\\';
    const rows = parseLabRows(text);
    
    expect(rows.length).toBeGreaterThanOrEqual(8);
    expect(rows.find(r => r.test_name === 'WBC')?.value).toBe(11.8);
    expect(rows.find(r => r.test_name === 'WBC')?.flag).toBe('H');
    expect(rows.find(r => r.test_name === 'WBC')?.ref_low).toBe(4.5);
    
    expect(rows.find(r => r.test_name === 'Cholesterol')?.flag).toBe('H');
    expect(rows.find(r => r.test_name === 'Cholesterol')?.ref_high).toBe(200);
  });

  it('handles empty text', () => {
    const rows = parseLabRows('');
    expect(rows.length).toBe(0);
  });

  it('handles no match text', () => {
    const rows = parseLabRows('Just some random text with numbers 123.4 and 45.6');
    expect(rows.length).toBe(0);
  });
});
