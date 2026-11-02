import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { Glass, Icon, Txt } from './ui';

export type Tab = 'home' | 'entries' | 'stats';
const tabs = [
  ['home', 'home', '首页'],
  ['entries', 'list', '账单'],
  ['stats', 'chart', '统计'],
] as const;
const spring = { damping: 24, stiffness: 260, mass: 0.8 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function BottomNavigation({
  tab,
  onTab,
  onAdd,
  bottom,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  onAdd: () => void;
  bottom: number;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const position = useSharedValue(0);
  const scale = useSharedValue(1);
  const step = Math.max(0, width - 12) / 3;
  useEffect(() => {
    const target = tabs.findIndex((item) => item[0] === tab) * step;
    position.value = reduce
      ? withTiming(target, { duration: 0 })
      : withSpring(target, spring);
  }, [tab, step, reduce, position]);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value }],
  }));
  const addStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom,
        left: 21,
        right: 21,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <Glass style={{ flex: 1, borderRadius: 29 }}>
        <View
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={{ flexDirection: 'row', padding: 6 }}
        >
          {width > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  left: 6,
                  top: 6,
                  bottom: 6,
                  width: step,
                  borderRadius: 23,
                  backgroundColor: t.accentSoft,
                },
                indicatorStyle,
              ]}
            />
          )}
          {tabs.map(([key, icon, label]) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: tab === key }}
              onPress={() => onTab(key)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 49,
                borderRadius: 23,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Icon
                name={icon}
                size={19}
                color={tab === key ? t.accent : t.muted}
                strokeWidth={tab === key ? 2 : 1.6}
              />
              <Txt
                size={9}
                color={tab === key ? t.accent : t.muted}
                weight={tab === key ? '600' : '400'}
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
          scale.value = reduce ? 1 : withSpring(0.92, spring);
        }}
        onPressOut={() => {
          scale.value = reduce ? 1 : withSpring(1, spring);
        }}
        style={[
          {
            width: 62,
            height: 62,
            borderRadius: 31,
            backgroundColor: t.dark ? '#A0CCAD' : '#345B48',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: t.dark ? '#BEDBC6' : '#638771',
            boxShadow: '0 6px 20px rgba(40,75,50,0.20)',
          },
          addStyle,
        ]}
      >
        <Icon
          name="plus"
          size={27}
          color={t.dark ? '#193423' : '#FFFFFF'}
          strokeWidth={1.6}
        />
      </AnimatedPressable>
    </View>
  );
}
