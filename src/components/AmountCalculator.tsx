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
  fields,
}: {
  draft: CalculatorDraft;
  onChange: (action: CalculatorAction) => void;
  disabled: boolean;
  label: string;
  fields: { label: string; value: string; target: React.RefObject<SheetView | null> }[];
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
            fontSize: draft.expression.length > 12 ? 26 : 42,
            fontWeight: '500',
            textAlign: 'right',
            fontVariant: ['tabular-nums'],
            paddingVertical: 3,
            outlineColor: t.accent,
            borderRadius: 8,
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
      <View style={[styles.row, { flexWrap: 'wrap', gap: 6, marginBottom: 4 }]}>
        {fields.map(({ label, value, target }) => (
          <Button key={label} variant="plain" label={label} disabled={disabled}
            onPress={() => reveal(target)}
            style={{ flexDirection: 'row', maxWidth: '100%', minHeight: 44,
              paddingHorizontal: 10, backgroundColor: t.surface, borderRadius: 12 }}>
            <Txt size={12} color={t.text} numberOfLines={1} style={{ flexShrink: 1 }}>{value}</Txt>
            <Icon name="down" size={12} color={t.muted} />
          </Button>
        ))}
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

    </View>
  );
}
