import { parseReg } from './mappers';

describe('parseReg', () => {
  it('extracts REG-XXXX-YYYY from name string', () => {
    expect(parseReg('Sohibul Test (REG-2026-0001)')).toBe('REG-2026-0001');
  });

  it('returns null when no REG present', () => {
    expect(parseReg('Sohibul Test')).toBeNull();
  });

  it('returns null for empty / null / undefined input', () => {
    expect(parseReg('')).toBeNull();
    expect(parseReg(null)).toBeNull();
    expect(parseReg(undefined)).toBeNull();
  });

  it('returns first REG if multiple present', () => {
    expect(parseReg('REG-2026-0001 / REG-2026-0002')).toBe('REG-2026-0001');
  });
});
