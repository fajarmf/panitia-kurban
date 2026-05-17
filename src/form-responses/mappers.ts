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

export function parseTimestamp(value: string | undefined | null): Date {
  if (!value) throw new Error('Timestamp value is empty');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return date;
}
