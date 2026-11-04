import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { type Ledger } from '../domain/ledger';
import { annualSummary } from '../domain/annual';
import { trendAxisLabel, trendGeometry } from '../domain/expenseTrend';
import { useMoney, useAmountsHidden } from '../state/PrivacyContext';
import { useTheme } from '../theme';
import { ChartScrubber } from './ChartScrubber';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  SectionTitle,
  MoneyText,
  Txt,
  styles,
} from './ui';

export function AnnualStats({
  ledger,
  year,
  today,
  onYear,
}: {
  ledger: Ledger;
  year: number;
  today: string;
  onYear: (year: number) => void;
}) {
  const t = useTheme();
  const money = useMoney();
  const hidden = useAmountsHidden();
  const summary = useMemo(
    () => annualSummary(ledger, year, today),
    [ledger.entries, ledger.categories, year, today],
  );
  const [width, setWidth] = useState(280);
  const [selected, setSelected] = useState(1);
  const select = useCallback((index: number) => setSelected(index), []);
  const selectedMonth = Math.min(selected, summary.observedMonths);
  const maximum = trendGeometry(
    summary.monthly.flatMap((m) => [m.income, m.expense]),
    width,
    190,
  ).maximum;
  const left = 44,
    right = Math.max(left + 1, width - 10),
    top = 12,
    baseline = 160;
  const points = (kind: 'expense' | 'income') =>
    summary.monthly.slice(0, summary.observedMonths).map((m, index) => ({
      x: left + (index / 11) * (right - left),
      y: baseline - (m[kind] / maximum) * (baseline - top),
    }));
  const expense = points('expense'),
    income = points('income');
  const line = (values: typeof expense) =>
    values
      .map(
        (p, index) => `${index ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`,
      )
      .join(' ');
  const detail = summary.monthly[selectedMonth - 1]!;
  return (
    <>
      <View
        style={[
          styles.row,
          { justifyContent: 'space-between', marginBottom: 8 },
        ]}
      >
        <Txt size={29} weight="600">
          年度统计
        </Txt>
        <View style={styles.row}>
          <Button
            label="上一年"
            variant="plain"
            disabled={year <= 1900}
            onPress={() => {
              onYear(year - 1);
              setSelected(1);
            }}
            style={{ width: 36, paddingHorizontal: 0 }}
          >
            <Icon name="left" size={17} />
          </Button>
          <Txt testID="annual-year" size={13}>
            {year} 年
          </Txt>
          <Button
            label="下一年"
            variant="plain"
            disabled={year >= 2200}
            onPress={() => {
              onYear(year + 1);
              setSelected(1);
            }}
            style={{ width: 36, paddingHorizontal: 0 }}
          >
            <Icon name="right" size={17} />
          </Button>
        </View>
      </View>
      <Txt size={12} color={t.muted}>
        把一年的生活，慢慢看清。
      </Txt>
      <Card style={{ marginTop: 24 }}>
        <Txt size={12} color={t.muted}>
          全年净支出
        </Txt>
        <MoneyText
          amount={summary.expense}
          currency
          testID="annual-expense"
          size={36}
          style={{ marginVertical: 8 }}
        />
        <View style={[styles.row, { marginTop: 12 }]}>
          {[
            ['全年收入', summary.income, 'annual-income'],
            ['全年结余', summary.net, 'annual-net'],
            ['月均净支出', summary.averageExpense, 'annual-average'],
          ].map(([label, value, id]) => (
            <View key={label} style={{ flex: 1, gap: 5 }}>
              <Txt size={10} color={t.muted}>
                {label}
              </Txt>
              <MoneyText testID={String(id)} amount={Number(value)} size={14} />
            </View>
          ))}
        </View>
        <Txt size={10} color={t.muted} style={{ marginTop: 15 }}>
          截至 {summary.observedMonths} 月，月均按 {summary.observedMonths}{' '}
          个月计算。
        </Txt>
      </Card>
      <SectionTitle title="全年收支趋势" />
      <Card>
        <View
          style={[
            styles.row,
            { justifyContent: 'space-between', marginBottom: 12 },
          ]}
        >
          <Txt size={11} color={t.income}>
            ● 收入
          </Txt>
          <Txt size={11} color={t.expense}>
            ● 净支出
          </Txt>
        </View>
        <ChartScrubber
          testID="annual-trend-chart"
          count={summary.observedMonths}
          selected={selectedMonth}
          left={left}
          right={left + ((summary.observedMonths - 1) / 11) * (right - left)}
          height={190}
          label={`${year}年收支趋势，${selectedMonth}月收入 ${money(detail.income)} 元，净支出 ${money(detail.expense)} 元`}
          valueText={`${selectedMonth}月收入 ${money(detail.income)} 元，净支出 ${money(detail.expense)} 元`}
          onWidth={setWidth}
          onSelect={select}
        >
          <Svg width={width} height={190} pointerEvents="none">
            {[0, maximum / 2, maximum].map((amount) => {
              const y = baseline - (amount / maximum) * (baseline - top);
              return (
                <React.Fragment key={amount}>
                  <Line
                    x1={left}
                    x2={right}
                    y1={y}
                    y2={y}
                    stroke={t.border}
                    strokeDasharray="3 5"
                  />
                  <SvgText
                    x={left - 8}
                    y={y + 3}
                    textAnchor="end"
                    fontSize={9}
                    fill={t.muted}
                  >
                    {hidden ? '' : trendAxisLabel(amount)}
                  </SvgText>
                </React.Fragment>
              );
            })}
            <Line
              x1={expense[selectedMonth - 1]!.x}
              x2={expense[selectedMonth - 1]!.x}
              y1={top}
              y2={baseline}
              stroke={t.accent}
              strokeOpacity={0.24}
              strokeDasharray="3 4"
            />
            <Path
              d={line(income)}
              fill="none"
              stroke={t.income}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            <Path
              d={line(expense)}
              fill="none"
              stroke={t.expense}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            {[income[selectedMonth - 1]!, expense[selectedMonth - 1]!].map(
              (point, index) => (
                <Circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r={4}
                  fill={index ? t.expense : t.income}
                  stroke={t.surface}
                  strokeWidth={2}
                />
              ),
            )}
            {[1, 4, 7, 10, 12].map((month) => (
              <SvgText
                key={month}
                x={left + ((month - 1) / 11) * (right - left)}
                y={185}
                textAnchor="middle"
                fontSize={9}
                fill={t.muted}
              >
                {month}月
              </SvgText>
            ))}
          </Svg>
        </ChartScrubber>
        <View accessibilityLiveRegion="polite">
          <Txt
            testID="annual-month-detail"
            size={11}
            color={t.muted}
            style={{ textAlign: 'center', marginTop: 10 }}
          >
            {selectedMonth}月 · 收入 ¥{money(detail.income)} · 净支出 ¥
            {money(detail.expense)}
          </Txt>
        </View>
      </Card>
      <SectionTitle title="分类年度对比" />
      <Card>
        {!summary.categories.length ? (
          <EmptyState
            compact
            title="这一年的记录，等待开始"
            description="记录支出后，可以在这里查看分类与上年同期的变化。"
          />
        ) : (
          summary.categories.map((category, index) => (
            <View
              key={category.id}
              style={[
                styles.row,
                {
                  paddingVertical: 12,
                  borderBottomWidth:
                    index === summary.categories.length - 1 ? 0 : 1,
                  borderColor: t.border,
                },
              ]}
            >
              <Icon name={category.icon} color={category.color} size={20} />
              <View style={{ flex: 1, gap: 4 }}>
                <Txt size={13}>{category.label}</Txt>
                <Txt size={10} color={t.muted}>
                  上年同期 ¥{money(category.previous)}
                </Txt>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Txt size={14} weight="500">
                  ¥{money(category.total)}
                </Txt>
                <Txt size={10} color={t.muted}>
                  {category.previous
                    ? `${category.total >= category.previous ? '增加' : '减少'} ${Math.abs(((category.total - category.previous) / category.previous) * 100).toFixed(1)}%`
                    : '本期新增'}
                </Txt>
              </View>
            </View>
          ))
        )}
      </Card>
      <Txt
        size={10}
        color={t.muted}
        style={{ marginTop: 17, textAlign: 'center' }}
      >
        退款抵减原支出月份，上年同期使用相同月份范围。
      </Txt>
    </>
  );
}
