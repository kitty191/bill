import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import {
  type Entry,
  type EntryKind,
  type Ledger,
  totals,
} from '../domain/ledger';
import { useTheme } from '../theme';
import {
  filteredEntries,
  emptyFilters,
  entryGroups,
} from '../domain/entryFilters';
import { EntryFilterSheet } from '../components/EntryFilterSheet';
import { useMoney } from '../state/PrivacyContext';
import {
  Button,
  Card,
  EmptyState,
  EntryRow,
  Icon,
  MonthPicker,
  Txt,
  dateHeading,
  styles,
} from '../components/ui';

export function EntriesScreen({
  today,
  ledger,
  month,
  onMonth,
  onEntry,
  onAdd,
  resetKey,
  focusDate,
}: {
  today: string;
  ledger: Ledger;
  month: string;
  onMonth: (offset: number) => void;
  onEntry: (entry: Entry) => void;
  onAdd: () => void;
  resetKey: number;
  focusDate?: string;
}) {
  const t = useTheme();
  const money = useMoney();
  const [filter, setFilter] = useState<EntryKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [advanced, setAdvanced] = useState(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const active =
    !!query ||
    filter !== 'all' ||
    advanced.range ||
    advanced.accountId !== 'all' ||
    advanced.categoryId !== 'all';
  const todayOnly =
    filter === 'expense' &&
    !query.trim() &&
    advanced.range &&
    advanced.startDate === today &&
    advanced.endDate === today &&
    advanced.accountId === 'all' &&
    advanced.categoryId === 'all';
  useEffect(() => {
    setAdvanced((value) => {
      const categoryId =
        value.categoryId === 'all' ||
        value.categoryId === 'transfer' ||
        ledger.categories.some((category) => category.id === value.categoryId)
          ? value.categoryId
          : 'all';
      const accountId =
        value.accountId === 'all' ||
        ledger.accounts.some((account) => account.id === value.accountId)
          ? value.accountId
          : 'all';
      return categoryId === value.categoryId && accountId === value.accountId
        ? value
        : { ...value, categoryId, accountId };
    });
  }, [ledger.categories, ledger.accounts]);
  useEffect(() => {
    setFilter(focusDate ? 'expense' : 'all');
    setQuery('');
    setAdvanced(
      focusDate
        ? {
            ...emptyFilters(),
            range: true,
            startDate: focusDate,
            endDate: focusDate,
          }
        : emptyFilters(),
    );
    setFiltersOpen(false);
  }, [resetKey, focusDate]);
  const entries = useMemo(
    () => filteredEntries(ledger, month, filter, query, advanced),
    [ledger, month, query, filter, advanced],
  );
  const { income, expense } = totals(entries, ledger.entries);
  const grossExpense = entries.reduce(
    (sum, entry) => sum + (entry.kind === 'expense' ? entry.amount : 0),
    0,
  );
  const refunded = entries.reduce(
    (sum, entry) => sum + (entry.kind === 'refund' ? entry.amount : 0),
    0,
  );
  const groups = useMemo(
    () => entryGroups(entries, ledger.entries),
    [entries, ledger.entries],
  );
  return (
    <>
      <View
        style={[
          styles.row,
          { justifyContent: 'space-between', marginBottom: 7 },
        ]}
      >
        <Txt size={29} weight="600">
          账单
        </Txt>
        <MonthPicker
          month={month}
          onChange={(offset) => {
            setAdvanced((value) => ({ ...value, range: false }));
            onMonth(offset);
          }}
        />
      </View>
      <Txt color={t.muted} size={12}>
        每一笔小事，都值得被记住。
      </Txt>
      <Card style={{ marginTop: 24, flexDirection: 'row', gap: 20 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt size={11} color={t.muted}>
            {active ? '筛选支出' : '本月支出'}
          </Txt>
          <Txt size={22} weight="500">
            ¥{money(expense)}
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt size={11} color={t.muted}>
            {active ? '筛选收入' : '本月收入'}
          </Txt>
          <Txt size={22} weight="500" color={t.income}>
            ¥{money(income)}
          </Txt>
        </View>
      </Card>
      {filter === 'expense' && grossExpense > expense && (
        <Txt
          testID="expense-refund-summary"
          size={10}
          color={t.muted}
          style={{ marginTop: 10 }}
        >
          原支出 ¥{money(grossExpense)} · 已退 ¥{money(grossExpense - expense)}
        </Txt>
      )}
      {refunded > 0 && (
        <Txt size={10} color={t.muted} style={{ marginTop: 10 }}>
          退款到账 ¥{money(refunded)} · 抵减原支出，不计收入
        </Txt>
      )}
      <View
        style={[
          styles.row,
          {
            borderRadius: 15,
            backgroundColor: t.surface,
            paddingHorizontal: 15,
            marginTop: 18,
            marginBottom: 14,
          },
        ]}
      >
        <Icon name="search" size={17} color={t.muted} />
        <Button
          variant="plain"
          label="打开组合筛选"
          onPress={() => {
            Keyboard.dismiss();
            setFiltersOpen(true);
          }}
          style={{ paddingHorizontal: 5 }}
        >
          <Icon
            name="list"
            size={19}
            color={
              advanced.range ||
              advanced.categoryId !== 'all' ||
              advanced.accountId !== 'all'
                ? t.accent
                : t.muted
            }
          />
        </Button>
        <TextInput
          accessibilityLabel="搜索账单"
          placeholder="搜索备注、分类或账户"
          placeholderTextColor={t.subtle}
          value={query}
          onChangeText={setQuery}
          style={{ flex: 1, height: 46, color: t.text, fontSize: 13 }}
        />
        {query.length > 0 && (
          <Button
            variant="plain"
            label="清除搜索"
            onPress={() => setQuery('')}
            style={{ paddingHorizontal: 0 }}
          >
            <Icon name="close" size={15} color={t.muted} />
          </Button>
        )}
      </View>
      <View style={[styles.row, { gap: 7 }]}>
        {(
          [
            ['all', '全部'],
            ['expense', '支出'],
            ['income', '收入'],
            ['transfer', '转账'],
            ['refund', '退款'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            variant={filter === value ? 'soft' : 'plain'}
            onPress={() => {
              setFilter(value);
              const category = ledger.categories.find(
                (item) => item.id === advanced.categoryId,
              );
              if (
                value !== 'all' &&
                ((value === 'transfer' && advanced.categoryId !== 'transfer') ||
                  (value !== 'transfer' &&
                    (advanced.categoryId === 'transfer' ||
                      (category &&
                        category.kind !==
                          (value === 'income' ? 'income' : 'expense')))))
              )
                setAdvanced((current) => ({ ...current, categoryId: 'all' }));
            }}
            label={`筛选${label}`}
            style={{
              flex: 1,
              minHeight: 39,
              borderRadius: 13,
              paddingHorizontal: 8,
            }}
          >
            <Txt
              size={12}
              color={filter === value ? t.accent : t.muted}
              weight={filter === value ? '600' : '400'}
            >
              {label}
            </Txt>
          </Button>
        ))}
      </View>
      {active && (
        <View style={[styles.row, { marginTop: 10, flexWrap: 'wrap', gap: 4 }]}>
          <Txt
            testID="active-entry-filters"
            size={10}
            color={t.muted}
            style={{ flex: 1 }}
          >
            {advanced.range
              ? `${advanced.startDate} 至 ${advanced.endDate}`
              : '当前月份'}
            {advanced.categoryId !== 'all'
              ? ` · ${advanced.categoryId === 'transfer' ? '转账' : ledger.categories.find((category) => category.id === advanced.categoryId)?.label}`
              : ''}
            {advanced.accountId !== 'all'
              ? ` · ${ledger.accounts.find((account) => account.id === advanced.accountId)?.name}`
              : ''}{' '}
            · {entries.length} 笔
          </Txt>
          <Button
            variant="plain"
            onPress={() => {
              setFilter('all');
              setQuery('');
              setAdvanced(emptyFilters());
            }}
            style={{ paddingHorizontal: 5, minHeight: 32 }}
          >
            清除筛选
          </Button>
        </View>
      )}
      {filtersOpen && (
        <EntryFilterSheet
          ledger={ledger}
          kind={filter}
          month={month}
          value={advanced}
          onApply={setAdvanced}
          onClose={() => setFiltersOpen(false)}
        />
      )}
      {!entries.length && (
        <EmptyState
          title={
            todayOnly
              ? '今天还没有支出'
              : active
                ? '没有找到这些账单'
                : '这个月，留一点生活的痕迹'
          }
          description={
            todayOnly
              ? '从一笔小花费开始，记录今天的生活。'
              : active
                ? '换个关键词或筛选条件试试。'
                : '记下一笔，让收支慢慢清晰起来。'
          }
          action={todayOnly ? '记下今天第一笔' : !active ? '记一笔' : undefined}
          onAction={onAdd}
        />
      )}
      {groups.map((day) => {
        const { date, entries: list } = day;
        return (
          <View key={date} style={{ marginTop: 24 }}>
            <View
              style={[
                styles.row,
                { justifyContent: 'space-between', marginBottom: 10 },
              ]}
            >
              <Txt size={13} weight="500">
                {dateHeading(date, today)}{' '}
                <Txt size={10} color={t.muted}>
                  {date.slice(5).replace('-', '.')}
                </Txt>
              </Txt>
              <Txt size={10} color={t.muted}>
                {day.expense > 0 ? `净支出 ${money(day.expense)}` : ''}
                {day.expense > 0 && day.income > 0 ? '  ·  ' : ''}
                {day.income > 0 ? `收入 ${money(day.income)}` : ''}
              </Txt>
            </View>
            <Card style={{ paddingVertical: 0, paddingHorizontal: 16 }}>
              {list.map((entry, i) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  ledger={ledger}
                  onPress={() => onEntry(entry)}
                  last={i === list.length - 1}
                />
              ))}
            </Card>
          </View>
        );
      })}
      {entries.length > 0 && (
        <Txt
          size={11}
          color={t.subtle}
          style={{ textAlign: 'center', marginTop: 25 }}
        >
          共 {entries.length} 笔 · 好好生活，慢慢记录
        </Txt>
      )}
    </>
  );
}
