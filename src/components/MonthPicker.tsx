import React, { useRef, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import { monthOffset, pickerYear } from '../domain/dates';
import { localDate, monthLabel } from '../domain/ledger';
import { useTheme } from '../theme';
import { Sheet } from './Sheet';
import { Button, Icon, Txt, styles } from './ui';

function MonthSelection({
  month,
  onSelect,
  onClose,
}: {
  month: string;
  onSelect: (month: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [year, setYear] = useState(month.slice(0, 4));
  const selected = useRef(false);
  const value = pickerYear(year);
  const choose = (next: string) => {
    if (selected.current) return;
    selected.current = true;
    Keyboard.dismiss();
    onSelect(next);
  };
  return (
    <Sheet visible title="选择月份" onClose={onClose}>
      <Txt size={12} color={t.muted} style={{ marginBottom: 14 }}>
        输入年份，点击月份即可跳转。
      </Txt>
      <View style={[styles.row, { gap: 8 }]}>
        <Button
          variant="plain"
          label="上一年"
          disabled={value === null || value === 1900}
          onPress={() => setYear(String(value! - 1))}
          style={{ width: 44, paddingHorizontal: 0 }}
        >
          <Icon name="left" />
        </Button>
        <TextInput
          accessibilityLabel="选择年份"
          inputMode="numeric"
          maxLength={4}
          value={year}
          onChangeText={setYear}
          selectTextOnFocus
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 50,
            borderRadius: 14,
            textAlign: 'center',
            color: t.text,
            backgroundColor: t.surfaceAlt,
            fontSize: 22,
            fontVariant: ['tabular-nums'],
          }}
        />
        <Button
          variant="plain"
          label="下一年"
          disabled={value === null || value === 2200}
          onPress={() => setYear(String(value! + 1))}
          style={{ width: 44, paddingHorizontal: 0 }}
        >
          <Icon name="right" />
        </Button>
      </View>
      {value === null && (
        <Txt size={12} color={t.danger} style={{ marginTop: 8 }}>
          请输入 1900–2200 之间的四位年份
        </Txt>
      )}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 18,
          marginBottom: 18,
        }}
      >
        {Array.from({ length: 12 }, (_, index) => {
          const next = `${year}-${String(index + 1).padStart(2, '0')}`;
          const selected = next === month;
          return (
            <Button
              key={index}
              label={`选择${year}年${index + 1}月${selected ? '，当前选中' : ''}`}
              variant={selected ? 'soft' : 'plain'}
              disabled={value === null}
              onPress={() => choose(next)}
              style={{
                width: '30%',
                flexGrow: 1,
                minHeight: 52,
                paddingHorizontal: 4,
                borderWidth: 1,
                borderColor: selected ? t.accent : t.border,
                borderRadius: 15,
              }}
            >
              <Txt
                size={14}
                weight={selected ? '600' : '400'}
                color={selected ? t.accent : t.text}
              >
                {index + 1} 月
              </Txt>
            </Button>
          );
        })}
      </View>
      <Button
        variant="soft"
        label="返回本月"
        onPress={() => choose(localDate().slice(0, 7))}
      >
        返回本月
      </Button>
    </Sheet>
  );
}

export function MonthPicker({
  month,
  onChange,
  labelPrefix = '',
  disabled = false,
}: {
  month: string;
  onChange: (offset: number) => void;
  labelPrefix?: string;
  disabled?: boolean;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.row, { gap: 0, flexShrink: 1, minWidth: 0 }]}>
      <Button
        variant="plain"
        label={`${labelPrefix}上个月`}
        disabled={disabled || month === '1900-01'}
        onPress={() => onChange(-1)}
        style={{ width: 44, paddingHorizontal: 0 }}
      >
        <Icon name="left" size={17} color={t.muted} />
      </Button>
      <Button
        variant="plain"
        label={`${labelPrefix}选择月份`}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={{ flexShrink: 1, paddingHorizontal: 4 }}
      >
        <Txt
          size={13}
          weight="500"
          style={{ fontVariant: ['tabular-nums'], textAlign: 'center' }}
        >
          {monthLabel(month)}
        </Txt>
      </Button>
      <Button
        variant="plain"
        label={`${labelPrefix}下个月`}
        disabled={disabled || month === '2200-12'}
        onPress={() => onChange(1)}
        style={{ width: 44, paddingHorizontal: 0 }}
      >
        <Icon name="right" size={17} color={t.muted} />
      </Button>
      {open && !disabled && (
        <MonthSelection
          month={month}
          onClose={() => setOpen(false)}
          onSelect={(next) => {
            const offset = monthOffset(month, next);
            setOpen(false);
            onChange(offset);
          }}
        />
      )}
    </View>
  );
}
