import React, { useMemo, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import { monthRange } from '../domain/dates';
import {
  accountPeriodBalance,
  parseReconciliationBalance,
  shiftMonth,
  type Account,
  type Entry,
} from '../domain/ledger';
import { useAmountsHidden, useMoney } from '../state/PrivacyContext';
import { useTheme } from '../theme';
import { MonthPicker } from './MonthPicker';
import { Sheet } from './Sheet';
import { Button, Card, MoneyText, SectionTitle, Txt, styles } from './ui';

function BalanceCheck({
  closing,
  endDate,
}: {
  closing: number;
  endDate: string;
}) {
  const t = useTheme();
  const money = useMoney();
  const [input, setInput] = useState('');
  const [actual, setActual] = useState<number | null>(null);
  const [error, setError] = useState('');
  const difference = actual === null ? null : actual - closing;
  return (
    <>
      <SectionTitle title="核对余额" />
      <Txt size={11} color={t.muted} style={{ marginBottom: 8 }}>
        输入 {endDate} 的实际余额，可填负数。这次核对只显示差额。
      </Txt>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <TextInput
          accessibilityLabel="实际余额"
          placeholder="输入实际余额"
          placeholderTextColor={t.subtle}
          keyboardType="numbers-and-punctuation"
          value={input}
          onChangeText={(value) => {
            setInput(value);
            setActual(null);
            setError('');
          }}
          style={{
            flex: 1,
            minWidth: 112,
            minHeight: 46,
            color: t.text,
            backgroundColor: t.surfaceAlt,
            borderRadius: 13,
            paddingHorizontal: 13,
            fontSize: 16,
          }}
        />
        <Button
          disabled={!input.trim()}
          onPress={() => {
            try {
              setActual(parseReconciliationBalance(input));
              Keyboard.dismiss();
            } catch (failure) {
              setError(
                failure instanceof Error ? failure.message : '无法核对余额',
              );
            }
          }}
        >
          开始核对
        </Button>
      </View>
      <View accessibilityLiveRegion="polite" style={{ marginTop: 8 }}>
        {error !== '' && (
          <Txt size={12} color={t.danger}>
            {error}
          </Txt>
        )}
        {difference !== null && (
          <Txt size={13} color={difference === 0 ? t.accent : t.text}>
            {difference === 0
              ? '实际余额与账面一致'
              : `实际余额比账面${difference > 0 ? '多' : '少'} ¥${money(Math.abs(difference))}`}
          </Txt>
        )}
      </View>
    </>
  );
}

export function AccountDetailsSheet({
  account,
  entries,
  initialMonth,
  today,
  onClose,
  onEntries,
}: {
  account: Account;
  entries: readonly Entry[];
  initialMonth: string;
  today: string;
  onClose: () => void;
  onEntries: (startDate: string, endDate: string) => void;
}) {
  const t = useTheme();
  const hidden = useAmountsHidden();
  const [month, setMonth] = useState(initialMonth);
  const { startDate, endDate: monthEnd } = monthRange(month);
  const endDate = today.startsWith(month) ? today : monthEnd;
  const { opening, inflow, outflow, closing } = useMemo(
    () => accountPeriodBalance(entries, account, startDate, endDate),
    [entries, account, startDate, endDate],
  );
  const amounts = [
    ['期初余额', opening],
    ['期间流入', inflow],
    ['期间流出', outflow],
    [endDate === monthEnd ? '期末余额' : '截至今日余额', closing],
  ] as const;
  return (
    <Sheet visible title={`${account.name}账户明细`} onClose={onClose}>
      <View style={{ alignItems: 'center', marginBottom: 12 }}>
        <MonthPicker
          month={month}
          labelPrefix="账户明细"
          onChange={(offset) => setMonth(shiftMonth(month, offset))}
        />
        <Txt size={11} color={t.muted}>
          {startDate} 至 {endDate}
        </Txt>
      </View>
      <Card style={{ gap: 10 }}>
        {amounts.map(([label, amount]) => (
          <View
            key={label}
            style={[
              styles.row,
              { justifyContent: 'space-between', flexWrap: 'wrap' },
            ]}
          >
            <Txt size={12} color={t.muted}>{label}</Txt>
            <MoneyText amount={amount} size={17} currency />
          </View>
        ))}
      </Card>
      <Button
        variant="soft"
        style={{ marginTop: 12 }}
        onPress={() => onEntries(startDate, endDate)}
      >
        查看期间流水
      </Button>
      {hidden ? (
        <Txt size={11} color={t.muted} style={{ marginTop: 16 }}>
          显示金额后可核对余额。
        </Txt>
      ) : (
        <BalanceCheck key={endDate} closing={closing} endDate={endDate} />
      )}
    </Sheet>
  );
}
