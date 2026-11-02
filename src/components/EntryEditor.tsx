import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  type Entry,
  type EntryKind,
  amountInput,
  expenseCategories,
  id,
  incomeCategories,
  localDate,
  parseAmount,
  upsertEntry,
  validDate,
} from '../domain/ledger';
import { useLedger } from '../state/LedgerProvider';
import { useTheme } from '../theme';
import { Sheet } from './Sheet';
import { Button, Icon, Txt, styles } from './ui';

export function EntryEditor({
  entry,
  onClose,
  onSaved,
}: {
  entry?: Entry;
  onClose: () => void;
  onSaved: (message: string, date: string) => void;
}) {
  const t = useTheme();
  const { ledger, update, saving } = useLedger();
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? 'expense');
  const [amount, setAmount] = useState(entry ? amountInput(entry.amount) : '');
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? 'food');
  const [accountId, setAccountId] = useState(
    entry?.accountId ?? ledger!.accounts[0]!.id,
  );
  const [toAccountId, setToAccountId] = useState(
    entry?.toAccountId ?? ledger!.accounts[1]?.id ?? '',
  );
  const [date, setDate] = useState(entry?.date ?? localDate());
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const categories = kind === 'income' ? incomeCategories : expenseCategories;
  const inputStyle = { color: t.text, fontSize: 14, minHeight: 46, flex: 1 };
  const save = async () => {
    setError('');
    try {
      const value = parseAmount(amount);
      if (!validDate(date))
        throw new Error('请填写有效日期，格式为 YYYY-MM-DD');
      await update((current) =>
        upsertEntry(current, {
          id: entry?.id ?? id(),
          kind,
          amount: value,
          categoryId: kind === 'transfer' ? 'transfer' : categoryId,
          accountId,
          ...(kind === 'transfer' ? { toAccountId } : {}),
          date,
          note,
          createdAt: entry?.createdAt ?? new Date().toISOString(),
        }),
      );
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      onSaved(entry ? '账单已更新' : '记下了，生活又清晰一点', date);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : '保存失败，请重试。输入内容已保留。',
      );
    }
  };
  const remove = async () => {
    if (!entry) return;
    try {
      await update((current) => ({
        ...current,
        entries: current.entries.filter((e) => e.id !== entry.id),
      }));
      onSaved('账单已删除，余额与统计已更新', entry.date);
      onClose();
    } catch {
      setError('删除失败，请稍后重试');
    }
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={entry ? '编辑账单' : '记一笔'}
      dismissible={!saving}
    >
      <View
        style={[
          styles.row,
          {
            borderRadius: 15,
            backgroundColor: t.surfaceAlt,
            padding: 4,
            gap: 4,
          },
        ]}
      >
        {(
          [
            ['expense', '支出'],
            ['income', '收入'],
            ['transfer', '转账'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            label={`记${label}`}
            disabled={saving}
            variant="plain"
            onPress={() => {
              setKind(value);
              setCategoryId(
                value === 'income'
                  ? 'salary'
                  : value === 'transfer'
                    ? 'transfer'
                    : 'food',
              );
              setError('');
            }}
            style={{
              flex: 1,
              minHeight: 39,
              backgroundColor: kind === value ? t.surface : 'transparent',
              borderRadius: 12,
              paddingHorizontal: 6,
            }}
          >
            <Txt
              color={kind === value ? t.text : t.muted}
              weight={kind === value ? '600' : '400'}
            >
              {label}
            </Txt>
          </Button>
        ))}
      </View>
      <View style={{ paddingVertical: 23 }}>
        <Txt size={11} color={t.muted}>
          {kind === 'expense'
            ? '花了多少'
            : kind === 'income'
              ? '收了多少'
              : '转账金额'}
        </Txt>
        <View style={[styles.row, { marginTop: 5, alignItems: 'center' }]}>
          <Txt size={30} color={t.muted}>
            ¥
          </Txt>
          <TextInput
            editable={!saving}
            accessibilityLabel="金额"
            placeholder="0.00"
            placeholderTextColor={t.subtle}
            inputMode="decimal"
            keyboardType="decimal-pad"
            maxLength={10}
            value={amount}
            onChangeText={setAmount}
            style={{
              flex: 1,
              fontSize: 44,
              fontWeight: '500',
              letterSpacing: -1.3,
              color: t.text,
              paddingVertical: 3,
              minHeight: 65,
              fontVariant: ['tabular-nums'],
            }}
          />
        </View>
      </View>
      {kind !== 'transfer' && (
        <>
          <Txt size={12} color={t.muted} style={{ marginBottom: 13 }}>
            选择分类
          </Txt>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 23,
            }}
          >
            {categories.map((c) => (
              <Button
                key={c.id}
                label={`分类${c.label}`}
                disabled={saving}
                variant="plain"
                onPress={() => setCategoryId(c.id)}
                style={{
                  width: '23%',
                  paddingHorizontal: 2,
                  paddingVertical: 12,
                  borderRadius: 17,
                  backgroundColor:
                    categoryId === c.id ? t.accentSoft : t.surfaceAlt,
                  borderWidth: 1,
                  borderColor: categoryId === c.id ? t.accent : 'transparent',
                  gap: 7,
                }}
              >
                <Icon
                  name={c.icon}
                  size={22}
                  color={categoryId === c.id ? t.accent : c.color}
                />
                <Txt size={11} color={categoryId === c.id ? t.accent : t.muted}>
                  {c.label}
                </Txt>
              </Button>
            ))}
          </View>
        </>
      )}
      <Txt size={12} color={t.muted} style={{ marginBottom: 10 }}>
        {kind === 'transfer'
          ? '转出账户'
          : kind === 'income'
            ? '收入账户'
            : '付款账户'}
      </Txt>
      <View
        style={[styles.row, { flexWrap: 'wrap', gap: 7, marginBottom: 21 }]}
      >
        {ledger!.accounts.map((a) => (
          <Button
            key={a.id}
            label={`账户${a.name}`}
            variant={accountId === a.id ? 'soft' : 'plain'}
            disabled={saving}
            onPress={() => setAccountId(a.id)}
            style={{
              minHeight: 37,
              paddingHorizontal: 13,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: accountId === a.id ? t.accent : t.border,
            }}
          >
            <Txt size={12} color={accountId === a.id ? t.accent : t.muted}>
              {a.name}
            </Txt>
          </Button>
        ))}
      </View>
      {kind === 'transfer' && (
        <>
          <Txt size={12} color={t.muted} style={{ marginBottom: 10 }}>
            转入账户
          </Txt>
          <View
            style={[styles.row, { flexWrap: 'wrap', gap: 7, marginBottom: 21 }]}
          >
            {ledger!.accounts
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <Button
                  key={a.id}
                  label={`转入${a.name}`}
                  variant={toAccountId === a.id ? 'soft' : 'plain'}
                  disabled={saving}
                  onPress={() => setToAccountId(a.id)}
                  style={{
                    minHeight: 37,
                    paddingHorizontal: 13,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: toAccountId === a.id ? t.accent : t.border,
                  }}
                >
                  <Txt
                    size={12}
                    color={toAccountId === a.id ? t.accent : t.muted}
                  >
                    {a.name}
                  </Txt>
                </Button>
              ))}
          </View>
          <Txt size={11} color={t.muted} style={{ marginBottom: 17 }}>
            转账仅改变账户余额，不计入收入与支出。
          </Txt>
        </>
      )}
      <View
        style={{
          backgroundColor: t.surfaceAlt,
          borderRadius: 17,
          paddingHorizontal: 15,
          marginBottom: 20,
        }}
      >
        <View
          style={[styles.row, { borderBottomWidth: 1, borderColor: t.border }]}
        >
          <Icon name="calendar" size={17} color={t.muted} />
          <Txt size={12} color={t.muted}>
            日期
          </Txt>
          <TextInput
            editable={!saving}
            accessibilityLabel="记账日期"
            placeholder="YYYY-MM-DD"
            placeholderTextColor={t.subtle}
            value={date}
            onChangeText={setDate}
            autoCapitalize="none"
            style={[inputStyle, { textAlign: 'right' }]}
          />
        </View>
        <View style={styles.row}>
          <Icon name="edit" size={17} color={t.muted} />
          <TextInput
            editable={!saving}
            accessibilityLabel="备注"
            placeholder="写点备注，留住这一刻（选填）"
            placeholderTextColor={t.subtle}
            value={note}
            maxLength={120}
            onChangeText={setNote}
            style={inputStyle}
          />
        </View>
      </View>
      {!!error && (
        <Txt
          size={12}
          color={t.danger}
          style={{ marginBottom: 12 }}
          testID="entry-error"
        >
          {error}
        </Txt>
      )}
      <Button
        disabled={saving}
        onPress={() => void save()}
        style={{ minHeight: 52, borderRadius: 18 }}
      >
        {saving ? '正在保存…' : entry ? '保存修改' : '记好了'}
      </Button>
      {entry && (
        <View style={{ marginTop: 15 }}>
          {confirmDelete ? (
            <View
              style={{
                padding: 15,
                borderRadius: 17,
                backgroundColor: t.surfaceAlt,
                gap: 12,
              }}
            >
              <Txt size={12}>确定删除这笔账单？余额和统计会同步更新。</Txt>
              <View style={styles.row}>
                <Button
                  variant="soft"
                  disabled={saving}
                  onPress={() => setConfirmDelete(false)}
                  style={{ flex: 1 }}
                >
                  保留账单
                </Button>
                <Button
                  variant="danger"
                  disabled={saving}
                  onPress={() => void remove()}
                  style={{ flex: 1 }}
                >
                  确认删除
                </Button>
              </View>
            </View>
          ) : (
            <Button
              variant="plain"
              onPress={() => setConfirmDelete(true)}
              disabled={saving}
            >
              <Txt size={12} color={t.danger}>
                删除这笔账单
              </Txt>
            </Button>
          )}
        </View>
      )}
    </Sheet>
  );
}
