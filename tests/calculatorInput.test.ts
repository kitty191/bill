import { describe, expect, it } from 'vitest';
import {
  calculateAmount,
  calculatorDraft,
  calculatorReducer,
  type CalculatorDraft,
} from '../src/domain/calculator';

function keys(source: string[], initial = '') {
  return source.reduce<CalculatorDraft>(
    (state, key) => calculatorReducer(state, { type: 'key', key }),
    calculatorDraft(initial),
  );
}
describe('direct calculator input', () => {
  it('accepts a complete amount immediately, without an apply step', () => {
    const state = keys(['2', '8', '.', '5', '0']);
    expect(state.expression).toBe('28.50');
    expect(calculateAmount(state.expression)).toBe(2850);
  });
  it('replaces a prefilled amount on the first digit and can extend it with an operator', () => {
    expect(keys(['3', '5'], '100.00').expression).toBe('35');
    expect(calculateAmount(keys(['+', '2'], '18.50').expression)).toBe(2050);
  });
  it('replaces an evaluated result on the next digit but continues arithmetic after an operator', () => {
    expect(keys(['7', '+', '3', '=', '2']).expression).toBe('2');
    expect(keys(['7', '+', '3', '=', '×', '2', '=']).expression).toBe('20.00');
  });
  it('ignores repeated decimal points, normalizes leading zeroes and prefixes fractional input', () => {
    expect(keys(['0', '0', '9']).expression).toBe('9');
    expect(keys(['.', '5', '.', '5']).expression).toBe('0.55');
    expect(keys(['1', '+', '.', '5']).expression).toBe('1+0.5');
  });
  it('supports correction and parentheses on the keypad', () => {
    expect(keys(['1', '2', '⌫', '3']).expression).toBe('13');
    expect(keys(['1', '+', '×', '2', '=']).expression).toBe('2.00');
    expect(keys(['(', '2', '+', '3', ')', '×', '4', '=']).expression).toBe(
      '20.00',
    );
    expect(keys(['2', '(', '3', '+', '1', ')', '=']).expression).toBe('8.00');
  });
  it('keeps invalid arithmetic editable and never converts it to an amount', () => {
    const bad = keys(['1', '÷', '0', '=']);
    expect(bad.error).toBe('不能除以 0');
    expect(bad.expression).toBe('1÷0');
    const fixed = calculatorReducer(
      calculatorReducer(bad, { type: 'key', key: '⌫' }),
      { type: 'key', key: '2' },
    );
    expect(fixed.error).toBe('');
    expect(calculateAmount(fixed.expression)).toBe(50);
    expect(keys(['=']).error).toBe('请输入金额');
  });
  it('resets replacement state for templates and retains input append state in a serialized draft', () => {
    const typed = calculatorReducer(calculatorDraft(''), {
      type: 'text',
      value: '12',
    });
    expect(
      calculatorReducer(JSON.parse(JSON.stringify(typed)), {
        type: 'key',
        key: '3',
      }).expression,
    ).toBe('123');
    const preset = calculatorReducer(typed, { type: 'seed', value: '18.50' });
    expect(
      calculatorReducer(preset, { type: 'key', key: '9' }).expression,
    ).toBe('9');
  });
  it('clears input and bounds raw text and keypad input', () => {
    expect(keys(['C'], '18.50')).toEqual(calculatorDraft(''));
    const long = calculatorReducer(calculatorDraft(''), {
      type: 'text',
      value: '1'.repeat(150),
    });
    expect(long.expression).toHaveLength(120);
    expect(calculatorReducer(long, { type: 'key', key: '2' })).toBe(long);
    expect(calculatorReducer(long, { type: 'key', key: 'eval' })).toBe(long);
  });
});
