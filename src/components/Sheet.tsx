import React, { useCallback, useMemo, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { usePrivacy } from '../state/PrivacyContext';
import { IconButton, Txt, styles } from './ui';
import { SheetScrollContext } from './sheetScroll';

const sheetEntering = FadeInDown.duration(250);

export function Sheet({
  visible,
  onClose,
  title,
  children,
  dismissible = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  dismissible?: boolean;
}) {
  const t = useTheme();
  const privacy = usePrivacy();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const content = useRef<React.ComponentRef<typeof View>>(null);
  const reveal = useCallback(
    (target: React.RefObject<React.ComponentRef<typeof View> | null>) => {
      requestAnimationFrame(() => {
        if (!target.current || !content.current) return;
        target.current.measureLayout(
          content.current,
          (_x, y) =>
            scroll.current?.scrollTo({
              y: Math.max(0, y - 8),
              animated: !reduce,
            }),
          () => {},
        );
      });
    },
    [reduce],
  );
  const dismiss = () => {
    if (dismissible) {
      Keyboard.dismiss();
      onClose();
    }
  };
  const dismissKeyboard = useCallback(() => Keyboard.dismiss(), []);
  const translation = useSharedValue(0);
  const gestureStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translation.value }],
  }));
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(dismissible)
        .onStart(() => {
          scheduleOnRN(dismissKeyboard);
        })
        .onUpdate((event) => {
          translation.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          if (event.translationY > 80 || event.velocityY > 800) {
            translation.value = withTiming(
              700,
              { duration: reduce ? 0 : 180 },
              () => scheduleOnRN(onClose),
            );
          } else
            translation.value = withSpring(0, { damping: 28, stiffness: 320 });
        }),
    [dismissible, reduce, onClose, translation, dismissKeyboard],
  );
  return (
    <Modal
      visible={visible && privacy.phase === 'unlocked'}
      transparent
      animationType={reduce || privacy.phase !== 'unlocked' ? 'none' : 'fade'}
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            alignItems: 'center',
            backgroundColor: t.overlay,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭面板"
            onPress={dismiss}
            style={{ position: 'absolute', inset: 0 }}
          />
          <Animated.View
            entering={reduce ? undefined : sheetEntering}
            accessibilityViewIsModal
            style={[
              {
                width: '100%',
                maxWidth: 560,
                maxHeight: '92%',
                backgroundColor: t.surface,
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                paddingBottom: Math.max(insets.bottom, 20),
                boxShadow: '0 -12px 60px rgba(20,40,30,0.12)',
              },
              gestureStyle,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View
                style={{
                  paddingTop: 11,
                  paddingBottom: 8,
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: t.border,
                  }}
                />
              </View>
            </GestureDetector>
            <View
              style={[
                styles.row,
                {
                  paddingHorizontal: 25,
                  justifyContent: 'space-between',
                  marginBottom: 15,
                },
              ]}
            >
              <Txt size={21} weight="600">
                {title}
              </Txt>
              <IconButton
                name="close"
                label="关闭"
                disabled={!dismissible}
                onPress={dismiss}
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: t.surfaceAlt,
                  borderWidth: 0,
                }}
              />
            </View>
            <ScrollView
              ref={scroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{
                paddingHorizontal: 25,
                paddingBottom: 14,
              }}
              showsVerticalScrollIndicator={false}
            >
              <SheetScrollContext.Provider value={reveal}>
                <View ref={content} collapsable={false}>
                  {children}
                </View>
              </SheetScrollContext.Provider>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
