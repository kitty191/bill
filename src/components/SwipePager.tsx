import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
import { pagerOffset, pagerProgress } from '../domain/pager';

const ScrollLock = createContext({ lock: () => {}, unlock: () => {} });
const IS_WEB = Platform.OS === 'web';
const PAGER_STYLE = {
  flex: 1,
  direction: 'ltr',
  ...(IS_WEB ? { overscrollBehaviorX: 'contain' } : {}),
} as const;
export const usePagerScrollLock = () => useContext(ScrollLock);

/** Reverse the actual page order, never the view or its touch coordinates.
 * Native and web use the same positive offsets and logical tab mapping. */
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
  const initialOffset = useRef<{ x: number; y: number } | undefined>(undefined);
  const initialized = useRef(false);
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
      const position = pagerProgress(node.scrollLeft, count, width);
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

  useLayoutEffect(() => {
    if (!width) return;
    const resized = width !== previousWidth.current;
    previousWidth.current = width;
    if (!resized && knownIndex.current === index) return;
    if (timer.current) clearTimeout(timer.current);
    knownIndex.current = index;
    if (resized || reduce) progress.value = index;
    ref.current?.scrollTo({
      x: pagerOffset(index, count, width),
      animated: !resized && !reduce,
    });
  }, [index, width, count, reduce, progress]);

  const handler = useAnimatedScrollHandler({
    onScroll(event) {
      if (!width) return;
      const value = pagerProgress(event.contentOffset.x, count, width);
      progress.value = value;
      if (IS_WEB) scheduleOnRN(webScroll, value);
    },
    onMomentumEnd(event) {
      if (width)
        scheduleOnRN(
          settled,
          pagerProgress(event.contentOffset.x, count, width),
        );
    },
  });

  return (
    <ScrollLock.Provider value={scrollLock}>
      <View
        style={{ flex: 1 }}
        onLayout={(event) => {
          const { width: nextWidth, height } = event.nativeEvent.layout;
          if (!initialOffset.current && nextWidth > 0)
            initialOffset.current = {
              x: pagerOffset(knownIndex.current, count, nextWidth),
              y: 0,
            };
          setViewport((current) =>
            current.width === nextWidth && current.height === height
              ? current
              : { width: nextWidth, height },
          );
        }}
      >
        {width > 0 && (
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
            contentOffset={initialOffset.current}
            onContentSizeChange={(contentWidth) => {
              // Android must know the content extent before the initial offset
              // can be applied. Also initializes browsers, which ignore contentOffset.
              if (initialized.current || contentWidth < width * count - 1)
                return;
              initialized.current = true;
              progress.value = knownIndex.current;
              ref.current?.scrollTo({
                x: pagerOffset(knownIndex.current, count, width),
                animated: false,
              });
            }}
            style={PAGER_STYLE}
            contentContainerStyle={{
              width: width * count,
              height: viewport.height,
              direction: 'ltr',
            }}
          >
            {[...pages].reverse().map((page, physicalIndex) => {
              const pageIndex = count - 1 - physicalIndex;
              return (
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
                  }}
                >
                  {page.content}
                </View>
              );
            })}
          </Animated.ScrollView>
        )}
      </View>
    </ScrollLock.Provider>
  );
}
