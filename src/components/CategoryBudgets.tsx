import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import {
  amountInput,
  categoryTotals,
  parseAmount,
  type Entry,
  type Ledger,
} from '../domain/ledger';
import { useMoney } from '../state/PrivacyContext';
import { useLedger } from '../state/LedgerProvider';
import { useTheme } from '../theme';
import { Button, Card, SectionTitle, Txt, styles } from './ui';

export function CategoryBudgets({
  ledger,
  entries,
}: {
  ledger: Ledger;
  entries: Entry[];
}) {
  const t = useTheme();
  const money = useMoney();
  const rows = useMemo(() => {
    if (!ledger.categoryBudgets?.length) return [];
    const spending = new Map(
      categoryTotals(entries, ledger.categories, ledger.entries).map((item) => [
        item.id,
        item.total,
      ]),
    );
    return ledger.categoryBudgets
      .map(({ categoryId, amount }) => ({
        category: ledger.categories.find((item) => item.id === categoryId)!,
        amount,
        used: spending.get(categoryId) ?? 0,
      }))
      .sort((a, b) => b.used / b.amount - a.used / a.amount);
  }, [entries, ledger.entries, ledger.categories, ledger.categoryBudgets]);
  if (!rows.length) return null;
  return (
    <>
      <SectionTitle title="分类预算" />
      <Card style={{ gap: 10 }}>
        {rows.map(({ category, amount, used }) => (
          <View
            key={category.id}
            style={[
              styles.row,
              { flexWrap: 'wrap', justifyContent: 'space-between' },
            ]}
          >
            <Txt size={12}>{category.label}</Txt>
            <Txt size={12} color={used >= amount * 0.8 ? t.expense : t.muted}>
              ¥{money(used)} / ¥{money(amount)}
              {used > amount
                ? ' · 已超额'
                : used >= amount * 0.8
                  ? ' · 接近上限'
                  : ''}
            </Txt>
          </View>
        ))}
      </Card>
    </>
  );
}

export function CategoryBudgetEditor({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const money = useMoney();
  const { ledger, saving, update } = useLedger();
  const [active, setActive] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  if (!ledger) return null;
  const categories = ledger.categories.filter(
    (category) =>
      category.kind === 'expense' &&
      (!category.hidden ||
        ledger.categoryBudgets?.some(
          (item) => item.categoryId === category.id,
        )),
  );
  const save = async () => {
    setError('');
    try {
      const amount = draft.trim() ? parseAmount(draft, true) : 0;
      await update((current) => {
        const remaining = (current.categoryBudgets ?? []).filter(
          (item) => item.categoryId !== active,
        );
        return {
          ...current,
          categoryBudgets: amount
            ? [...remaining, { categoryId: active, amount }]
            : remaining,
        };
      });
      setActive('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '保存失败');
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <Button variant="plain" disabled={saving} onPress={onBack}>
        返回设置
      </Button>
      <Txt size={12} color={t.muted}>
        额度每月重复使用，月度总预算单独设置。清空金额可关闭对应分类预算。
      </Txt>
      {categories.map((category) => {
        const amount =
          ledger.categoryBudgets?.find(
            (item) => item.categoryId === category.id,
          )?.amount ?? 0;
        return (
          <View key={category.id}>
            <Button
              variant="plain"
              label={`设置${category.label}预算`}
              disabled={saving}
              onPress={() => {
                setActive(category.id);
                setDraft(amount ? amountInput(amount) : '');
                setError('');
              }}
            >{`${category.label} · ${amount ? `¥${money(amount)}` : '未设额度'}`}</Button>
            {active === category.id && (
              <View style={{ gap: 8 }}>
                <TextInput
                  accessibilityLabel="分类预算金额"
                  inputMode="decimal"
                  value={draft}
                  onChangeText={setDraft}
                  editable={!saving}
                  maxLength={10}
                  style={{
                    minHeight: 46,
                    color: t.text,
                    backgroundColor: t.surfaceAlt,
                    borderRadius: 13,
                    paddingHorizontal: 13,
                  }}
                />
                {!!error && (
                  <Txt size={11} color={t.danger}>
                    {error}
                  </Txt>
                )}
                <Button disabled={saving} onPress={() => void save()}>
                  保存分类预算
                </Button>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
