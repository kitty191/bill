import { MonthPicker } from '../components/MonthPicker';
import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  SectionList,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type Entry,
  type EntryKind,
  type Ledger,
  totals,
} from '../domain/ledger';
import { useTheme } from '../theme';
import {
  buildEntryIndex,
  filterEntryIndex,
  emptyFilters,
  entryGroups,
  amountFilterLabel,
} from '../domain/entryFilters';
import { EntryFilterSheet } from '../components/EntryFilterSheet';
import { useAmountsHidden, useMoney } from '../state/PrivacyContext';
import {
  Button,
  Card,
  EmptyState,
  EntryRow,
  Icon,
  MoneyText,
  Txt,
  dateHeading,
  styles,
} from '../components/ui';

export type EntriesListHandle = { scrollToTop: () => void };
type EntrySection = ReturnType<typeof entryGroups>[number] & {
  key: string;
  data: Entry[];
};

export function EntriesScreen({
  today,
  ledger,
  month,
  onMonth,
  onEntry,
  onEntryActions,
  onAdd,
  resetKey,
  focusDate,
  listRef,
}: {
  today: string;
  ledger: Ledger;
  month: string;
  onMonth: (offset: number) => void;
  onEntry: (entry: Entry) => void;
  onEntryActions: (entry: Entry) => void;
  onAdd: () => void;
  resetKey: number;
  focusDate?: string;
  listRef: React.Ref<EntriesListHandle>;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const profile = `${width}:${fontScale}`;
  const [geometry, setGeometry] = useState({
    profile,
    header: 0,
    row: 0,
    section: 0,
  });
  const measure = useCallback(
    (part: 'header' | 'row' | 'section', height: number) => {
      setGeometry((current) => {
        const base =
          current.profile === profile
            ? current
            : { profile, header: 0, row: 0, section: 0 };
        if (
          (part !== 'header' && base[part] > 0) ||
          Math.abs(base[part] - height) < 0.01
        )
          return base;
        return { ...base, [part]: height };
      });
    },
    [profile],
  );
  const list = useRef<SectionList<Entry, EntrySection>>(null);
  const scrollToTop = useCallback(
    () =>
      list.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false }),
    [],
  );
  useImperativeHandle(listRef, () => ({ scrollToTop }), [scrollToTop]);
  const money = useMoney();
  const amountsHidden = useAmountsHidden();
  const [filter, setFilter] = useState<EntryKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const filtering = query !== deferredQuery;
  const [advanced, setAdvanced] = useState(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const amountLabel = amountFilterLabel(advanced, amountsHidden);
  const active =
    !!deferredQuery ||
    filter !== 'all' ||
    advanced.range ||
    advanced.accountId !== 'all' ||
    advanced.categoryId !== 'all' ||
    !!advanced.minAmount?.trim() ||
    !!advanced.maxAmount?.trim();
  const todayOnly =
    filter === 'expense' &&
    !query.trim() &&
    advanced.range &&
    advanced.startDate === today &&
    advanced.endDate === today &&
    advanced.accountId === 'all' &&
    advanced.categoryId === 'all' &&
    !advanced.minAmount?.trim() &&
    !advanced.maxAmount?.trim();
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
    scrollToTop();
  }, [resetKey, focusDate, scrollToTop]);
  const index = useMemo(
    () => buildEntryIndex(ledger),
    [ledger.entries, ledger.accounts, ledger.categories],
  );
  const entries = useMemo(
    () => filterEntryIndex(index, month, filter, deferredQuery, advanced),
    [index, month, deferredQuery, filter, advanced],
  );
  const { income, expense, grossExpense, refunded } = useMemo(
    () => ({
      ...totals(entries, ledger.entries),
      grossExpense: entries.reduce(
        (sum, entry) => sum + (entry.kind === 'expense' ? entry.amount : 0),
        0,
      ),
      refunded: entries.reduce(
        (sum, entry) => sum + (entry.kind === 'refund' ? entry.amount : 0),
        0,
      ),
    }),
    [entries, ledger.entries],
  );
  const groups = useMemo(
    () => entryGroups(entries, ledger.entries),
    [entries, ledger.entries],
  );
  const sections = useMemo(
    () => groups.map((day) => ({ ...day, key: day.date, data: day.entries })),
    [groups],
  );
  const itemLayout = useMemo(() => {
    // Supply offsets from the first render; visible cells replace estimates
    // with measured values before a user can jump to unmeasured records.
    const measured = geometry.profile === profile;
    const rowHeight =
      (measured && geometry.row) ||
      Math.max(43, 37.5 * fontScale + 2) + 32 + StyleSheet.hairlineWidth;
    const sectionHeight = (measured && geometry.section) || 19.5 * fontScale;
    const frames: { index: number; offset: number; length: number }[] = [];
    let offset = measured ? geometry.header : 0;
    const add = (length: number) => {
      frames.push({ index: frames.length, offset, length });
      offset += length;
    };
    for (const section of sections) {
      add(sectionHeight + 34);
      section.data.forEach((_entry, index) =>
        add(
          rowHeight +
            (index === 0 ? 1 : 0) +
            (index === section.data.length - 1
              ? 1 - StyleSheet.hairlineWidth
              : 0),
        ),
      );
      add(0);
    }
    return (_data: unknown, index: number) => frames[index]!;
  }, [sections, geometry, profile, fontScale]);
  const header = (
    <View
      onLayout={(event) => measure('header', event.nativeEvent.layout.height)}
    >
      <View
        style={[
          styles.row,
          {
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 7,
          },
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
          <MoneyText amount={expense} currency size={width < 360 ? 17 : 22} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt size={11} color={t.muted}>
            {active ? '筛选收入' : '本月收入'}
          </Txt>
          <MoneyText
            amount={income}
            currency
            size={width < 360 ? 17 : 22}
            color={t.income}
          />
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
              advanced.accountId !== 'all' ||
              !!advanced.minAmount?.trim() ||
              !!advanced.maxAmount?.trim()
                ? t.accent
                : t.muted
            }
          />
        </Button>
        <TextInput
          accessibilityLabel="搜索账单"
          placeholder="搜索备注、分类、账户或金额"
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
              : ''}
            {amountLabel ? ` · ${amountLabel}` : ''}
            {` · ${entries.length} 笔`}
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
      {filtering && (
        <Txt
          testID="entries-filtering"
          size={10}
          color={t.muted}
          style={{ marginTop: 7 }}
        >
          正在筛选…
        </Txt>
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
    </View>
  );
  return (
    <SectionList<Entry, EntrySection>
      ref={list}
      testID="page-entries-scroll"
      sections={sections}
      keyExtractor={(item) => item.id}
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingBottom: Math.max(insets.bottom, 20) + 110,
      }}
      nestedScrollEnabled
      directionalLockEnabled
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={5}
      getItemLayout={itemLayout}
      ListHeaderComponent={header}
      ListFooterComponent={
        entries.length > 0 ? (
          <Txt
            size={11}
            color={t.subtle}
            style={{ textAlign: 'center', marginTop: 25 }}
          >
            共 {entries.length} 笔 · 好好生活，慢慢记录
          </Txt>
        ) : undefined
      }
      renderSectionHeader={({ section: day }) => (
        <View
          onLayout={(event) =>
            measure('section', event.nativeEvent.layout.height)
          }
          style={[
            styles.row,
            {
              justifyContent: 'space-between',
              marginTop: 24,
              marginBottom: 10,
            },
          ]}
        >
          <Txt
            size={13}
            weight="500"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {dateHeading(day.date, today)}{' '}
            <Txt size={10} color={t.muted}>
              {day.date.slice(5).replace('-', '.')}
            </Txt>
          </Txt>
          <Txt
            size={10}
            color={t.muted}
            numberOfLines={1}
            style={{ flexShrink: 1, textAlign: 'right' }}
          >
            {day.expense > 0 ? `净支出 ${money(day.expense)}` : ''}
            {day.expense > 0 && day.income > 0 ? '  ·  ' : ''}
            {day.income > 0 ? `收入 ${money(day.income)}` : ''}
          </Txt>
        </View>
      )}
      renderItem={({ item, index, section }) => {
        const first = index === 0,
          last = index === section.data.length - 1;
        return (
          <View
            onLayout={(event) =>
              measure(
                'row',
                event.nativeEvent.layout.height -
                  (first ? 1 : 0) -
                  (last ? 1 : 0) +
                  (last ? StyleSheet.hairlineWidth : 0),
              )
            }
            style={{
              backgroundColor: t.surface,
              paddingHorizontal: 16,
              borderTopLeftRadius: first ? 24 : 0,
              borderTopRightRadius: first ? 24 : 0,
              borderBottomLeftRadius: last ? 24 : 0,
              borderBottomRightRadius: last ? 24 : 0,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderTopWidth: first ? 1 : 0,
              borderBottomWidth: last ? 1 : 0,
              borderColor: t.dark ? t.border : '#E8EDE5',
            }}
          >
            <EntryRow
              entry={item}
              ledger={ledger}
              onPress={() => onEntry(item)}
              onLongPress={() => onEntryActions(item)}
              last={last}
            />
          </View>
        );
      }}
    />
  );
}
