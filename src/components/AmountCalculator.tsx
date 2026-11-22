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
  const operatorKeys = new Set(['(', ')', '÷', '×', '−', '+']);
  const utilityKeys = new Set(['C', '⌫']);
  return (
    <View
      testID="amount-calculator"
      style={{
        borderRadius: 22,
        backgroundColor: t.surfaceAlt,
        borderWidth: 1,
        borderColor: t.cardBorder,
        padding: 14,
        marginTop: 14,
        marginBottom: 18,
        gap: 6,
      }}
    >
      <Txt size={12} color={t.muted} weight="500">
        {label}
      </Txt>
      <View style={[styles.row, { gap: 7 }]}>
        <Txt size={26} color={t.muted} weight="400">
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
            minHeight: 56,
            color: t.text,
            fontSize: draft.expression.length > 12 ? 26 : 42,
            fontWeight: '600',
            textAlign: 'right',
            fontVariant: ['tabular-nums'],
            paddingVertical: 2,
            outlineColor: t.accent,
            borderRadius: 8,
          }}
        />
      </View>
      <View style={{ minHeight: 20 }} accessibilityLiveRegion="polite">
        <Txt
          testID={draft.error ? 'calculator-error' : 'calculation-preview'}
          size={11}
          color={draft.error ? t.danger : t.accent}
          weight={draft.error || preview ? '500' : '400'}
          style={{ textAlign: 'right', fontVariant: ['tabular-nums'] }}
        >
          {draft.error || preview || ' '}
        </Txt>
      </View>
      <View style={[styles.row, { flexWrap: 'wrap', gap: 7, marginBottom: 6 }]}>
        {fields.map(({ label, value, target }) => (
          <Button
            key={label}
            variant="plain"
            label={label}
            disabled={disabled}
            onPress={() => reveal(target)}
            style={{
              flexDirection: 'row',
              maxWidth: '100%',
              minHeight: 40,
              paddingHorizontal: 12,
              paddingVertical: 6,
              gap: 5,
              backgroundColor: t.surface,
              borderWidth: 1,
              borderColor: t.cardBorder,
              boxShadow: t.pillShadow,
              borderRadius: 14,
            }}
          >
            <Txt size={12} weight="500" color={t.text} numberOfLines={1} style={{ flexShrink: 1 }}>
              {value}
            </Txt>
            <Icon name="down" size={12} color={t.muted} />
          </Button>
        ))}
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          rowGap: 7,
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
        ].map((key) => {
          const isEquals = key === '=';
          const isOperator = operatorKeys.has(key);
          const isUtility = utilityKeys.has(key);
          const bgColor = isEquals
            ? t.primary
            : isOperator
              ? t.accentSoft
              : isUtility
                ? t.dark
                  ? '#283A2F'
                  : '#E3EAE3'
                : t.surface;
          const borderColor = isEquals
            ? t.primaryBorder
            : isOperator
              ? t.heroBorder
              : t.cardBorder;
          const textColor = isEquals
            ? t.onPrimary
            : isOperator
              ? t.accent
              : t.text;
          return (
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
              variant={isEquals ? 'primary' : 'plain'}
              onPress={() => onChange({ type: 'key', key })}
              style={{
                width: '23.4%',
                minHeight: 45,
                backgroundColor: bgColor,
                borderWidth: 1,
                borderColor,
                boxShadow: isEquals || !isUtility ? t.pillShadow : 'none',
                borderRadius: 14,
                paddingHorizontal: 0,
                paddingVertical: 6,
              }}
            >
              <Txt
                size={isOperator || isEquals ? 19 : 18}
                weight={isEquals || isOperator ? '600' : '500'}
                color={textColor}
              >
                {key}
              </Txt>
            </Button>
          );
        })}
      </View>

    </View>
  );
}
