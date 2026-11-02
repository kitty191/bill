import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import {
  type Entry,
  type EntryKind,
  type Ledger,
  allCategories,
  money,
  monthEntries,
  totals,
} from '../domain/ledger';
import { useTheme } from '../theme';
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
  ledger,
  month,
  onMonth,
  onEntry,
  onAdd,
}: {
  ledger: Ledger;
  month: string;
  onMonth: (offset: number) => void;
  onEntry: (entry: Entry) => void;
  onAdd: () => void;
}) {
  const t = useTheme();
  const [filter, setFilter] = useState<EntryKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const entries = useMemo(
    () =>
      monthEntries(ledger, month).filter(
        (e) =>
          (filter === 'all' || e.kind === filter) &&
          `${e.note} ${allCategories.find((c) => c.id === e.categoryId)?.label} ${ledger.accounts.find((a) => a.id === e.accountId)?.name} ${ledger.accounts.find((a) => a.id === e.toAccountId)?.name ?? ''}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [ledger, month, query, filter],
  );
  const { income, expense } = totals(monthEntries(ledger, month));
  const dates = [...new Set(entries.map((e) => e.date))];
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
        <MonthPicker month={month} onChange={onMonth} />
      </View>
      <Txt color={t.muted} size={12}>
        每一笔小事，都值得被记住。
      </Txt>
      <Card style={{ marginTop: 24, flexDirection: 'row', gap: 20 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt size={11} color={t.muted}>
            本月支出
          </Txt>
          <Txt size={22} weight="500">
            ¥{money(expense)}
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt size={11} color={t.muted}>
            本月收入
          </Txt>
          <Txt size={22} weight="500" color={t.income}>
            ¥{money(income)}
          </Txt>
        </View>
      </Card>
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
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            variant={filter === value ? 'soft' : 'plain'}
            onPress={() => setFilter(value)}
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
      {!entries.length && (
        <EmptyState
          title={
            query || filter !== 'all'
              ? '没有找到这些账单'
              : '这个月，留一点生活的痕迹'
          }
          description={
            query || filter !== 'all'
              ? '换个关键词或筛选条件试试。'
              : '记下一笔，让收支慢慢清晰起来。'
          }
          action={!query && filter === 'all' ? '记一笔' : undefined}
          onAction={onAdd}
        />
      )}
      {dates.map((date) => {
        const list = entries.filter((e) => e.date === date);
        const day = totals(list);
        return (
          <View key={date} style={{ marginTop: 24 }}>
            <View
              style={[
                styles.row,
                { justifyContent: 'space-between', marginBottom: 10 },
              ]}
            >
              <Txt size={13} weight="500">
                {dateHeading(date)}{' '}
                <Txt size={10} color={t.muted}>
                  {date.slice(5).replace('-', '.')}
                </Txt>
              </Txt>
              <Txt size={10} color={t.muted}>
                {day.expense > 0 ? `支出 ${money(day.expense)}` : ''}
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
