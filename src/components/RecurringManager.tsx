import React, { useState } from 'react';
import { Switch, TextInput, View } from 'react-native';
import {
  type RecurringBill,
  amountInput,
  categoryFor,
  entryDefault,
  id,
  localDate,
  parseAmount,
} from '../domain/ledger';
import { advanceRecurring, cadenceLabel } from '../domain/recurring';
import { useLedger } from '../state/LedgerProvider';
import { useMoney } from '../state/PrivacyContext';
import { useTheme } from '../theme';
import { DateField } from './DateField';
import { Button, Txt, styles } from './ui';

export function RecurringManager({
  onBack,
  onConfirm,
}: {
  onBack: () => void;
  onConfirm: (id: string, date: string) => void;
}) {
  const t = useTheme(),
    money = useMoney();
  const { ledger: data, saving, update, recurringDisplay } = useLedger();
  const ledger = data!;
  const [form, setForm] = useState<RecurringBill | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<{
    type: 'delete' | 'skip';
    id: string;
    date: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const disabled = saving || busy;
  const input = {
    color: t.text,
    backgroundColor: t.surfaceAlt,
    borderRadius: 13,
    paddingHorizontal: 13,
    minHeight: 46,
    fontSize: 14,
  };
  const perform = async (operation: () => Promise<void>, message: string) => {
    if (disabled) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await operation();
      setNotice(message);
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败，请重试');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        variant="plain"
        disabled={disabled}
        onPress={onBack}
        style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
      >
        返回设置
      </Button>
      <View
        style={[
          styles.row,
          { justifyContent: 'space-between', gap: 15, marginVertical: 12 },
        ]}
      >
        <View style={{ flex: 1, gap: 5 }}>
          <Txt size={14} weight="500">
            启用周期账单提醒
          </Txt>
          <Txt size={11} color={t.muted}>
            到期在首页提示，确认后才记账。不会自动扣款或发送系统通知。
          </Txt>
        </View>
        <Switch
          accessibilityLabel="启用周期账单提醒"
          value={recurringDisplay.value}
          disabled={disabled}
          onValueChange={recurringDisplay.onValueChange}
          trackColor={{ true: t.accent, false: t.border }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={t.border}
        />
      </View>
      {!!(error || recurringDisplay.error) && (
        <Txt
          testID="recurring-error"
          size={12}
          color={t.danger}
          style={{ marginVertical: 10 }}
        >
          {error || recurringDisplay.error}
        </Txt>
      )}
      {!!notice && (
        <Txt size={12} color={t.accent} style={{ marginVertical: 10 }}>
          {notice}
        </Txt>
      )}
      {!form && (
        <Button
          variant="soft"
          disabled={disabled}
          onPress={() => {
            setError('');
            setNotice('');
            setConfirmation(null);
            setAmount('');
            setForm({
              ...entryDefault(ledger, 'expense'),
              id: `recurring-${id()}`,
              name: '',
              kind: 'expense',
              amount: 0,
              note: '',
              enabled: true,
              cadence: 'monthly',
              anchorDate: localDate(),
              nextDate: localDate(),
            });
          }}
        >
          新增周期账单
        </Button>
      )}
      {!form && ledger.recurringBills.length === 0 && (
        <Txt size={12} color={t.muted} style={{ marginTop: 16 }}>
          还没有周期账单，可以添加房租、会员或工资。
        </Txt>
      )}
      {!form &&
        ledger.recurringBills.map((bill) => (
          <View
            key={bill.id}
            style={{
              padding: 14,
              backgroundColor: t.surfaceAlt,
              borderRadius: 17,
              marginTop: 12,
              gap: 8,
            }}
          >
            <Button
              label={`编辑周期账单${bill.name}`}
              variant="plain"
              disabled={disabled}
              onPress={() => {
                setForm({ ...bill });
                setAmount(amountInput(bill.amount));
                setConfirmation(null);
                setError('');
              }}
              style={{ alignItems: 'stretch', paddingHorizontal: 0 }}
            >
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Txt size={14} weight="500">
                  {bill.name}
                </Txt>
                <Txt size={15}>¥{money(bill.amount)}</Txt>
              </View>
              <Txt size={11} color={t.muted}>
                {cadenceLabel[bill.cadence]} · 下次 {bill.nextDate} ·{' '}
                {categoryFor(ledger, bill.categoryId).label}
              </Txt>
              <Txt size={10} color={t.muted}>
                {!ledger.recurringEnabled
                  ? '提醒已关闭'
                  : !bill.enabled
                    ? '已暂停'
                    : bill.nextDate <= localDate()
                      ? '本期待确认'
                      : '未到期'}
              </Txt>
            </Button>
            {ledger.recurringEnabled &&
              bill.enabled &&
              bill.nextDate <= localDate() && (
                <View style={styles.row}>
                  <Button
                    variant="soft"
                    disabled={disabled}
                    style={{ flex: 1 }}
                    label={`确认周期账单${bill.name}`}
                    onPress={() => onConfirm(bill.id, bill.nextDate)}
                  >
                    确认本期
                  </Button>
                  <Button
                    variant="plain"
                    disabled={disabled}
                    style={{ flex: 1 }}
                    label={`跳过周期账单${bill.name}`}
                    onPress={() =>
                      setConfirmation({
                        type: 'skip',
                        id: bill.id,
                        date: bill.nextDate,
                      })
                    }
                  >
                    跳过本期
                  </Button>
                </View>
              )}
          </View>
        ))}
      {form && (
        <View style={{ gap: 12, marginTop: 14 }}>
          <TextInput
            accessibilityLabel="周期账单名称"
            placeholder="例如房租、会员"
            maxLength={20}
            value={form.name}
            editable={!disabled}
            onChangeText={(name) => setForm({ ...form, name })}
            style={input}
          />
          <View style={styles.row}>
            {(['expense', 'income'] as const).map((kind) => (
              <Button
                key={kind}
                disabled={disabled}
                variant={form.kind === kind ? 'soft' : 'plain'}
                onPress={() =>
                  setForm({ ...form, kind, ...entryDefault(ledger, kind) })
                }
              >
                {kind === 'expense' ? '周期支出' : '周期收入'}
              </Button>
            ))}
          </View>
          <TextInput
            accessibilityLabel="周期账单金额"
            placeholder="金额"
            inputMode="decimal"
            keyboardType="decimal-pad"
            value={amount}
            editable={!disabled}
            onChangeText={setAmount}
            style={input}
          />
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {(['weekly', 'monthly', 'yearly'] as const).map((cadence) => (
              <Button
                key={cadence}
                disabled={disabled}
                variant={form.cadence === cadence ? 'soft' : 'plain'}
                onPress={() =>
                  setForm({ ...form, cadence, anchorDate: form.nextDate })
                }
              >
                {cadenceLabel[cadence]}
              </Button>
            ))}
          </View>
          <DateField
            label="下次到期日期"
            value={form.nextDate}
            disabled={disabled}
            onChange={(nextDate) =>
              setForm({ ...form, nextDate, anchorDate: nextDate })
            }
          />
          <Txt size={10} color={t.muted}>
            月底日期在短月份按最后一天提醒，之后仍按原定日期。更改下次日期会同时调整后续提醒日期。
          </Txt>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Txt size={12}>此账单启用</Txt>
            <Switch
              accessibilityLabel="此周期账单启用"
              value={form.enabled}
              disabled={disabled}
              onValueChange={(enabled) => setForm({ ...form, enabled })}
              trackColor={{ true: t.accent, false: t.border }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={t.border}
            />
          </View>
          <Txt size={11} color={t.muted}>
            分类
          </Txt>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {ledger.categories
              .filter(
                (item) =>
                  item.kind === form.kind &&
                  (!item.hidden || item.id === form.categoryId),
              )
              .map((item) => (
                <Button
                  key={item.id}
                  label={`周期分类${item.label}`}
                  variant={form.categoryId === item.id ? 'soft' : 'plain'}
                  disabled={disabled}
                  onPress={() => setForm({ ...form, categoryId: item.id })}
                >
                  {item.label}
                </Button>
              ))}
          </View>
          <Txt size={11} color={t.muted}>
            账户
          </Txt>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {ledger.accounts.map((item) => (
              <Button
                key={item.id}
                label={`周期账户${item.name}`}
                variant={form.accountId === item.id ? 'soft' : 'plain'}
                disabled={disabled}
                onPress={() => setForm({ ...form, accountId: item.id })}
              >
                {item.name}
              </Button>
            ))}
          </View>
          <TextInput
            accessibilityLabel="周期账单备注"
            placeholder="备注（选填）"
            maxLength={120}
            value={form.note}
            editable={!disabled}
            onChangeText={(note) => setForm({ ...form, note })}
            style={input}
          />
          <View style={styles.row}>
            <Button
              variant="soft"
              disabled={disabled}
              style={{ flex: 1 }}
              onPress={() => {
                setForm(null);
                setConfirmation(null);
              }}
            >
              取消编辑
            </Button>
            <Button
              disabled={disabled}
              style={{ flex: 1 }}
              onPress={() =>
                void perform(async () => {
                  const next = { ...form, amount: parseAmount(amount) };
                  await update((current) => ({
                    ...current,
                    recurringBills: current.recurringBills.some(
                      (item) => item.id === next.id,
                    )
                      ? current.recurringBills.map((item) =>
                          item.id === next.id ? next : item,
                        )
                      : [...current.recurringBills, next],
                  }));
                  setForm(null);
                }, '周期账单已保存')
              }
            >
              保存周期账单
            </Button>
          </View>
          {ledger.recurringBills.some((item) => item.id === form.id) && (
            <Button
              variant="plain"
              disabled={disabled}
              onPress={() =>
                setConfirmation({
                  type: 'delete',
                  id: form.id,
                  date: form.nextDate,
                })
              }
            >
              <Txt size={12} color={t.danger}>
                删除周期账单
              </Txt>
            </Button>
          )}
        </View>
      )}
      {confirmation && (
        <View
          style={{
            padding: 15,
            backgroundColor: t.surfaceAlt,
            borderRadius: 17,
            gap: 12,
            marginTop: 15,
          }}
        >
          <Txt size={14} weight="500">
            {confirmation.type === 'skip'
              ? '跳过本期提醒？'
              : '删除这个周期账单？'}
          </Txt>
          <Txt size={12} color={t.muted}>
            {confirmation.type === 'skip'
              ? '本期不会新增账单，之后按下一期继续提醒。'
              : '停止之后的提醒，已经确认的账单会保留。'}
          </Txt>
          <View style={styles.row}>
            <Button
              variant="soft"
              disabled={disabled}
              style={{ flex: 1 }}
              onPress={() => setConfirmation(null)}
            >
              取消
            </Button>
            <Button
              disabled={disabled}
              style={{ flex: 1 }}
              onPress={() =>
                void perform(
                  async () => {
                    await update((current) =>
                      confirmation.type === 'skip'
                        ? advanceRecurring(
                            current,
                            confirmation.id,
                            confirmation.date,
                          )
                        : {
                            ...current,
                            recurringBills: current.recurringBills.filter(
                              (item) => item.id !== confirmation.id,
                            ),
                          },
                    );
                    if (confirmation.type === 'delete') setForm(null);
                    setConfirmation(null);
                  },
                  confirmation.type === 'skip'
                    ? '已跳过本期，未新增账单'
                    : '周期账单已删除，历史账单保留',
                )
              }
            >
              {confirmation.type === 'skip'
                ? '确认跳过本期'
                : '确认删除周期账单'}
            </Button>
          </View>
        </View>
      )}
    </>
  );
}
