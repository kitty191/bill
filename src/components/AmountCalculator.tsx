import React, { useMemo } from 'react';
import { TextInput, View } from 'react-native';
import {
  calculateAmount,
  type CalculatorAction,
  type CalculatorDraft,
} from '../domain/calculator';
import { amountInput } from '../domain/ledger';
import { useTheme } from '../theme';
import { Button, Icon, Txt, styles } from './ui';
import { useSheetScroll, type SheetView } from './sheetScroll';

export function AmountCalculator({
  draft,
  onChange,
  disabled,
  label,
  summary,
  details,
}: {
  draft: CalculatorDraft;
  onChange: (action: CalculatorAction) => void;
  disabled: boolean;
  label: string;
  summary: string;
  details: React.RefObject<SheetView | null>;
}) {
  const t = useTheme();
  const reveal = useSheetScroll();
  const preview = useMemo(() => {
    if (!/[+\-−×÷*/()]|\.\d{3}/.test(draft.expression)) return '';
    try {
      return `= ¥${amountInput(calculateAmount(draft.expression))}`;
    } catch {
      return '';
    }
  }, [draft.expression]);
  return (
    <View
      testID="amount-calculator"
      style={{
        borderRadius: 21,
        backgroundColor: t.surfaceAlt,
        padding: 12,
        marginTop: 14,
        marginBottom: 16,
        gap: 5,
      }}
    >
      <Txt size={11} color={t.muted}>
        {label}
      </Txt>
      <View style={[styles.row, { gap: 7 }]}>
        <Txt size={26} color={t.muted}>
          ¥
        </Txt>
        <TextInput
          accessibilityLabel="金额"
          placeholder="0.00"
          placeholderTextColor={t.subtle}
          value={draft.expression}
          onChangeText={(value) => onChange({ type: 'text', value })}
          editable={!disabled}
          inputMode="none"
          showSoftInputOnFocus={false}
          maxLength={120}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 58,
            color: t.text,
            fontSize: draft.expression.length > 12 ? 26 : 38,
            fontWeight: '500',
            textAlign: 'right',
            fontVariant: ['tabular-nums'],
            paddingVertical: 3,
          }}
        />
      </View>
      <View style={{ minHeight: 21 }} accessibilityLiveRegion="polite">
        <Txt
          testID={draft.error ? 'calculator-error' : 'calculation-preview'}
          size={11}
          color={draft.error ? t.danger : t.muted}
          style={{ textAlign: 'right' }}
        >
          {draft.error || preview || ' '}
        </Txt>
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          rowGap: 5,
        }}
      >
        {[
          'C',
          '(',
          ')',
          '÷',
          '7',
          '8',
          '9',
          '×',
          '4',
          '5',
          '6',
          '−',
          '1',
          '2',
          '3',
          '+',
          '⌫',
          '0',
          '.',
          '=',
        ].map((key) => (
          <Button
            key={key}
            label={
              key === '='
                ? '计算结果'
                : key === 'C'
                  ? '清空金额'
                  : key === '⌫'
                    ? '删除计算末位'
                    : `计算键${key}`
            }
            disabled={disabled}
            variant={key === '=' ? 'primary' : 'plain'}
            onPress={() => onChange({ type: 'key', key })}
            style={{
              width: '23.5%',
              minHeight: 42,
              backgroundColor: key === '=' ? t.accent : t.surface,
              borderRadius: 13,
              paddingHorizontal: 0,
            }}
          >
            <Txt size={18} color={key === '=' ? t.background : t.text}>
              {key}
            </Txt>
          </Button>
        ))}
      </View>
      <Button
        variant="plain"
        label="选择分类、账户和日期"
        disabled={disabled}
        onPress={() => reveal(details)}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 7,
          paddingHorizontal: 3,
          minHeight: 33,
          marginTop: 4,
        }}
      >
        <Txt size={10} color={t.muted} numberOfLines={1} style={{ flex: 1 }}>
          {summary}
        </Txt>
        <Icon name="down" size={15} color={t.muted} />
      </Button>
    </View>
  );
}
