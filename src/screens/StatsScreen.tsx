import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { dailyExpenseValues } from '../domain/expenseTrend';
import { ExpenseLineChart } from '../components/ExpenseLineChart';
import {
  type Ledger,
  categoryTotals,
  money,
  monthEntries,
  shiftMonth,
  totals,
} from '../domain/ledger';
import { useTheme } from '../theme';
import {
  Card,
  EmptyState,
  Icon,
  MonthPicker,
  SectionTitle,
  Txt,
  styles,
} from '../components/ui';

export function StatsScreen({
  today,
  ledger,
  month,
  onMonth,
}: {
  today: string;
  ledger: Ledger;
  month: string;
  onMonth: (offset: number) => void;
}) {
  const t = useTheme();
  const entries = monthEntries(ledger, month);
  const { expense, income } = totals(entries);
  const previous = totals(monthEntries(ledger, shiftMonth(month, -1))).expense;
  const categories = categoryTotals(entries);
  const daily = useMemo(
    () => dailyExpenseValues(ledger.entries, month, today),
    [ledger.entries, month, today],
  );
  const totalDays = new Set(entries.map((e) => e.date)).size;
  const circumference = 2 * Math.PI * 66;
  let running = 0;
  return (
    <>
      <View
        style={[
          styles.row,
          { justifyContent: 'space-between', marginBottom: 7 },
        ]}
      >
        <Txt size={29} weight="600">
          统计
        </Txt>
        <MonthPicker month={month} onChange={onMonth} />
      </View>
      <Txt color={t.muted} size={12}>
        看懂花费，把钱花在喜欢的生活上。
      </Txt>
      <Card style={{ marginTop: 24 }}>
        <Txt size={12} color={t.muted}>
          本月总支出
        </Txt>
        <Txt
          size={35}
          weight="500"
          style={{ marginVertical: 7, letterSpacing: -1 }}
        >
          ¥{money(expense)}
        </Txt>
        <View style={styles.row}>
          <Icon name="trend" size={13} color={t.muted} />
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
              marginTop: 20,
              paddingTop: 16,
            },
          ]}
        >
          {[
            ['收入', income],
            ['结余', income - expense],
            ['记账天数', totalDays],
          ].map(([label, value]) => (
            <View key={label} style={{ flex: 1, gap: 4 }}>
              <Txt size={10} color={t.muted}>
                {label}
              </Txt>
              <Txt size={15} weight="500">
                {label === '记账天数' ? `${value} 天` : money(Number(value))}
              </Txt>
            </View>
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
                marginVertical: 6,
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
                <Txt size={29} weight="500">
                  {categories.length}
                  <Txt size={11} color={t.muted}>
                    {' '}
                    类
                  </Txt>
                </Txt>
              </View>
            </View>
            {categories.map((c, i) => (
              <View key={c.id} style={[styles.row, { marginTop: 16, gap: 12 }]}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 11,
                    backgroundColor: `${c.color}18`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={c.icon} color={c.color} size={16} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <View
                    style={[styles.row, { justifyContent: 'space-between' }]}
                  >
                    <Txt size={12}>
                      {c.label}{' '}
                      <Txt color={t.muted} size={10}>
                        {((c.total / expense) * 100).toFixed(1)}%
                      </Txt>
                    </Txt>
                    <Txt size={13} weight="500">
                      {money(c.total)}
                    </Txt>
                  </View>
                  <View
                    style={{
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: t.surfaceAlt,
                    }}
                  >
                    <View
                      style={{
                        width: `${(c.total / expense) * 100}%`,
                        height: 3,
                        borderRadius: 2,
                        backgroundColor: c.color,
                      }}
                    />
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </Card>
      <SectionTitle title="每日支出" />
      <Card>
        <ExpenseLineChart values={daily} month={month} />
      </Card>
      <Txt
        size={10}
        color={t.subtle}
        style={{ textAlign: 'center', marginTop: 22 }}
      >
        账户转账不计入收支统计
      </Txt>
    </>
  );
}
