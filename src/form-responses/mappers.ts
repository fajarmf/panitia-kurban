const REG_REGEX = /REG-\d{4}-\d{4}/;

export function parseReg(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(REG_REGEX);
  return match ? match[0] : null;
}
