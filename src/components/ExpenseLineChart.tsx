import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useMoney, useAmountsHidden } from '../state/PrivacyContext';
import { trendAxisLabel, trendGeometry } from '../domain/expenseTrend';
import { useTheme } from '../theme';
import { MoneyText, Txt, styles } from './ui';
import { ChartScrubber } from './ChartScrubber';

export function ExpenseLineChart({
  values,
  month,
}: {
  values: number[];
  month: string;
}) {
  const t = useTheme();
  const money = useMoney();
  const hidden = useAmountsHidden();
  const [width, setWidth] = useState(280);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [aboveFinger, setAboveFinger] = useState(true);
  const select = useCallback((day: number, above: boolean) => {
    setSelectedDay(day);
    setAboveFinger(above);
  }, []);
  useEffect(() => setSelectedDay(null), [month, values.length]);
  const height = 180;
  const chart = trendGeometry(values, width, height);
  const selected =
    selectedDay === null ? undefined : chart.points[selectedDay - 1];
  const highest = chart.points.find((p) => p.amount === chart.peak);
  const ticks = chart.peak ? [0, chart.maximum / 2, chart.maximum] : [0];
  const dayTicks = [
    ...new Set(
      Array.from(
        { length: 5 },
        (_, i) => Math.round((i / 4) * (values.length - 1)) + 1,
      ),
    ),
  ];
  const gradient = `daily-expense-${month}`;
  return (
    <>
      <View
        style={[
          styles.row,
          { justifyContent: 'space-between', marginBottom: 12 },
        ]}
      >
        <Txt size={11} color={t.muted}>
          每日花费，清晰有度
        </Txt>
        <Txt size={11} color={t.accent}>
          最高 ¥{money(chart.peak)}
        </Txt>
      </View>
      <ChartScrubber
        testID="daily-expense-chart"
        count={values.length}
        selected={selectedDay ?? 1}
        left={chart.left}
        right={chart.right}
        height={height}
        label={`${Number(month.slice(5))}月每日支出折线图，最高 ${money(chart.peak)} 元`}
        valueText={`${selectedDay ?? 1}日支出 ${money(values[(selectedDay ?? 1) - 1] ?? 0)} 元`}
        onWidth={setWidth}
        onSelect={select}
      >
        <Svg
          pointerEvents="none"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
        >
          <Defs>
            <LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.accent} stopOpacity={0.19} />
              <Stop offset="1" stopColor={t.accent} stopOpacity={0.015} />
            </LinearGradient>
          </Defs>
          {ticks.map((value) => {
            const y =
              chart.baseline -
              (value / chart.maximum) * (chart.baseline - chart.top);
            return (
              <React.Fragment key={value}>
                <Line
                  x1={chart.left}
                  x2={chart.right}
                  y1={y}
                  y2={y}
                  stroke={t.border}
                  strokeDasharray={value ? '3 5' : undefined}
                />
                <SvgText
                  x={chart.left - 9}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill={t.muted}
                >
                  {hidden ? '' : trendAxisLabel(value)}
                </SvgText>
              </React.Fragment>
            );
          })}
          {chart.peak > 0 && values.length > 1 && (
            <Path d={chart.area} fill={`url(#${gradient})`} />
          )}
          <Path
            d={chart.line}
            fill="none"
            stroke={t.accent}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={chart.peak ? 1 : 0.5}
          />
          {!selected && highest && (chart.peak > 0 || values.length === 1) && (
            <Circle
              cx={highest.x}
              cy={highest.y}
              r={3.5}
              fill={t.accent}
              stroke={t.surface}
              strokeWidth={2}
            />
          )}
          {selected && (
            <>
              <Line
                x1={selected.x}
                x2={selected.x}
                y1={chart.top}
                y2={chart.baseline}
                stroke={t.accent}
                strokeOpacity={0.3}
                strokeDasharray="3 4"
              />
              <Circle
                cx={selected.x}
                cy={selected.y}
                r={9}
                fill={t.accent}
                opacity={0.12}
              />
              <Circle
                cx={selected.x}
                cy={selected.y}
                r={4}
                fill={t.accent}
                stroke={t.surface}
                strokeWidth={2}
              />
            </>
          )}
          {dayTicks.map((day) => {
            const point = chart.points[day - 1]!;
            return (
              <SvgText
                key={day}
                x={point.x}
                y={height - 5}
                textAnchor="middle"
                fontSize={9}
                fill={t.muted}
              >
                {day}日
              </SvgText>
            );
          })}
        </Svg>
        {selected && (
          <View
            testID="daily-expense-tooltip"
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            aria-hidden
            style={{
              position: 'absolute',
              width: 132,
              left: Math.max(
                0,
                Math.min(
                  width - 132,
                  selected.x + (selected.x < width / 2 ? 14 : -146),
                ),
              ),
              top: aboveFinger ? 4 : height - 74,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 14,
              backgroundColor: t.surface,
              borderWidth: 1,
              borderColor: t.border,
              boxShadow: `0 4px 16px ${t.shadow}`,
            }}
          >
            <Txt size={10} color={t.muted}>
              {Number(month.slice(5))}月{selected.day}日 · 净支出
            </Txt>
            <MoneyText amount={selected.amount} currency size={17} />
          </View>
        )}
      </ChartScrubber>
      <View
        accessibilityLiveRegion="polite"
        style={{
          minHeight: 26,
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <Txt
          testID="daily-expense-selection"
          size={11}
          color={selected ? t.accent : t.muted}
        >
          {selected
            ? `${Number(month.slice(5))}月${selected.day}日 · 支出 ¥${money(selected.amount)}`
            : chart.peak
              ? '轻触或横向拖动，查看每天支出'
              : '本月暂无支出记录'}
        </Txt>
      </View>
    </>
  );
}
