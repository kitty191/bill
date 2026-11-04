import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { usePagerScrollLock } from './pagerContext';
import { feedback } from '../motion';
import { useTheme } from '../theme';

/** Claims only horizontal exploration. Vertical scrolling and cancelled touches
 * release the pager lock, including when the chart unmounts mid-gesture. */
export function ChartScrubber({
  children,
  count,
  selected,
  left,
  right,
  height,
  testID,
  label,
  valueText,
  onWidth,
  onSelect,
}: {
  children: React.ReactNode;
  count: number;
  selected: number;
  left: number;
  right: number;
  height: number;
  testID: string;
  label: string;
  valueText: string;
  onWidth: (width: number) => void;
  onSelect: (index: number, aboveFinger: boolean) => void;
}) {
  const { lock, unlock } = usePagerScrollLock();
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  useEffect(() => unlock, [unlock]);
  const pan = useMemo(() => {
    const select = (x: number, y: number) =>
      onSelect(
        Math.max(
          1,
          Math.min(
            count,
            Math.round(((x - left) / Math.max(1, right - left)) * (count - 1)) +
              1,
          ),
        ),
        y >= height / 2,
      );
    return Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-5, 5])
      .failOffsetY([-12, 12])
      .onBegin(lock)
      .onStart((event) => {
        feedback('selection');
        select(event.x, event.y);
      })
      .onUpdate((event) => select(event.x, event.y))
      .onFinalize(unlock);
  }, [count, left, right, height, onSelect, lock, unlock]);
  const selectKey = (key: string) => {
    const index =
      key === 'Home'
        ? 1
        : key === 'End'
          ? count
          : selected + (key === 'ArrowRight' || key === 'ArrowUp' ? 1 : -1);
    onSelect(Math.max(1, Math.min(count, index)), true);
    feedback('selection');
  };
  return (
    <GestureDetector gesture={pan} touchAction="pan-y">
      <Pressable
        testID={testID}
        accessibilityRole="adjustable"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        focusable
        accessibilityLabel={label}
        accessibilityHint="轻触或横向拖动查看金额，也可使用增加和减少操作"
        accessibilityValue={{
          min: 1,
          max: count,
          now: selected,
          text: valueText,
        }}
        aria-valuemin={1}
        aria-valuemax={count}
        aria-valuenow={selected}
        aria-valuetext={valueText}
        accessibilityActions={[
          { name: 'increment', label: '下一个日期' },
          { name: 'decrement', label: '上一个日期' },
        ]}
        onAccessibilityAction={(event) =>
          selectKey(
            event.nativeEvent.actionName === 'increment'
              ? 'ArrowRight'
              : 'ArrowLeft',
          )
        }
        onKeyDown={
          Platform.OS === 'web'
            ? (event) => {
                const key = event.nativeEvent.key;
                if (
                  [
                    'Home',
                    'End',
                    'ArrowRight',
                    'ArrowLeft',
                    'ArrowUp',
                    'ArrowDown',
                  ].includes(key)
                ) {
                  event.preventDefault();
                  selectKey(key);
                }
              }
            : undefined
        }
        onLayout={(event) => onWidth(event.nativeEvent.layout.width)}
        onPress={(event) => {
          const native = event.nativeEvent as typeof event.nativeEvent & {
            clientX?: number;
            clientY?: number;
          };
          const target = event.currentTarget as unknown as {
            getBoundingClientRect?: () => { left: number; top: number };
          };
          const rect =
            Platform.OS === 'web'
              ? target.getBoundingClientRect?.()
              : undefined;
          const x =
            rect && typeof native.clientX === 'number'
              ? native.clientX - rect.left
              : native.locationX;
          const y =
            rect && typeof native.clientY === 'number'
              ? native.clientY - rect.top
              : native.locationY;
          if (!Number.isFinite(x)) return;
          onSelect(
            Math.max(
              1,
              Math.min(
                count,
                Math.round(
                  ((x - left) / Math.max(1, right - left)) * (count - 1),
                ) + 1,
              ),
            ),
            y >= height / 2,
          );
          feedback('selection');
        }}
        style={{
          height,
          borderRadius: 12,
          outlineColor: t.accent,
          outlineWidth: focused ? 1 : 0,
        }}
      >
        {children}
      </Pressable>
    </GestureDetector>
  );
}
