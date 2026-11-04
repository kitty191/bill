import React, { useRef, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import { calculateAmount } from '../domain/calculator';
import { amountInput } from '../domain/ledger';
import { useTheme } from '../theme';
import { Button, Txt, styles } from './ui';
import { useSheetScroll } from './sheetScroll';

export function AmountCalculator({
  initial,
  onApply,
  onClose,
  disabled,
  returnTo,
}: {
  initial: string;
  onApply: (amount: string) => void;
  onClose: () => void;
  disabled: boolean;
  returnTo?: React.RefObject<React.ComponentRef<typeof View> | null>;
}) {
  const t = useTheme();
  const panel = useRef<React.ComponentRef<typeof View>>(null);
  const reveal = useSheetScroll();
  const [expression, setExpression] = useState(initial);
  const [error, setError] = useState('');
  const close = () => {
    onClose();
    if (returnTo) reveal(returnTo);
  };
  const apply = () => {
    try {
      const amount = amountInput(calculateAmount(expression));
      onApply(amount);
      Keyboard.dismiss();
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : '计算式无效');
    }
  };
  return (
    <View
      ref={panel}
      collapsable={false}
      onLayout={() => reveal(panel)}
      style={{
        borderRadius: 20,
        backgroundColor: t.surfaceAlt,
        padding: 13,
        marginBottom: 20,
        gap: 10,
      }}
    >
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Txt size={13} weight="500">
          金额计算器
        </Txt>
        <Button variant="plain" disabled={disabled} onPress={close}>
          收起计算器
        </Button>
      </View>
      <TextInput
        accessibilityLabel="计算表达式"
        placeholder="例如 (26 + 15) ÷ 2"
        placeholderTextColor={t.subtle}
        value={expression}
        onChangeText={(value) => {
          setExpression(value);
          setError('');
        }}
        editable={!disabled}
        showSoftInputOnFocus={false}
        maxLength={120}
        style={{
          color: t.text,
          minHeight: 46,
          fontSize: 23,
          textAlign: 'right',
          paddingHorizontal: 7,
        }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
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
                ? '使用计算结果'
                : key === 'C'
                  ? '清空计算式'
                  : key === '⌫'
                    ? '删除计算末位'
                    : `计算键${key}`
            }
            disabled={disabled}
            variant={key === '=' ? 'primary' : 'plain'}
            onPress={() => {
              if (key === '=') {
                apply();
                return;
              }
              setError('');
              setExpression((value) =>
                key === 'C'
                  ? ''
                  : key === '⌫'
                    ? value.slice(0, -1)
                    : (value + key).slice(0, 120),
              );
            }}
            style={{
              width: '23%',
              minHeight: 43,
              backgroundColor: key === '=' ? t.accent : t.surface,
              borderRadius: 13,
            }}
          >
            <Txt size={18} color={key === '=' ? t.background : t.text}>
              {key}
            </Txt>
          </Button>
        ))}
      </View>
      <Txt size={10} color={t.muted}>
        结果四舍五入到分，确认记账后才写入账本。
      </Txt>
      {!!error && (
        <Txt testID="calculator-error" size={12} color={t.danger}>
          {error}
        </Txt>
      )}
    </View>
  );
}
