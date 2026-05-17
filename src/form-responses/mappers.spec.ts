import { parseReg, rowToData } from './mappers';

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

describe('rowToData', () => {
  it('maps headers to row values (parallel arrays)', () => {
    const headers = ['Timestamp', 'Nama', 'Pilihan'];
    const row = ['2026-05-19', 'Sohibul', '1/3'];
    expect(rowToData(headers, row)).toEqual({
      Timestamp: '2026-05-19',
      Nama: 'Sohibul',
      Pilihan: '1/3',
    });
  });

  it('preserves empty cell as empty string', () => {
    const headers = ['A', 'B', 'C'];
    const row = ['x', '', 'z'];
    expect(rowToData(headers, row)).toEqual({ A: 'x', B: '', C: 'z' });
  });

  it('pads missing cells with empty string when row shorter than headers', () => {
    const headers = ['A', 'B', 'C'];
    const row = ['x', 'y'];
    expect(rowToData(headers, row)).toEqual({ A: 'x', B: 'y', C: '' });
  });

  it('ignores empty header slots', () => {
    const headers = ['A', '', 'C'];
    const row = ['x', 'y', 'z'];
    expect(rowToData(headers, row)).toEqual({ A: 'x', C: 'z' });
  });
});
