import React, { useReducer, useRef, useState } from 'react';
import { ScrollView, Switch, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  type Entry,
  type EntryKind,
  amountInput,
  id,
  localDate,
  upsertEntry,
  validDate,
  categoryFor,
  entryDefault,
  remainingRefund,
  validateLedger,
} from '../domain/ledger';
import { useLedger } from '../state/LedgerProvider';
import { useTheme } from '../theme';
import { Sheet } from './Sheet';
import { Button, Icon, Txt, styles } from './ui';
import { DateField } from './DateField';
import { AmountCalculator } from './AmountCalculator';
import {
  calculateAmount,
  calculatorDraft,
  calculatorReducer,
  type CalculatorAction,
} from '../domain/calculator';

export function EntryEditor({
  entry,
  refundOf,
  templateId,
  onRefund,
  onClose,
  onSaved,
}: {
  entry?: Entry;
  refundOf?: Entry;
  templateId?: string;
  onRefund: (entry: Entry) => void;
  onClose: () => void;
  onSaved: (message: string, date: string, entryId?: string) => void;
}) {
  const t = useTheme();
  const details = useRef<React.ComponentRef<typeof View>>(null);
  const { ledger, update, saving, removeEntry } = useLedger();
  const data = ledger!;
  const preset = data.templates.find((template) => template.id === templateId);
  const original =
    refundOf ??
    (entry?.kind === 'refund'
      ? data.entries.find((item) => item.id === entry.originalEntryId)
      : undefined);
  const initialKind = original
    ? 'refund'
    : (entry?.kind ?? preset?.kind ?? 'expense');
  const initialDefault = entryDefault(
    data,
    initialKind === 'income' ? 'income' : 'expense',
  );
  const [kind, setKind] = useState<EntryKind>(initialKind);
  const [draft, dispatchAmount] = useReducer(
    calculatorReducer,
    entry
      ? amountInput(entry.amount)
      : preset
        ? amountInput(preset.amount)
        : '',
    calculatorDraft,
  );
  const amount = draft.expression;
  const [categoryId, setCategoryId] = useState(
    original?.categoryId ??
      entry?.categoryId ??
      preset?.categoryId ??
      initialDefault.categoryId,
  );
  const [accountId, setAccountId] = useState(
    entry?.accountId ??
      original?.accountId ??
      preset?.accountId ??
      initialDefault.accountId,
  );
  const [toAccountId, setToAccountId] = useState(
    entry?.toAccountId ??
      data.accounts.find((account) => account.id !== initialDefault.accountId)
        ?.id ??
      '',
  );
  const [date, setDate] = useState(entry?.date ?? localDate());
  const [note, setNote] = useState(
    entry?.note ??
      preset?.note ??
      (original
        ? `${original.note || categoryFor(data, original.categoryId).label}退款`.slice(
            0,
            120,
          )
        : ''),
  );
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const changeAmount = (action: CalculatorAction) => {
    dispatchAmount(action);
    setError('');
  };
  const categories = data.categories.filter(
    (category) =>
      category.kind === (kind === 'income' ? 'income' : 'expense') &&
      (!category.hidden || (entry && category.id === categoryId)),
  );
  const shortcuts = data.templates.filter(
    (template) =>
      template.kind === kind &&
      !data.categories.find((category) => category.id === template.categoryId)
        ?.hidden,
  );
  const refundable = original
    ? remainingRefund(data, original) +
      (entry?.kind === 'refund' ? entry.amount : 0)
    : 0;
  const inputStyle = { color: t.text, fontSize: 14, minHeight: 46, flex: 1 };
  const save = async () => {
    setError('');
    try {
      if (!amount.trim()) throw new Error('请输入金额');
      const value = calculateAmount(amount);
      if (!validDate(date))
        throw new Error('请填写有效日期，格式为 YYYY-MM-DD');
      const entryId = entry?.id ?? id();
      await update((current) => {
        const next = upsertEntry(
          current,
          {
            id: entryId,
            kind,
            amount: value,
            categoryId: kind === 'transfer' ? 'transfer' : categoryId,
            accountId,
            ...(kind === 'transfer' ? { toAccountId } : {}),
            ...(kind === 'refund' ? { originalEntryId: original?.id } : {}),
            date,
            note,
            createdAt: entry?.createdAt ?? new Date().toISOString(),
          },
          !entry && kind !== 'refund',
        );
        if (!saveTemplate || kind === 'refund' || kind === 'transfer')
          return next;
        return validateLedger({
          ...next,
          templates: [
            ...next.templates,
            {
              id: `template-${id()}`,
              name: templateName,
              kind,
              amount: value,
              categoryId,
              accountId,
              note,
            },
          ],
        });
      });
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      onSaved(entry ? '账单已更新' : '已记好', date, entryId);
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
      await removeEntry(entry.id);
      onSaved('账单已删除，余额与统计已更新', entry.date);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : '删除失败，请稍后重试');
    }
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={
        kind === 'refund'
          ? entry
            ? '编辑退款'
            : '记录退款'
          : entry
            ? '编辑账单'
            : '记一笔'
      }
      dismissible={!saving}
      footer={
        <View>
          {!!error && (
            <Txt
              testID="entry-error"
              size={12}
              color={t.danger}
              style={{ marginBottom: 9 }}
            >
              {error}
            </Txt>
          )}
          <Button
            disabled={saving}
            onPress={() => void save()}
            style={{ minHeight: 50, borderRadius: 18 }}
          >
            {saving
              ? '正在保存…'
              : entry
                ? '保存修改'
                : kind === 'refund'
                  ? '确认退款'
                  : '记好了'}
          </Button>
        </View>
      }
    >
      {kind !== 'refund' && (
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
                const defaults = entryDefault(
                  data,
                  value === 'income' ? 'income' : 'expense',
                );
                setCategoryId(
                  value === 'transfer' ? 'transfer' : defaults.categoryId,
                );
                if (!entry) setAccountId(defaults.accountId);
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
      )}
      {kind === 'refund' && original && (
        <View
          style={{
            backgroundColor: t.accentSoft,
            borderRadius: 17,
            padding: 15,
            marginTop: 8,
            gap: 6,
          }}
        >
          <Txt size={13} weight="500">
            原支出：
            {original.note || categoryFor(data, original.categoryId).label}
          </Txt>
          <Txt size={12} color={t.muted}>
            {original.date} · 原金额 ¥{amountInput(original.amount)} · 可退 ¥
            {amountInput(refundable)}
          </Txt>
          <Txt size={11} color={t.muted}>
            退款抵减原支出所属月份，到账金额计入下方账户。
          </Txt>
        </View>
      )}
      {!entry && kind !== 'refund' && shortcuts.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 15 }}
        >
          {shortcuts.map((template) => (
            <Button
              key={template.id}
              variant="soft"
              label={`使用常用${template.name}`}
              onPress={() => {
                changeAmount({
                  type: 'seed',
                  value: amountInput(template.amount),
                });
                setCategoryId(template.categoryId);
                setAccountId(template.accountId);
                setNote(template.note);
                setError('');
              }}
            >
              {template.name}
            </Button>
          ))}
        </ScrollView>
      )}
      <AmountCalculator
        draft={draft}
        onChange={changeAmount}
        disabled={saving}
        details={details}
        label={
          kind === 'expense'
            ? '花了多少'
            : kind === 'income'
              ? '收了多少'
              : kind === 'refund'
                ? '退回多少'
                : '转账金额'
        }
        summary={`${kind === 'refund' ? '退款' : kind === 'transfer' ? '转账' : categoryFor(data, categoryId).label} · ${data.accounts.find((account) => account.id === accountId)?.name} · ${date}`}
      />
      <View ref={details} collapsable={false}>
        {kind !== 'transfer' && kind !== 'refund' && (
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
                  <Txt
                    size={11}
                    color={categoryId === c.id ? t.accent : t.muted}
                  >
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
              : kind === 'refund'
                ? '退款到账账户'
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
              onPress={() => {
                setAccountId(a.id);
                if (toAccountId === a.id)
                  setToAccountId(
                    data.accounts.find((account) => account.id !== a.id)?.id ??
                      '',
                  );
              }}
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
              style={[
                styles.row,
                { flexWrap: 'wrap', gap: 7, marginBottom: 21 },
              ]}
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
          <DateField
            label="记账日期"
            value={date}
            onChange={setDate}
            disabled={saving}
          />
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
        {!entry && (kind === 'expense' || kind === 'income') && (
          <View
            style={{
              backgroundColor: t.surfaceAlt,
              borderRadius: 17,
              padding: 14,
              marginBottom: 18,
              gap: 10,
            }}
          >
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Txt size={12}>同时存为常用</Txt>
              <Switch
                accessibilityLabel="同时存为常用"
                value={saveTemplate}
                onValueChange={setSaveTemplate}
                disabled={saving}
                trackColor={{ true: t.accent, false: t.border }}
              />
            </View>
            {saveTemplate && (
              <TextInput
                accessibilityLabel="常用名称"
                placeholder="例如早餐、通勤、咖啡"
                maxLength={20}
                value={templateName}
                onChangeText={setTemplateName}
                editable={!saving}
                style={inputStyle}
              />
            )}
          </View>
        )}
        {entry?.kind === 'expense' && remainingRefund(data, entry) > 0 && (
          <Button
            variant="soft"
            disabled={saving}
            style={{ marginTop: 12 }}
            onPress={() => {
              if (
                amount !== amountInput(entry.amount) ||
                categoryId !== entry.categoryId ||
                accountId !== entry.accountId ||
                date !== entry.date ||
                note !== entry.note ||
                kind !== entry.kind
              ) {
                setError('请先保存原账单的修改，再记录退款');
                return;
              }
              onRefund(entry);
            }}
          >
            记录退款
          </Button>
        )}
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
      </View>
    </Sheet>
  );
}
