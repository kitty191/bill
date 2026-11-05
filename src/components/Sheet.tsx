import React, {
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import {
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  FadeIn,
  cancelAnimation,
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
import { Glass, IconButton, Txt, styles } from './ui';
import { motion } from '../motion';
import { SheetScrollContext } from './sheetScroll';

const sheetEntering = FadeInDown.duration(motion.sheet);
export type SheetHandle = { close: () => void; reopen: () => void };

export function Sheet({
  visible,
  onClose,
  title,
  children,
  dismissible = true,
  footer,
  controlRef,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  dismissible?: boolean;
  footer?: React.ReactNode;
  controlRef?: React.Ref<SheetHandle>;
}) {
  const t = useTheme();
  const privacy = usePrivacy();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const content = useRef<React.ComponentRef<typeof View>>(null);
  const focusedInput = useRef<number | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      if (focusedInput.current !== null)
        scroll.current?.scrollResponderScrollNativeHandleToKeyboard(
          focusedInput.current,
          16,
          true,
        );
    });
    return () => subscription.remove();
  }, []);
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
  const dismissKeyboard = useCallback(() => Keyboard.dismiss(), []);
  const translation = useSharedValue(0);
  const panelHeight = useSharedValue(700);
  const dragStart = useSharedValue(0);
  const closing = useSharedValue(false);
  const close = useCallback(() => {
    if (closing.value) return;
    closing.value = true;
    Keyboard.dismiss();
    if (reduce) {
      onClose();
      return;
    }
    translation.value = withTiming(
      panelHeight.value + 30,
      { duration: motion.dismiss },
      (finished) => {
        if (finished) scheduleOnRN(onClose);
      },
    );
  }, [closing, reduce, onClose, panelHeight, translation]);
  useImperativeHandle(
    controlRef,
    () => ({
      close,
      reopen: () => {
        closing.value = false;
        translation.value = reduce ? 0 : withSpring(0, motion.spring);
      },
    }),
    [close, closing, translation, reduce],
  );
  const dismiss = () => {
    if (dismissible) close();
  };
  const gestureStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translation.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.max(
      0,
      1 - translation.value / Math.max(1, panelHeight.value),
    ),
  }));
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(Platform.OS === 'web')
        .enabled(dismissible)
        .activeOffsetY([-5, 5])
        .failOffsetX([-16, 16])
        .onBegin(() => {
          cancelAnimation(translation);
          dragStart.value = translation.value;
          closing.value = false;
        })
        .onStart(() => {
          scheduleOnRN(dismissKeyboard);
        })
        .onUpdate((event) => {
          translation.value = Math.max(0, dragStart.value + event.translationY);
        })
        .onEnd((event) => {
          if (
            translation.value > Math.min(96, panelHeight.value * 0.2) ||
            (event.velocityY > 850 && event.translationY > 12)
          ) {
            closing.value = true;
            translation.value = withTiming(
              panelHeight.value + 30,
              { duration: reduce ? 0 : motion.dismiss },
              (finished) => {
                if (finished) scheduleOnRN(onClose);
              },
            );
          } else translation.value = reduce ? 0 : withSpring(0, motion.spring);
        })
        .onFinalize((_event, success) => {
          if (!success)
            translation.value = reduce ? 0 : withSpring(0, motion.spring);
        }),
    [
      dismissible,
      reduce,
      onClose,
      translation,
      dismissKeyboard,
      panelHeight,
      closing,
      dragStart,
    ],
  );
  return (
    <Modal
      visible={visible && privacy.phase === 'unlocked'}
      transparent
      animationType="none"
      onRequestClose={() => {
        if (Keyboard.isVisible?.()) Keyboard.dismiss();
        else dismiss();
      }}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <Animated.View
            entering={reduce ? undefined : FadeIn.duration(motion.fade)}
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: t.overlay },
              backdropStyle,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="关闭面板"
              onPress={dismiss}
              style={{ position: 'absolute', inset: 0 }}
            />
          </Animated.View>
          <Animated.View
            entering={reduce ? undefined : sheetEntering}
            accessibilityViewIsModal
            onLayout={(event) => {
              panelHeight.value = event.nativeEvent.layout.height;
            }}
            style={[
              {
                width: '100%',
                maxWidth: 560,
                maxHeight: '92%',
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                paddingBottom: Math.max(insets.bottom, 20),
                boxShadow: `0 -8px 40px ${t.shadow}`,
              },
              gestureStyle,
            ]}
          >
            <Glass
              variant="sheet"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: 0,
                  borderTopLeftRadius: 32,
                  borderTopRightRadius: 32,
                },
              ]}
            />
            <GestureDetector gesture={pan} touchAction="none">
              <View
                testID="sheet-drag-handle"
                style={{
                  paddingTop: 11,
                  paddingBottom: 8,
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: t.muted,
                    opacity: 0.32,
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
              <Txt
                size={21}
                weight="600"
                style={{ flex: 1, minWidth: 0, paddingRight: 12 }}
              >
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
              onFocus={(event) => {
                if (Platform.OS !== 'web')
                  focusedInput.current = event.nativeEvent.target;
              }}
              onBlur={() => {
                focusedInput.current = null;
              }}
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
            {footer && (
              <View
                testID="sheet-footer"
                style={{
                  paddingHorizontal: 25,
                  paddingTop: 12,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderColor: t.border,
                }}
              >
                {footer}
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
