const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12'
};

function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/,/g, '');

  // 1. YYYY-MM-DD
  const ymdMatch = cleaned.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    const mm = m.padStart(2, '0');
    const dd = d.padStart(2, '0');
    if (parseInt(mm, 10) >= 1 && parseInt(mm, 10) <= 12 && parseInt(dd, 10) >= 1 && parseInt(dd, 10) <= 31) {
      return `${y}-${mm}-${dd}`;
    }
  }

  // 2. DD MMM YYYY (e.g. 20 Sep 2026 or 20-Sep-2026)
  const dMmmYMatch = cleaned.match(/^(\d{1,2})[-\s/]+([A-Za-z]+)[-\s/]+(\d{4})$/);
  if (dMmmYMatch) {
    const [, d, mStr, y] = dMmmYMatch;
    const mm = MONTH_MAP[mStr.toLowerCase().slice(0, 3)];
    if (mm) {
      const dd = d.padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
  }

  // 3. MMM DD YYYY (e.g. Sep 20 2026)
  const mmmDYMatch = cleaned.match(/^([A-Za-z]+)[-\s/]+(\d{1,2})[-\s/]+(\d{4})$/);
  if (mmmDYMatch) {
    const [, mStr, d, y] = mmmDYMatch;
    const mm = MONTH_MAP[mStr.toLowerCase().slice(0, 3)];
    if (mm) {
      const dd = d.padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
  }

  // 4. DD-MM-YYYY or MM/DD/YYYY
  const slashDashMatch = cleaned.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (slashDashMatch) {
    const [, first, second, y] = slashDashMatch;
    const n1 = parseInt(first, 10);
    const n2 = parseInt(second, 10);

    // If first > 12, it must be DD-MM-YYYY
    if (n1 > 12 && n2 <= 12) {
      const dd = first.padStart(2, '0');
      const mm = second.padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
    // If second > 12, it must be MM/DD/YYYY
    if (n2 > 12 && n1 <= 12) {
      const mm = first.padStart(2, '0');
      const dd = second.padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
    // Default to MM/DD/YYYY if ambiguous, or DD-MM-YYYY depending on separator
    if (cleaned.includes('-')) {
      // Typically DD-MM-YYYY when hyphenated in medical reports
      const dd = first.padStart(2, '0');
      const mm = second.padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    } else {
      const mm = first.padStart(2, '0');
      const dd = second.padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
  }

  return null;
}

const DATE_REGEX_PATTERN = `(?:\\d{4}[-\\/.]\\d{1,2}[-\\/.]\\d{1,2}|\\d{1,2}[-\\s\\/.]+[A-Za-z]+[-\\s\\/.]+\\d{4}|[A-Za-z]+[-\\s\\/.]+\\d{1,2},?[-\\s\\/.]+\\d{4}|\\d{1,2}[-\\/.]\\d{1,2}[-\\/.]\\d{4})`;

export function extractDocumentDate(text: string): string | null {
  if (!text || typeof text !== 'string') return null;

  // Prefer labeled dates in this order: REPORTED, COLLECTED, RECEIVED, DATE
  const LABELS = ['REPORTED', 'COLLECTED', 'RECEIVED', 'DATE'];

  for (const label of LABELS) {
    // Regex matches: LABEL ... [date string]
    // e.g. "REPORTED: 2026-09-20", "Date: 2026-09-20", "COLLECTION DATE: 20 Sep 2026"
    const regex = new RegExp(
      `(?:${label}(?:\\s+DATE|\\s+ON)?|DATE\\s+${label})\\s*[:=]?\\s*(${DATE_REGEX_PATTERN})`,
      'i'
    );
    const match = text.match(regex);
    if (match && match[1]) {
      const normalized = normalizeDate(match[1]);
      if (normalized) return normalized;
    }
  }

  // Fallback: search for any standalone date matching the pattern
  const fallbackRegex = new RegExp(`\\b(${DATE_REGEX_PATTERN})\\b`, 'i');
  const fallbackMatch = text.match(fallbackRegex);
  if (fallbackMatch && fallbackMatch[1]) {
    const normalized = normalizeDate(fallbackMatch[1]);
    if (normalized) return normalized;
  }

  return null;
}
