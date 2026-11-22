import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { Glass, Icon, Txt } from './ui';
import { scheduleOnRN } from 'react-native-worklets';
import { motion } from '../motion';

export type Tab = 'home' | 'entries' | 'stats';
const tabs = [
  ['home', 'home', '首页'],
  ['entries', 'list', '账单'],
  ['stats', 'chart', '统计'],
] as const;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function BottomNavigation({
  tab,
  onTab,
  onAdd,
  bottom,
  onHeight,
  progress,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  onAdd: () => void;
  bottom: number;
  onHeight: (height: number) => void;
  progress: SharedValue<number>;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [visibleIndex, setVisibleIndex] = useState(
    tabs.findIndex(([key]) => key === tab),
  );
  useAnimatedReaction(
    () => Math.max(0, Math.min(tabs.length - 1, Math.round(progress.value))),
    (next, previous) => {
      if (next !== previous) scheduleOnRN(setVisibleIndex, next);
    },
    [progress],
  );
  const scale = useSharedValue(1);
  const step = Math.max(0, width - 10) / 3;
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * step }],
  }));
  const addStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <View
      pointerEvents="box-none"
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      style={{
        paddingTop: 6,
        paddingBottom: bottom,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Glass style={{ flex: 1, borderRadius: 29 }}>
        <View
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={{ flexDirection: 'row', padding: 5 }}
        >
          {width > 0 && (
            <Animated.View
              testID="dock-indicator"
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  left: 5,
                  top: 5,
                  bottom: 5,
                  width: step,
                  borderRadius: 24,
                  backgroundColor: t.accentSoft,
                  borderWidth: 1,
                  borderColor: t.dark
                    ? 'rgba(214,242,218,0.12)'
                    : 'rgba(255,255,255,0.9)',
                  boxShadow: t.pillShadow,
                },
                indicatorStyle,
              ]}
            />
          )}
          {tabs.map(([key, icon, label], index) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: visibleIndex === index }}
              aria-selected={visibleIndex === index}
              onPress={() => onTab(key)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 46,
                paddingVertical: 4,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Icon
                name={icon}
                size={19}
                color={visibleIndex === index ? t.accent : t.muted}
                strokeWidth={visibleIndex === index ? 2.1 : 1.6}
              />
              <Txt
                size={10}
                color={visibleIndex === index ? t.accent : t.muted}
                weight={visibleIndex === index ? '600' : '500'}
                style={{ lineHeight: 14 }}
              >
                {label}
              </Txt>
            </Pressable>
          ))}
        </View>
      </Glass>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="记一笔"
        onPress={onAdd}
        onPressIn={() => {
          scale.value = reduce ? 1 : withSpring(0.94, motion.spring);
        }}
        onPressOut={() => {
          scale.value = reduce ? 1 : withSpring(1, motion.spring);
        }}
        style={[
          {
            flexDirection: 'row',
            gap: 6,
            paddingHorizontal: 18,
            minHeight: 58,
            borderRadius: 29,
            backgroundColor: t.primary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: t.primaryBorder,
            boxShadow: t.dark
              ? '0 6px 20px rgba(0,8,3,0.34)'
              : '0 6px 20px rgba(34,76,55,0.22)',
            overflow: 'hidden',
          },
          addStyle,
        ]}
      >
        <Icon
          name="plus"
          size={19}
          color={t.onPrimary}
          strokeWidth={2.2}
        />
        <Txt size={15} weight="600" color={t.onPrimary}>记一笔</Txt>
      </AnimatedPressable>
    </View>
  );
}
