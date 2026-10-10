export function parseLabRows(rawText: string): Array<{ test_name: string, value: number | string, unit: string, ref_low: number | null, ref_high: number | null, ref_text: string, flag: 'L' | 'H' | 'normal' | 'unknown' }> {
  const TEST_NAMES = [
    'WBC', 'RBC', 'Hemoglobin', 'Hb', 'Hematocrit', 'MCV', 'MCH', 'MCHC', 'RDW', 'Platelet',
    'Neutrophils', 'Lymphocytes', 'Monocytes', 'Eosinophils', 'Basophils',
    'Glucose', 'BUN', 'Urea', 'Creatinine', 'eGFR', 'Sodium', 'Potassium', 'Chloride', 'CO2',
    'Calcium', 'Total Protein', 'Albumin', 'Bilirubin', 'ALP', 'AST', 'ALT', 'SGOT', 'SGPT',
    'Cholesterol', 'Triglycerides', 'HDL', 'LDL', 'Non-HDL', 'HbA1c', 'TSH', 'Vitamin D'
  ];

  const text = rawText.replace(/[\n\\]/g, ' ').replace(/\s+/g, ' ');
  const rows: any[] = [];
  
  const sortedNames = [...TEST_NAMES].sort((a, b) => b.length - a.length);
  
  // This matches test names from our dictionary
  // Examples we want to match:
  // "WBC 11.8 H 4.5-11.0"
  // "Glucose: 112 H (70-99 mg/dL"
  // "Cholesterol: 228 H (<200"
  
  for (const name of sortedNames) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b(${escapedName})\\b\\s*[:=]?\\s*([\\d.]+)\\s*([A-Za-z0-9%\\/\\^]+)?\\s*(?:\\(?(?:Reference:)?\\s*([<>=]*\\s*[\\d.]+(?:\\s*-\\s*[\\d.]+)?)\\)?)?\\s*([a-zA-Z0-9%\\/\\^]+)?`, 'gi');
    
    let match;
    // To prevent infinite loops or matching the same over and over if global flag fails, use exec carefully
    while ((match = regex.exec(text)) !== null) {
      const rawVal = match[2];
      const possibleFlagOrUnit = match[3];
      const rawRef = match[4];
      const possibleUnit = match[5];
      
      let flag: 'L' | 'H' | 'normal' | 'unknown' = 'unknown';
      let unit = '';
      
      const isTestName = (s: string) => TEST_NAMES.some(n => n.toLowerCase() === s.toLowerCase());
      const isValidUnit = (s: string) => {
        if (!s || isTestName(s)) return false;
        if (/^(g\/dl|mg\/dl|%|mmol\/l|u\/l|ratio|fl|pg|miu\/l|x10\^3\/ul)$/i.test(s)) return true;
        if (/^[a-z0-9]+\/[a-z0-9]+$/i.test(s)) return true;
        return false;
      };
      
      if (possibleFlagOrUnit) {
        if (/^[HL]$/i.test(possibleFlagOrUnit)) {
          flag = possibleFlagOrUnit.toUpperCase() as 'L'|'H';
        } else if (/^(High|Low)$/i.test(possibleFlagOrUnit)) {
          flag = (possibleFlagOrUnit.toUpperCase().charAt(0)) as 'L'|'H';
        } else if (isValidUnit(possibleFlagOrUnit)) {
          unit = possibleFlagOrUnit;
        }
      }
      
      if (possibleUnit && !unit) {
        if (!/^[HL]$/i.test(possibleUnit) && !/^(High|Low)$/i.test(possibleUnit) && isValidUnit(possibleUnit)) {
          unit = possibleUnit;
        }
      }

      const valueNum = parseFloat(rawVal);
      let ref_low = null;
      let ref_high = null;
      let ref_text = '';

      if (rawRef) {
        ref_text = rawRef.replace(/\s+/g, '');
        if (ref_text.includes('-')) {
          const parts = ref_text.split('-');
          ref_low = parseFloat(parts[0]);
          ref_high = parseFloat(parts[1]);
        } else if (ref_text.startsWith('<')) {
          ref_high = parseFloat(ref_text.replace('<', '').replace('=', ''));
        } else if (ref_text.startsWith('>')) {
          ref_low = parseFloat(ref_text.replace('>', '').replace('=', ''));
        }
        
        if (flag === 'unknown' && !isNaN(valueNum)) {
          if (ref_low !== null && valueNum < ref_low) flag = 'L';
          else if (ref_high !== null && valueNum > ref_high) flag = 'H';
          else if (ref_low !== null || ref_high !== null) flag = 'normal';
        }
      }

      rows.push({
        test_name: name,
        value: isNaN(valueNum) ? rawVal : valueNum,
        unit: unit || '',
        ref_low: isNaN(ref_low as any) ? null : ref_low,
        ref_high: isNaN(ref_high as any) ? null : ref_high,
        ref_text: ref_text || 'unknown',
        flag: flag,
        _index: match.index
      });
      
      // Blank out the matched part in text so we don't match overlapping names?
      // Not strictly necessary since we use index, but good to remember.
    }
  }

  // Sort by index so it's in document order
  rows.sort((a, b) => a._index - b._index);
  rows.forEach(r => delete r._index);

  return rows;
}
