import { expect, it } from 'vitest';
import { monthOffset, pickerYear } from '../src/domain/dates';
import { shiftMonth } from '../src/domain/ledger';
import { amountFilterLabel, emptyFilters } from '../src/domain/entryFilters';
it('jumps directly across years and preserves supported endpoints', () => {
  for (const [from, to] of [
    ['2026-11', '2024-02'],
    ['1900-01', '2200-12'],
    ['2200-12', '1900-01'],
    ['2026-11', '2026-11'],
  ]) {
    expect(shiftMonth(from!, monthOffset(from!, to!))).toBe(to);
  }
  for (const bad of ['1899-12', '2201-01', '2026-00', '2026-13', '26-01'])
    expect(() => monthOffset('2026-11', bad)).toThrow('月份无效');
  expect(pickerYear('1900')).toBe(1900);
  expect(pickerYear('2200')).toBe(2200);
  for (const bad of ['', '1', '1899', '2201', '2e03', '２０２６', '2026 '])
    expect(pickerYear(bad)).toBeNull();
});
it('describes exact inclusive cent bounds without leaking hidden values', () => {
  const cases = [
    ['', '', ''],
    ['20', '100', '¥20–100'],
    ['20.50', '100.01', '¥20.50–100.01'],
    ['50', '', '≥¥50'],
    ['', '100', '≤¥100'],
    ['0', '', '≥¥0'],
    ['20.50', '20.5', '¥20.50'],
    ['0.01', '0.02', '¥0.01–0.02'],
  ];
  for (const [minAmount, maxAmount, label] of cases) {
    const filters = { ...emptyFilters(), minAmount, maxAmount };
    expect(amountFilterLabel(filters, false)).toBe(label);
    expect(amountFilterLabel(filters, true)).toBe(label ? '金额条件' : '');
  }
});
