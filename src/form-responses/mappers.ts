const REG_REGEX = /REG-\d{4}-\d{4}/;

export function parseReg(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(REG_REGEX);
  return match ? match[0] : null;
}

export function rowToData(
  headers: string[],
  row: string[],
): Record<string, string> {
  const data: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (!header) continue;
    data[header] = row[i] ?? '';
  }
  return data;
}

// WIB = +07:00 (form submitter timezone; Google Forms reports timestamps in spreadsheet locale without offset)
const WIB_OFFSET = '+07:00';

export function parseTimestamp(value: string | undefined | null): Date {
  if (!value) throw new Error('Timestamp value is empty');

  // Google Forms format variants: "YYYY-MM-DD HH:MM:SS" or "YYYY/MM/DD HH:MM:SS"
  // Normalize to ISO with WIB offset for consistent parsing across server TZ.
  const normalized = value.trim()
    .replace(/\//g, '-')       // slashes → dashes
    .replace(' ', 'T')         // space → T (ISO separator)
    + (value.includes('+') || value.includes('Z') ? '' : WIB_OFFSET);

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return date;
}

export function buildPrefillUrl(namaWithReg: string): string {
  const base = process.env.KONFIRMASI_TEKNIS_FORM_PREFILL_BASE;
  const entryId = process.env.KONFIRMASI_TEKNIS_NAMA_ENTRY_ID;
  if (!base || !entryId) {
    throw new Error(
      'Missing env: KONFIRMASI_TEKNIS_FORM_PREFILL_BASE and/or KONFIRMASI_TEKNIS_NAMA_ENTRY_ID',
    );
  }
  const encoded = encodeURIComponent(namaWithReg);
  return `${base}?usp=pp_url&entry.${entryId}=${encoded}`;
}
