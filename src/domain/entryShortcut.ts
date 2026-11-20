export function shortcutKind(url: string | null): 'expense' | 'income' | null {
  if (url === 'qingzhang-app://record/expense') return 'expense';
  if (url === 'qingzhang-app://record/income') return 'income';
  return null;
}
