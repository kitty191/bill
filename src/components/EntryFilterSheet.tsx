import React, { useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import {
  type Ledger,
  type EntryKind,
  transferCategory,
} from '../domain/ledger';
import {
  type EntryFilters,
  dateFilterPresets,
  emptyFilters,
  validateFilters,
} from '../domain/entryFilters';
import { monthRange } from '../domain/dates';
import { useTheme } from '../theme';
import { Sheet } from './Sheet';
import { DateField } from './DateField';
import { Button, SectionTitle, Txt, styles } from './ui';

const dateOptions = [
  ['month', '当前月份'],
  ['recent', '近 7 天'],
  ['previous', '上月'],
  ['custom', '自定义日期'],
] as const;
type DateOption = (typeof dateOptions)[number][0];

export function EntryFilterSheet({
  ledger,
  kind,
  month,
  today,
  value,
  onApply,
  onClose,
}: {
  ledger: Ledger;
  kind: EntryKind | 'all';
  month: string;
  today: string;
  value: EntryFilters;
  onApply: (value: EntryFilters) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const presets = dateFilterPresets(today);
  const [draft, setDraft] = useState({
    ...value,
    ...(!value.range
      ? monthRange(month)
      : value.datePreset && presets[value.datePreset]),
  });
  const [dateOption, setDateOption] = useState<DateOption>(
    value.range ? value.datePreset ?? 'custom' : 'month',
  );
  const [error, setError] = useState('');
  const [calendarField, setCalendarField] = useState<'start' | 'end' | null>(
    null,
  );
  const changeDraft = (change: Partial<EntryFilters>) => {
    setDraft((current) => ({ ...current, ...change }));
    setError('');
  };
  const selectDateOption = (option: DateOption) => {
    const preset =
      option === 'recent' || option === 'previous' ? presets[option] : null;
    Keyboard.dismiss();
    setDateOption(option);
    setCalendarField(null);
    changeDraft({ range: option !== 'month', ...preset });
  };
  const categories = [
    ...ledger.categories.filter(
      (category) =>
        kind === 'all' ||
        (kind !== 'transfer' &&
          category.kind === (kind === 'income' ? 'income' : 'expense')),
    ),
    ...(['all', 'transfer'].includes(kind) ? [transferCategory] : []),
  ];
  return (
    <Sheet visible onClose={onClose} title="筛选账单">
      <SectionTitle title="时间范围" />
      <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
        {dateOptions.map(([option, label]) => (
          <Button
            key={option}
            variant={dateOption === option ? 'soft' : 'plain'}
            selected={dateOption === option}
            disabled={option === 'previous' && !presets.previous}
            onPress={() => selectDateOption(option)}
            style={{ paddingHorizontal: 10 }}
          >
            {label}
          </Button>
        ))}
      </View>
      {draft.range && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <DateField
            label="开始日期"
            closeCalendar={calendarField !== 'start'}
            onOpen={() => setCalendarField('start')}
            value={draft.startDate}
            onChange={(startDate) => {
              setDateOption('custom');
              changeDraft({ startDate });
            }}
          />
          <DateField
            label="结束日期"
            closeCalendar={calendarField !== 'end'}
            onOpen={() => setCalendarField('end')}
            value={draft.endDate}
            onChange={(endDate) => {
              setDateOption('custom');
              changeDraft({ endDate });
            }}
          />
        </View>
      )}
      <SectionTitle title="金额区间" />
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {(['minAmount', 'maxAmount'] as const).map((field) => (
          <View key={field} style={{ flex: 1, minWidth: 100, gap: 6 }}>
            <Txt size={12} color={t.muted}>
              {field === 'minAmount' ? '最低金额' : '最高金额'}
            </Txt>
            <TextInput
              accessibilityLabel={
                field === 'minAmount' ? '最低金额' : '最高金额'
              }
              placeholder="不限"
              placeholderTextColor={t.subtle}
              inputMode="decimal"
              value={draft[field] ?? ''}
              maxLength={10}
              onChangeText={(value) => changeDraft({ [field]: value })}
              style={{
                minHeight: 48,
                borderRadius: 13,
                paddingHorizontal: 12,
                fontSize: 16,
                color: t.text,
                backgroundColor: t.surfaceAlt,
              }}
            />
          </View>
        ))}
      </View>
      <SectionTitle title="分类" />
      <View style={[styles.row, { flexWrap: 'wrap', gap: 7 }]}>
        <Button
          label="筛选全部分类"
          variant={draft.categoryId === 'all' ? 'soft' : 'plain'}
          onPress={() => changeDraft({ categoryId: 'all' })}
        >
          全部分类
        </Button>
        {categories.map((category) => (
          <Button
            key={category.id}
            label={`筛选分类${category.label}`}
            variant={draft.categoryId === category.id ? 'soft' : 'plain'}
            onPress={() => changeDraft({ categoryId: category.id })}
          >
            {category.label}
          </Button>
        ))}
      </View>
      <SectionTitle title="账户" />
      <View style={[styles.row, { flexWrap: 'wrap', gap: 7 }]}>
        <Button
          label="筛选全部账户"
          variant={draft.accountId === 'all' ? 'soft' : 'plain'}
          onPress={() => changeDraft({ accountId: 'all' })}
        >
          全部账户
        </Button>
        {ledger.accounts.map((account) => (
          <Button
            key={account.id}
            label={`筛选账户${account.name}`}
            variant={draft.accountId === account.id ? 'soft' : 'plain'}
            onPress={() => changeDraft({ accountId: account.id })}
          >
            {account.name}
          </Button>
        ))}
      </View>
      <View accessibilityLiveRegion="polite">
        {!!error && (
          <Txt
            testID="filter-error"
            color={t.danger}
            size={12}
            style={{ marginTop: 14 }}
          >
            {error}
          </Txt>
        )}
      </View>
      <View style={[styles.row, { marginTop: 24 }]}>
        <Button
          variant="soft"
          style={{ flex: 1 }}
          onPress={() => {
            setDraft({ ...emptyFilters(), ...monthRange(month) });
            setDateOption('month');
            setCalendarField(null);
            setError('');
          }}
        >
          重置筛选
        </Button>
        <Button
          style={{ flex: 1 }}
          onPress={() => {
            try {
              const datePreset =
                dateOption === 'recent' || dateOption === 'previous'
                  ? dateOption
                  : undefined;
              onApply(validateFilters({ ...draft, datePreset }));
              onClose();
            } catch (error) {
              setError(error instanceof Error ? error.message : '筛选条件无效');
            }
          }}
        >
          应用筛选
        </Button>
      </View>
    </Sheet>
  );
}
