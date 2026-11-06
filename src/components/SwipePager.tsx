import React, {
  useCallback,
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
import { pagerOffset, pagerProgress, settledPagerIndex } from '../domain/pager';
import { PagerScrollLock } from './pagerContext';
export { usePagerScrollLock } from './pagerContext';

const IS_WEB = Platform.OS === 'web';
const PAGER_STYLE = {
  flex: 1,
  direction: 'ltr',
  ...(IS_WEB
    ? { overscrollBehaviorX: 'contain', scrollSnapType: 'x mandatory' }
    : {}),
} as const;

/** Page positions match the left-to-right dock order on native and web. */
export function SwipePager({
  index,
  navigationKey,
  onIndexChange,
  progress,
  pages,
}: {
  index: number;
  navigationKey: number;
  onIndexChange: (index: number) => void;
  progress: SharedValue<number>;
  pages: { key: string; content: React.ReactNode }[];
}) {
  const reduce = useReducedMotion();
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const knownIndex = useRef(index);
  const previousWidth = useRef(0);
  const previousNavigation = useRef(navigationKey);
  const initialOffset = useRef<{ x: number; y: number } | undefined>(undefined);
  const initialized = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const webRange = useRef<{ minimum: number; maximum: number } | null>(null);
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
    let origin = 0;
    let stop: ReturnType<typeof setTimeout> | undefined;
    const stopped = () => {
      if (stop) clearTimeout(stop);
      stop = setTimeout(() => {
        webRange.current = null;
      }, 150);
    };
    const start = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) {
        startX = touch.clientX;
        startY = touch.clientY;
        origin = Math.round(pagerProgress(node.scrollLeft, count, width));
        webRange.current = null;
        if (stop) clearTimeout(stop);
      }
    };
    const move = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length !== 1) return;
      const dx = touch.clientX - startX,
        dy = touch.clientY - startY;
      if (Math.abs(dx) < 12 || Math.abs(dx) <= Math.abs(dy)) return;
      if (lockedRef.current) return;
      webRange.current = {
        minimum: Math.max(0, origin - 1) * width,
        maximum: Math.min(count - 1, origin + 1) * width,
      };
      const position = pagerProgress(node.scrollLeft, count, width);
      const outside =
        (position <= 0.01 && dx > 0) ||
        (position >= count - 1 - 0.01 && dx < 0);
      if (outside && event.cancelable) event.preventDefault();
    };
    const constrain = () => {
      const range = webRange.current;
      if (!range) return;
      const offset = Math.min(
        range.maximum,
        Math.max(range.minimum, node.scrollLeft),
      );
      if (Math.abs(offset - node.scrollLeft) > 0.5) node.scrollLeft = offset;
      // Keep the constraint through browser momentum, not just touchEnd. A new
      // gesture or explicit dock navigation can immediately select a new range.
      stopped();
    };
    node.addEventListener('touchstart', start, {
      passive: true,
      capture: true,
    });
    node.addEventListener('touchmove', move, { passive: false, capture: true });
    node.addEventListener('touchend', stopped, {
      passive: true,
      capture: true,
    });
    node.addEventListener('touchcancel', stopped, {
      passive: true,
      capture: true,
    });
    node.addEventListener('scroll', constrain, {
      passive: true,
      capture: true,
    });
    return () => {
      node.removeEventListener('touchstart', start, true);
      node.removeEventListener('touchmove', move, true);
      node.removeEventListener('touchend', stopped, true);
      node.removeEventListener('touchcancel', stopped, true);
      node.removeEventListener('scroll', constrain, true);
      if (stop) clearTimeout(stop);
      webRange.current = null;
    };
  }, [width, count]);

  const settled = useCallback(
    (value: number) => {
      if (timer.current) clearTimeout(timer.current);
      // A delayed native event can belong to the previous fling. Only commit
      // the page actually at rest, using the same position as the entire dock.
      if (Math.abs(value - progress.value) >= 0.01) return;
      const next = settledPagerIndex(progress.value);
      if (next === null) return;
      if (next !== knownIndex.current) {
        knownIndex.current = next;
        onIndexChange(next);
      }
    },
    [onIndexChange, progress],
  );

  const checkStopped = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => settled(progress.value), 100);
  }, [settled, progress]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useLayoutEffect(() => {
    if (!width) return;
    const resized = width !== previousWidth.current;
    const requested = navigationKey !== previousNavigation.current;
    previousNavigation.current = navigationKey;
    previousWidth.current = width;
    if (!resized && !requested && knownIndex.current === index) return;
    if (resized || requested) webRange.current = null;
    if (timer.current) clearTimeout(timer.current);
    knownIndex.current = index;
    if (resized || reduce) progress.value = index;
    ref.current?.scrollTo({
      x: pagerOffset(index, count, width),
      animated: !resized && !reduce,
    });
  }, [index, navigationKey, width, count, reduce, progress]);

  const handler = useAnimatedScrollHandler({
    onScroll(event) {
      if (!width) return;
      const value = pagerProgress(event.contentOffset.x, count, width);
      progress.value = value;
      if (Math.abs(value - Math.round(value)) < 0.01)
        scheduleOnRN(settled, value);
      // Browsers omit momentum events; Android can delay them while snapping.
      // Both also settle after the live position reaches a page boundary.
      if (IS_WEB || Math.abs(value - Math.round(value)) < 0.01)
        scheduleOnRN(checkStopped);
    },
    onEndDrag() {
      scheduleOnRN(checkStopped);
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
    <PagerScrollLock.Provider value={scrollLock}>
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
            // Web uses the page's single snap target below. RN Web's paging
            // wrapper adds a second target without scrollSnapStop and can let
            // a fast fling skip over the intervening page.
            pagingEnabled={!IS_WEB}
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
            {pages.map((page, pageIndex) => {
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
                    ...(IS_WEB
                      ? { scrollSnapAlign: 'start', scrollSnapStop: 'always' }
                      : {}),
                  }}
                >
                  {page.content}
                </View>
              );
            })}
          </Animated.ScrollView>
        )}
      </View>
    </PagerScrollLock.Provider>
  );
}
