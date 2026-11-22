import { MonthPageHeader } from '../components/MonthPicker';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { dailyExpenseValues } from '../domain/expenseTrend';
import { ExpenseLineChart } from '../components/ExpenseLineChart';
import {
  type Ledger,
  categoryTotals,
  monthEntries,
  shiftMonth,
  totals,
} from '../domain/ledger';
import { useTheme } from '../theme';
import { useMoney } from '../state/PrivacyContext';
import {
  Card,
  Button,
  EmptyState,
  Icon,
  MoneyText,
  SectionTitle,
  Txt,
  styles,
} from '../components/ui';
import { AnnualStats } from '../components/AnnualStats';

function MonthlyStats({
  today,
  ledger,
  month,
  onMonth,
  onCategoryExpenses,
  onDayExpenses,
}: {
  today: string;
  ledger: Ledger;
  month: string;
  onMonth: (offset: number) => void;
  onCategoryExpenses: (categoryId: string, month?: string) => void;
  onDayExpenses: (date: string) => void;
}) {
  const t = useTheme();
  const money = useMoney();
  const entries = useMemo(
    () => monthEntries(ledger, month),
    [ledger.entries, month],
  );
  const { expense, income } = useMemo(
    () => totals(entries, ledger.entries),
    [entries, ledger.entries],
  );
  const priorMonth = shiftMonth(month, -1);
  const priorEntries = useMemo(
    () => monthEntries(ledger, priorMonth),
    [ledger.entries, priorMonth],
  );
  const previous = useMemo(
    () => totals(priorEntries, ledger.entries).expense,
    [ledger.entries, priorEntries],
  );
  const categories = useMemo(
    () => categoryTotals(entries, ledger.categories, ledger.entries),
    [entries, ledger.categories, ledger.entries],
  );
  const changes = useMemo(() => {
    const before = new Map(categoryTotals(priorEntries, ledger.categories, ledger.entries).map((c) => [c.id, c.total]));
    const after = new Map(categories.map((c) => [c.id, c.total]));
    return ledger.categories.map((category) => {
      const current = after.get(category.id) ?? 0;
      const prior = before.get(category.id) ?? 0;
      return { ...category, current, prior, change: current - prior };
    }).filter((category) => category.change !== 0)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 3);
  }, [priorEntries, ledger.categories, ledger.entries, categories]);
  const daily = useMemo(
    () => dailyExpenseValues(ledger.entries, month, today),
    [ledger.entries, month, today],
  );
  const totalDays = useMemo(
    () => new Set(entries.map((e) => e.date)).size,
    [entries],
  );
  const circumference = 2 * Math.PI * 66;
  let running = 0;
  return (
    <>
      <MonthPageHeader title="统计" month={month} onChange={onMonth} />
      <Card style={{ marginTop: 0 }}>
        <Txt size={12} color={t.muted} weight="500">
          本月总支出
        </Txt>
        <MoneyText
          amount={expense}
          currency
          size={36}
          style={{ marginVertical: 6, fontWeight: '600' }}
        />
        <View
          style={[
            styles.row,
            {
              alignSelf: 'flex-start',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 10,
              backgroundColor: t.surfaceAlt,
              gap: 6,
            },
          ]}
        >
          <Icon name="trend" size={13} color={t.accent} />
          <Txt size={11} color={t.muted}>
            {previous
              ? `较上月${expense >= previous ? '增加' : '减少'} ${Math.abs(((expense - previous) / previous) * 100).toFixed(1)}%`
              : '上月暂无支出，慢慢积累你的记录'}
          </Txt>
        </View>
        <View
          style={[
            styles.row,
            {
              borderTopWidth: 1,
              borderColor: t.border,
              marginTop: 18,
              paddingTop: 16,
              gap: 0,
            },
          ]}
        >
          {[
            ['收入', income],
            ['结余', income - expense],
            ['记账天数', totalDays],
          ].map(([label, value], index) => (
            <React.Fragment key={label}>
              {index > 0 && (
                <View
                  style={{
                    width: 1,
                    height: 28,
                    backgroundColor: t.border,
                    marginHorizontal: 10,
                  }}
                />
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Txt size={11} color={t.muted}>
                  {label}
                </Txt>
                {label === '记账天数' ? (
                  <Txt size={15} weight="600" style={{ fontVariant: ['tabular-nums'] }}>
                    {value} 天
                  </Txt>
                ) : (
                  <MoneyText
                    amount={Number(value)}
                    size={15}
                    color={label === '收入' ? t.income : t.text}
                    style={{ fontWeight: '600' }}
                  />
                )}
              </View>
            </React.Fragment>
          ))}
        </View>
      </Card>
      <SectionTitle title="支出分布" />
      <Card>
        {!expense ? (
          <EmptyState
            compact
            title="你的消费画像，等待点亮"
            description="记录支出后，这里会呈现每个分类的占比。"
          />
        ) : (
          <>
            <View
              style={{
                alignSelf: 'center',
                width: 180,
                height: 180,
                marginVertical: 8,
              }}
            >
              <Svg
                width={180}
                height={180}
                viewBox="0 0 180 180"
                accessibilityLabel="支出分类占比图"
                role="img"
              >
                <Circle
                  cx={90}
                  cy={90}
                  r={66}
                  fill="none"
                  stroke={t.surfaceAlt}
                  strokeWidth={18}
                />
                {categories.map((c) => {
                  const length = (c.total / expense) * circumference;
                  const offset = running;
                  running += length;
                  return (
                    <Circle
                      key={c.id}
                      cx={90}
                      cy={90}
                      r={66}
                      fill="none"
                      stroke={c.color}
                      strokeWidth={18}
                      strokeDasharray={`${Math.max(0, length - 3)} ${circumference - Math.max(0, length - 3)}`}
                      strokeDashoffset={-offset}
                      rotation={-90}
                      origin="90, 90"
                      strokeLinecap="round"
                    />
                  );
                })}
              </Svg>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  inset: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt size={11} color={t.muted}>
                  支出分类
                </Txt>
                <Txt size={28} weight="600" style={{ fontVariant: ['tabular-nums'] }}>
                  {categories.length}
                  <Txt size={11} color={t.muted}>
                    {' '}
                    类
                  </Txt>
                </Txt>
              </View>
            </View>
            <View style={{ marginTop: 6, gap: 4 }}>
              {categories.map((c) => (
                <Button
                  key={c.id}
                  variant="plain"
                  label={`查看${c.label}支出账单，${money(c.total)} 元`}
                  onPress={() => onCategoryExpenses(c.id)}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-start',
                    minHeight: 48,
                    paddingHorizontal: 4,
                    paddingVertical: 6,
                    borderRadius: 14,
                    gap: 11,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      backgroundColor: `${c.color}${t.dark ? '24' : '16'}`,
                      borderWidth: 1,
                      borderColor: `${c.color}${t.dark ? '2E' : '22'}`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={c.icon} color={c.color} size={17} />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View
                      style={[
                        styles.row,
                        {
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 4,
                        },
                      ]}
                    >
                      <Txt size={13} weight="500">
                        {c.label}{' '}
                        <Txt color={t.muted} size={11}>
                          {((c.total / expense) * 100).toFixed(1)}%
                        </Txt>
                      </Txt>
                      <Txt
                        size={14}
                        weight="600"
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        ¥{money(c.total)}
                      </Txt>
                    </View>
                    <View
                      style={{
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: t.surfaceAlt,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${(c.total / expense) * 100}%`,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: c.color,
                        }}
                      />
                    </View>
                  </View>
                  <Icon name="right" color={t.muted} size={13} />
                </Button>
              ))}
            </View>
          </>
        )}
      </Card>
      <SectionTitle title="每日支出" />
      <Card>
        <ExpenseLineChart
          values={daily}
          month={month}
          onDayExpenses={onDayExpenses}
        />
      </Card>
      {(expense > 0 || previous > 0) && (
        <>
          <SectionTitle title="月度回顾" />
          <Card style={{ gap: 12 }}>
            <Txt size={14} weight="600">
              {expense === previous ? '净支出与上月持平' : `净支出较上月${expense > previous ? '增加' : '减少'} ¥${money(Math.abs(expense - previous))}`}
            </Txt>
            {changes.map((category, index) => (
              <View
                key={category.id}
                style={[
                  styles.row,
                  {
                    flexWrap: 'wrap',
                    paddingTop: index === 0 ? 4 : 10,
                    borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderColor: t.border,
                  },
                ]}
              >
                <View style={[styles.row, { flexGrow: 1, gap: 8 }]}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: category.color,
                    }}
                  />
                  <Txt size={13} style={{ flexShrink: 1 }}>
                    {category.label} {category.change > 0 ? '多' : '少'} ¥{money(Math.abs(category.change))}
                  </Txt>
                </View>
                {category.current > 0 && (
                  <Button
                    variant="soft"
                    label={`查看回顾中的本月${category.label}`}
                    onPress={() => onCategoryExpenses(category.id)}
                    style={{ minHeight: 32, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}
                  >
                    <Txt size={12} color={t.accent} weight="500">本月</Txt>
                  </Button>
                )}
                {category.prior > 0 && (
                  <Button
                    variant="plain"
                    label={`查看回顾中的上月${category.label}`}
                    onPress={() => onCategoryExpenses(category.id, priorMonth)}
                    style={{ minHeight: 32, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}
                  >
                    <Txt size={12} color={t.muted} weight="500">上月</Txt>
                  </Button>
                )}
              </View>
            ))}
          </Card>
        </>
      )}
      <Txt
        size={11}
        color={t.subtle}
        style={{ textAlign: 'center', marginTop: 22 }}
      >
        退款抵减原支出，转账不计入收支统计
      </Txt>
    </>
  );
}

export function StatsScreen(props: React.ComponentProps<typeof MonthlyStats>) {
  const theme = useTheme();
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [year, setYear] = useState(Number(props.month.slice(0, 4)));
  const selectedYear = props.month.slice(0, 4);
  useEffect(() => setYear(Number(selectedYear)), [selectedYear]);
  return (
    <>
      <View
        style={[
          styles.row,
          {
            alignSelf: 'flex-start',
            backgroundColor: theme.surfaceAlt,
            borderRadius: 14,
            padding: 3,
            gap: 3,
            marginBottom: 14,
          },
        ]}
      >
        {(
          [
            ['month', '按月', '按月统计'],
            ['year', '按年', '按年统计'],
          ] as const
        ).map(([value, text, label]) => (
          <Button
            key={value}
            label={label}
            variant="plain"
            onPress={() => setMode(value)}
            style={{
              minHeight: 34,
              paddingHorizontal: 16,
              paddingVertical: 5,
              borderRadius: 11,
              backgroundColor:
                mode === value
                  ? theme.dark
                    ? theme.accentSoft
                    : theme.surface
                  : 'transparent',
              boxShadow: mode === value ? theme.pillShadow : 'none',
            }}
          >
            <Txt
              size={13}
              color={mode === value ? theme.accent : theme.muted}
              weight={mode === value ? '600' : '500'}
            >
              {text}
            </Txt>
          </Button>
        ))}
      </View>
      {mode === 'month' ? (
        <MonthlyStats {...props} />
      ) : (
        <AnnualStats
          ledger={props.ledger}
          today={props.today}
          year={year}
          onYear={setYear}
        />
      )}
    </>
  );
}
