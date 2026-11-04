import { MAX_AMOUNT, amountInput } from './ledger';

type Fraction = { n: bigint; d: bigint };
const fraction = (n: bigint, d = 1n): Fraction => {
  if (d === 0n) throw new Error('不能除以 0');
  const sign = d < 0n ? -1n : 1n;
  n *= sign;
  d *= sign;
  let a = n < 0n ? -n : n,
    b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
};

/** Decimal arithmetic stays rational until a single half-up rounding to cents. */
export function calculateAmount(expression: string): number {
  const source = expression
    .replace(/[×x]/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\s/g, '');
  if (!source || source.length > 120 || /[^\d.+\-*/()]/.test(source))
    throw new Error('请填写有效的计算式');
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[+\-*/()]/g) ?? [];
  if (tokens.join('') !== source) throw new Error('请填写有效的计算式');
  let index = 0;
  const primary = (depth: number): Fraction => {
    if (depth > 16) throw new Error('计算式过于复杂');
    const token = tokens[index++];
    if (token === '+' || token === '-') {
      const value = primary(depth + 1);
      return { ...value, n: token === '-' ? -value.n : value.n };
    }
    if (token === '(') {
      const value = sum(depth + 1);
      if (tokens[index++] !== ')') throw new Error('请补全括号');
      return value;
    }
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token) || token.length > 20)
      throw new Error('请填写有效的数字');
    const [whole, decimal = ''] = token.split('.');
    return fraction(
      BigInt((whole || '0') + decimal),
      10n ** BigInt(decimal.length),
    );
  };
  const product = (depth: number): Fraction => {
    let left = primary(depth);
    while (tokens[index] === '*' || tokens[index] === '/') {
      const op = tokens[index++],
        right = primary(depth);
      left =
        op === '*'
          ? fraction(left.n * right.n, left.d * right.d)
          : fraction(left.n * right.d, left.d * right.n);
    }
    return left;
  };
  const sum = (depth: number): Fraction => {
    let left = product(depth);
    while (tokens[index] === '+' || tokens[index] === '-') {
      const op = tokens[index++],
        right = product(depth);
      left = fraction(
        left.n * right.d + (op === '+' ? 1n : -1n) * right.n * left.d,
        left.d * right.d,
      );
    }
    return left;
  };
  const result = sum(0);
  if (index !== tokens.length) throw new Error('请检查运算符和括号');
  if (result.n <= 0n) throw new Error('计算结果需大于 0');
  const cents = (result.n * 200n + result.d) / (2n * result.d);
  if (cents <= 0n || cents > BigInt(MAX_AMOUNT))
    throw new Error('金额需大于 0，且不超过 9,999,999.99');
  return Number(cents);
}

export type CalculatorDraft = {
  expression: string;
  fresh: boolean;
  error: string;
};
export type CalculatorAction =
  | { type: 'seed'; value: string }
  | { type: 'text'; value: string }
  | { type: 'key'; key: string };
export const calculatorDraft = (expression: string): CalculatorDraft => ({
  expression,
  fresh: true,
  error: '',
});

/** The form owns this draft so input and replacement after '=' survive app locks. */
export function calculatorReducer(
  state: CalculatorDraft,
  action: CalculatorAction,
): CalculatorDraft {
  if (action.type === 'seed') return calculatorDraft(action.value);
  if (action.type === 'text')
    return { expression: action.value.slice(0, 120), fresh: false, error: '' };
  const key = action.key;
  if (key === '=') {
    try {
      return calculatorDraft(amountInput(calculateAmount(state.expression)));
    } catch (error) {
      return {
        ...state,
        error: state.expression.trim()
          ? error instanceof Error
            ? error.message
            : '计算式无效'
          : '请输入金额',
      };
    }
  }
  if (key === 'C') return calculatorDraft('');
  if (key === '⌫')
    return {
      expression: state.expression.slice(0, -1),
      fresh: false,
      error: '',
    };
  let value = state.expression;
  if (/^\d$/.test(key))
    value = state.fresh || value === '0' ? key : value + key;
  else if (key === '.') {
    if (state.fresh) value = '0.';
    else {
      const operand = value.split(/[+\-−×÷*/()]/).at(-1) ?? '';
      if (operand.includes('.') || value.endsWith(')')) return state;
      value += operand ? '.' : '0.';
    }
  } else if (['+', '−', '×', '÷'].includes(key)) {
    if (!value || value.endsWith('(')) {
      if (key !== '−') return state;
      value += key;
    } else if (/[+\-−×÷*/]$/.test(value))
      value =
        key === '−' && /[×÷*/]$/.test(value)
          ? value + key
          : value.replace(/[+\-−×÷*/]+$/, key);
    else value += key;
  } else if (key === '(')
    value = state.fresh ? '(' : value + (/[\d.)]$/.test(value) ? '×(' : '(');
  else if (key === ')') {
    if (
      (value.match(/\(/g) ?? []).length <= (value.match(/\)/g) ?? []).length ||
      !/[\d.)]$/.test(value)
    )
      return state;
    value += ')';
  } else return state;
  return value.length <= 120
    ? { expression: value, fresh: false, error: '' }
    : state;
}
