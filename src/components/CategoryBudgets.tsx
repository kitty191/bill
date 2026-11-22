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
      <Card style={{ gap: 14 }}>
        {rows.map(({ category, amount, used }) => {
          const ratio = amount > 0 ? Math.min(used / amount, 1) : 0;
          const barColor =
            used > amount
              ? t.danger
              : used >= amount * 0.8
                ? t.expense
                : category.color;
          return (
            <View key={category.id} style={{ gap: 6 }}>
              <View
                style={[
                  styles.row,
                  { flexWrap: 'wrap', justifyContent: 'space-between' },
                ]}
              >
                <View style={[styles.row, { gap: 7 }]}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: category.color,
                    }}
                  />
                  <Txt size={13} weight="500">
                    {category.label}
                  </Txt>
                </View>
                <Txt
                  size={12}
                  color={used > amount ? t.danger : used >= amount * 0.8 ? t.expense : t.muted}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  ¥{money(used)} / ¥{money(amount)}
                  {used > amount
                    ? ' · 已超额'
                    : used >= amount * 0.8
                      ? ' · 接近上限'
                      : ''}
                </Txt>
              </View>
              <View
                style={{
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: t.surfaceAlt,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: 5,
                    borderRadius: 3,
                    width: `${ratio * 100}%`,
                    backgroundColor: barColor,
                  }}
                />
              </View>
            </View>
          );
        })}
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
