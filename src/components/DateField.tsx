import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import { calendarDays, shiftDay } from '../domain/dates';
import { localDate, monthLabel, shiftMonth, validDate } from '../domain/ledger';
import { useTheme } from '../theme';
import { Button, Icon, Txt, styles } from './ui';
import { useSheetScroll } from './sheetScroll';

export function DateField({
  label,
  value,
  onChange,
  disabled = false,
  closeCalendar = false,
  onOpen,
}: {
  label: string;
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
  closeCalendar?: boolean;
  onOpen?: () => void;
}) {
  const t = useTheme();
  const field = useRef<React.ComponentRef<typeof View>>(null);
  const calendar = useRef<React.ComponentRef<typeof View>>(null);
  const reveal = useSheetScroll();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(
    validDate(value) ? value.slice(0, 7) : localDate().slice(0, 7),
  );
  useEffect(() => {
    if (validDate(value)) setMonth(value.slice(0, 7));
  }, [value]);
  useEffect(() => {
    if (closeCalendar) setOpen(false);
  }, [closeCalendar]);
  const choose = (date: string) => {
    if (!validDate(date)) return;
    onChange(date);
    setOpen(false);
    Keyboard.dismiss();
    reveal(field);
  };
  return (
    <View ref={field} collapsable={false} style={{ gap: 9 }}>
      <View style={styles.row}>
        <Txt
          size={12}
          color={t.muted}
          style={{ flexShrink: 0, minWidth: label === '记账日期' ? 28 : 52 }}
        >
          {label === '记账日期' ? '日期' : label}
        </Txt>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          editable={!disabled}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={t.subtle}
          autoCapitalize="none"
          maxLength={10}
          style={{
            flex: 1,
            minWidth: 0,
            color: t.text,
            textAlign: 'right',
            minHeight: 46,
            fontSize: 13,
          }}
        />
        <Button
          label={`选择${label}`}
          variant="plain"
          disabled={disabled}
          onPress={() => {
            Keyboard.dismiss();
            if (!open) onOpen?.();
            setOpen(!open);
          }}
          style={{ width: 36, paddingHorizontal: 0 }}
        >
          <Icon name="calendar" size={19} />
        </Button>
      </View>
      {open && (
        <View
          ref={calendar}
          collapsable={false}
          onLayout={() => reveal(calendar)}
          testID={`calendar-${label}`}
          style={{
            borderRadius: 17,
            backgroundColor: t.surfaceAlt,
            padding: 9,
            gap: 10,
            marginBottom: 10,
          }}
        >
          <View style={[styles.row, { gap: 3 }]}>
            <Button
              variant="plain"
              label={`${label}上一年`}
              disabled={disabled || month.slice(0, 4) === '1900'}
              onPress={() => setMonth(shiftMonth(month, -12))}
              style={{ width: 31, paddingHorizontal: 0 }}
            >
              «
            </Button>
            <Button
              variant="plain"
              label={`${label}上个月`}
              disabled={disabled || month === '1900-01'}
              onPress={() => setMonth(shiftMonth(month, -1))}
              style={{ width: 31, paddingHorizontal: 0 }}
            >
              <Icon name="left" size={15} />
            </Button>
            <Txt size={12} style={{ flex: 1, textAlign: 'center' }}>
              {monthLabel(month)}
            </Txt>
            <Button
              variant="plain"
              label={`${label}下个月`}
              disabled={disabled || month === '2200-12'}
              onPress={() => setMonth(shiftMonth(month, 1))}
              style={{ width: 31, paddingHorizontal: 0 }}
            >
              <Icon name="right" size={15} />
            </Button>
            <Button
              variant="plain"
              label={`${label}下一年`}
              disabled={disabled || month.slice(0, 4) === '2200'}
              onPress={() => setMonth(shiftMonth(month, 12))}
              style={{ width: 31, paddingHorizontal: 0 }}
            >
              »
            </Button>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
              <Txt
                key={day}
                size={10}
                color={t.muted}
                style={{ width: '14.2857%', textAlign: 'center' }}
              >
                {day}
              </Txt>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {calendarDays(month).map((date, index) => (
              <View
                key={date ?? `blank-${index}`}
                style={{ width: '14.2857%', padding: 1 }}
              >
                {date ? (
                  <Button
                    label={`${label}选择${date}`}
                    variant={date === value ? 'soft' : 'plain'}
                    disabled={disabled}
                    onPress={() => choose(date)}
                    style={{
                      paddingHorizontal: 0,
                      minHeight: 36,
                      borderRadius: 12,
                    }}
                  >
                    <Txt
                      size={12}
                      weight={date === value ? '600' : '400'}
                      color={date === value ? t.accent : t.text}
                    >
                      {Number(date.slice(8))}
                    </Txt>
                  </Button>
                ) : (
                  <View style={{ height: 36 }} />
                )}
              </View>
            ))}
          </View>
          <View style={[styles.row, { justifyContent: 'center' }]}>
            <Button
              variant="soft"
              style={{ paddingHorizontal: 10 }}
              disabled={disabled}
              label={`${label}今天`}
              onPress={() => choose(localDate())}
            >
              今天
            </Button>
            <Button
              variant="plain"
              style={{ paddingHorizontal: 10 }}
              disabled={disabled}
              label={`${label}昨天`}
              onPress={() => choose(shiftDay(localDate(), -1))}
            >
              昨天
            </Button>
            <Button
              variant="plain"
              style={{ paddingHorizontal: 10 }}
              onPress={() => setOpen(false)}
            >
              收起日历
            </Button>
          </View>
        </View>
      )}
      {!open && label === '记账日期' && (
        <View
          style={[styles.row, { marginBottom: 9, justifyContent: 'flex-end' }]}
        >
          <Button
            variant="plain"
            disabled={disabled}
            label="记账日期今天"
            onPress={() => choose(localDate())}
            style={{ minHeight: 32 }}
          >
            今天
          </Button>
          <Button
            variant="plain"
            disabled={disabled}
            label="记账日期昨天"
            onPress={() => choose(shiftDay(localDate(), -1))}
            style={{ minHeight: 32 }}
          >
            昨天
          </Button>
        </View>
      )}
    </View>
  );
}
