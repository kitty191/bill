import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Keyboard, View } from 'react-native';
import PagerView, {
  type PagerViewOnPageScrollEvent,
} from 'react-native-pager-view';
import Animated, {
  useEvent,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { settledPagerIndex } from '../domain/pager';
import { PagerScrollLock } from './pagerContext';
export { usePagerScrollLock } from './pagerContext';

const AnimatedPager = Animated.createAnimatedComponent(PagerView);

/** Native ViewPager2 / UIPageViewController owns dragging, velocity and snapping.
 * Only scroll progress runs per frame, on the UI thread. React commits at idle. */
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
  const ref = useRef<PagerView>(null);
  const reduce = useReducedMotion();
  const initialPage = useRef(index);
  const requested = useRef(navigationKey);
  const knownIndex = useRef(index);
  const selected = useRef(index);
  const motion = useRef<'idle' | 'dragging' | 'settling'>('idle');
  const count = pages.length;
  const scrollLock = useMemo(
    () => ({
      lock: () => ref.current?.setScrollEnabled(false),
      unlock: () => ref.current?.setScrollEnabled(true),
    }),
    [],
  );
  useEffect(() => {
    if (navigationKey === requested.current) return;
    requested.current = navigationKey;
    knownIndex.current = index;
    if (reduce) {
      selected.current = index;
      ref.current?.setPageWithoutAnimation(index);
      progress.value = index;
    } else ref.current?.setPage(index);
  }, [index, navigationKey, progress, reduce]);
  const commit = useCallback(() => {
    if (motion.current !== 'idle') return;
    const actual = settledPagerIndex(progress.value);
    if (
      actual === null ||
      actual !== selected.current ||
      actual === knownIndex.current
    )
      return;
    knownIndex.current = actual;
    onIndexChange(actual);
  }, [onIndexChange, progress]);
  const onScroll = useEvent<PagerViewOnPageScrollEvent>(
    (event) => {
      'worklet';
      if (event.eventName.endsWith('onPageScroll'))
        progress.value = Math.max(
          0,
          Math.min(count - 1, event.position + event.offset),
        );
    },
    ['onPageScroll'],
  );
  return (
    <PagerScrollLock.Provider value={scrollLock}>
      <AnimatedPager
        ref={ref}
        testID="page-pager"
        style={{ flex: 1 }}
        initialPage={initialPage.current}
        layoutDirection="ltr"
        orientation="horizontal"
        offscreenPageLimit={1}
        overScrollMode="never"
        overdrag={false}
        keyboardDismissMode="none"
        onPageScroll={onScroll}
        onPageSelected={(event) => {
          selected.current = event.nativeEvent.position;
          if (motion.current === 'idle') commit();
        }}
        onPageScrollStateChanged={(event) => {
          motion.current = event.nativeEvent.pageScrollState;
          if (event.nativeEvent.pageScrollState === 'dragging')
            Keyboard.dismiss();
          else if (event.nativeEvent.pageScrollState === 'idle') commit();
        }}
      >
        {pages.map((page, pageIndex) => (
          <View
            key={page.key}
            collapsable={false}
            testID={`page-${page.key}`}
            style={{ flex: 1 }}
            accessibilityElementsHidden={pageIndex !== index}
            importantForAccessibility={
              pageIndex === index ? 'auto' : 'no-hide-descendants'
            }
            aria-hidden={pageIndex !== index}
          >
            {page.content}
          </View>
        ))}
      </AnimatedPager>
    </PagerScrollLock.Provider>
  );
}
