import React, { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
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
import { Txt, styles } from './ui';

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
      <Pressable
        testID="daily-expense-chart"
        accessibilityRole="adjustable"
        accessibilityLabel={`${Number(month.slice(5))}月每日支出折线图，最高 ${money(chart.peak)} 元`}
        accessibilityHint="轻触查看某天金额，或使用增加和减少操作切换日期"
        accessibilityValue={{
          min: 1,
          max: values.length,
          now: selectedDay ?? 1,
          text: `${selectedDay ?? 1}日支出 ${money(values[(selectedDay ?? 1) - 1] ?? 0)} 元`,
        }}
        aria-valuemin={1}
        aria-valuemax={values.length}
        aria-valuenow={selectedDay ?? 1}
        aria-valuetext={`${selectedDay ?? 1}日支出 ${money(values[(selectedDay ?? 1) - 1] ?? 0)} 元`}
        accessibilityActions={[
          { name: 'increment', label: '后一天' },
          { name: 'decrement', label: '前一天' },
        ]}
        onAccessibilityAction={(event) =>
          setSelectedDay((day) =>
            Math.max(
              1,
              Math.min(
                values.length,
                (day ?? 1) +
                  (event.nativeEvent.actionName === 'increment' ? 1 : -1),
              ),
            ),
          )
        }
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onPress={(event) => {
          const native = event.nativeEvent as typeof event.nativeEvent & {
            clientX?: number;
            offsetX?: number;
          };
          const target = event.currentTarget as unknown as {
            getBoundingClientRect?: () => { left: number };
          };
          const localX =
            Platform.OS === 'web' &&
            typeof native.clientX === 'number' &&
            target.getBoundingClientRect
              ? native.clientX - target.getBoundingClientRect().left
              : (native.locationX ?? native.offsetX);
          if (typeof localX !== 'number' || !Number.isFinite(localX)) return;
          const fraction = (localX - chart.left) / (chart.right - chart.left);
          setSelectedDay(
            Math.max(
              1,
              Math.min(
                values.length,
                Math.round(fraction * (values.length - 1)) + 1,
              ),
            ),
          );
        }}
        style={{ height }}
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
      </Pressable>
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
              ? '轻触折线，查看某天的支出'
              : '本月暂无支出记录'}
        </Txt>
      </View>
    </>
  );
}
