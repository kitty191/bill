import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, View, type ScrollView } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const ScrollLock = createContext({ lock: () => {}, unlock: () => {} });
const IS_WEB = Platform.OS === 'web';
const WEB_PAGER_STYLE = {
  flex: 1,
  direction: 'rtl',
  overscrollBehaviorX: 'contain',
} as const;
export const usePagerScrollLock = () => useContext(ScrollLock);

/** Native inverted paging and browser RTL scrolling both make a rightward
 * swipe go forward. Page content keeps its ordinary reading/scroll direction. */
export function SwipePager({
  index,
  onIndexChange,
  progress,
  pages,
}: {
  index: number;
  onIndexChange: (index: number) => void;
  progress: SharedValue<number>;
  pages: { key: string; content: React.ReactNode }[];
}) {
  const reduce = useReducedMotion();
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const knownIndex = useRef(index);
  const previousWidth = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const scrollLock = useMemo(
    () => ({
      lock: () => {
        lockedRef.current = true;
        setLocked(true);
      },
      unlock: () => {
        lockedRef.current = false;
        setLocked(false);
      },
    }),
    [],
  );
  const count = pages.length;
  const width = viewport.width;

  useEffect(() => {
    if (!IS_WEB) return;
    // Browsers can chain a boundary swipe from an inner vertical scroller to
    // history navigation, bypassing the horizontal surface's containment.
    const roots = [document.documentElement, document.body];
    const previous = roots.map((element) => element.style.overscrollBehaviorX);
    roots.forEach((element) => {
      element.style.overscrollBehaviorX = 'none';
    });
    return () =>
      roots.forEach((element, i) => {
        element.style.overscrollBehaviorX = previous[i]!;
      });
  }, []);

  useEffect(() => {
    if (!IS_WEB || !width) return;
    const host = ref.current as unknown as {
      getScrollableNode?: () => HTMLElement;
    } | null;
    const node = host?.getScrollableNode?.();
    if (!node) return;
    let startX = 0,
      startY = 0;
    const start = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) {
        startX = touch.clientX;
        startY = touch.clientY;
      }
    };
    const move = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length !== 1) return;
      const dx = touch.clientX - startX,
        dy = touch.clientY - startY;
      if (Math.abs(dx) < 12 || Math.abs(dx) <= Math.abs(dy)) return;
      if (lockedRef.current) return;
      const position = -node.scrollLeft / width;
      const outside =
        (position <= 0.01 && dx < 0) ||
        (position >= count - 1 - 0.01 && dx > 0);
      if (outside && event.cancelable) event.preventDefault();
    };
    node.addEventListener('touchstart', start, {
      passive: true,
      capture: true,
    });
    node.addEventListener('touchmove', move, { passive: false, capture: true });
    return () => {
      node.removeEventListener('touchstart', start, true);
      node.removeEventListener('touchmove', move, true);
    };
  }, [width, count]);

  const settled = useCallback(
    (value: number) => {
      if (timer.current) clearTimeout(timer.current);
      const next = Math.max(0, Math.min(count - 1, Math.round(value)));
      if (next !== knownIndex.current) {
        knownIndex.current = next;
        onIndexChange(next);
      }
    },
    [count, onIndexChange],
  );

  const webScroll = useCallback(
    (value: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => settled(value), 140);
    },
    [settled],
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (!width) return;
    const resized = width !== previousWidth.current;
    previousWidth.current = width;
    if (!resized && knownIndex.current === index) return;
    if (timer.current) clearTimeout(timer.current);
    knownIndex.current = index;
    if (resized || reduce) progress.value = index;
    const frame = requestAnimationFrame(() =>
      ref.current?.scrollTo({
        x: (IS_WEB ? -1 : 1) * index * width,
        animated: !resized && !reduce,
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [index, width, reduce, progress]);

  const handler = useAnimatedScrollHandler({
    onScroll(event) {
      if (!width) return;
      const value = Math.max(
        0,
        Math.min(
          count - 1,
          ((IS_WEB ? -1 : 1) * event.contentOffset.x) / width,
        ),
      );
      progress.value = value;
      if (IS_WEB) scheduleOnRN(webScroll, value);
    },
    onMomentumEnd(event) {
      if (width)
        scheduleOnRN(
          settled,
          ((IS_WEB ? -1 : 1) * event.contentOffset.x) / width,
        );
    },
  });

  return (
    <ScrollLock.Provider value={scrollLock}>
      <View
        style={{ flex: 1 }}
        onLayout={(event) => {
          const { width: nextWidth, height } = event.nativeEvent.layout;
          setViewport((current) =>
            current.width === nextWidth && current.height === height
              ? current
              : { width: nextWidth, height },
          );
        }}
      >
        <Animated.ScrollView
          ref={ref}
          testID="page-pager"
          horizontal
          pagingEnabled
          directionalLockEnabled
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
          decelerationRate="fast"
          disableIntervalMomentum
          scrollEnabled={!locked}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handler}
          style={
            IS_WEB ? WEB_PAGER_STYLE : { flex: 1, transform: [{ scaleX: -1 }] }
          }
          contentContainerStyle={{
            width: width * count,
            height: viewport.height,
            ...(IS_WEB ? { direction: 'rtl' as const } : {}),
          }}
        >
          {pages.map((page, pageIndex) => (
            <View
              key={page.key}
              testID={`page-${page.key}`}
              accessibilityElementsHidden={pageIndex !== index}
              importantForAccessibility={
                pageIndex === index ? 'auto' : 'no-hide-descendants'
              }
              aria-hidden={pageIndex !== index}
              style={{
                width,
                height: viewport.height,
                ...(IS_WEB
                  ? { direction: 'ltr' as const }
                  : { transform: [{ scaleX: -1 }] }),
              }}
            >
              {page.content}
            </View>
          ))}
        </Animated.ScrollView>
      </View>
    </ScrollLock.Provider>
  );
}
