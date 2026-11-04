import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appState: {
    currentState: 'active' as string | null,
    addEventListener: vi.fn(),
  },
  remove: vi.fn(),
}));
vi.mock('react-native', () => ({ AppState: mocks.appState }));
import { useLocalDate } from '../src/state/useLocalDate';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let renderer: ReactTestRenderer | undefined;
let listener: (state: string) => void;
let date: string;
let renders: number;
function Probe() {
  date = useLocalDate();
  renders++;
  return null;
}
async function mount(now: Date) {
  vi.setSystemTime(now);
  await act(async () => {
    renderer = create(<Probe />);
  });
}
async function appState(next: string) {
  mocks.appState.currentState = next;
  await act(async () => listener(next));
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  renders = 0;
  mocks.appState.currentState = 'active';
  mocks.appState.addEventListener.mockImplementation((_event, callback) => {
    listener = callback;
    return { remove: mocks.remove };
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  vi.useRealTimers();
});

it.each([
  [2026, 10, 4, '2026-11-05'],
  [2026, 11, 31, '2027-01-01'],
  [2028, 1, 28, '2028-02-29'],
])(
  'updates at local midnight without interaction (%i/%i/%i)',
  async (year, month, day, next) => {
    await mount(new Date(year, month, day, 23, 59, 59, 900));
    const before = date;
    await act(async () => vi.advanceTimersByTime(99));
    expect(date).toBe(before);
    await act(async () => vi.advanceTimersByTime(1));
    expect(date).toBe(next);
  },
);

it('does not reset at noon or rerender the app on same-day clock checks', async () => {
  await mount(new Date(2026, 10, 4, 11, 59, 50));
  await act(async () => vi.advanceTimersByTime(180_000));
  expect(date).toBe('2026-11-04');
  expect(renders).toBe(1);
});

it.each([
  [2026, 2, 8, '2026-03-09'],
  [2026, 10, 1, '2026-11-02'],
])(
  'follows calendar midnight on DST transition dates (%i/%i/%i)',
  async (year, month, day, next) => {
    const start = new Date(year, month, day);
    const end = new Date(year, month, day + 1);
    await mount(start);
    const before = date;
    await act(async () =>
      vi.advanceTimersByTime(end.getTime() - start.getTime() - 1),
    );
    expect(date).toBe(before);
    await act(async () => vi.advanceTimersByTime(1));
    expect(date).toBe(next);
  },
);

it('refreshes immediately on resume after suspended timers, without background polling', async () => {
  await mount(new Date(2026, 10, 30, 23, 59));
  await appState('background');
  expect(vi.getTimerCount()).toBe(0);
  vi.setSystemTime(new Date(2026, 11, 2, 9));
  await appState('active');
  expect(date).toBe('2026-12-02');
  expect(vi.getTimerCount()).toBe(1);
});

it('follows forward and backward device clock changes while foregrounded', async () => {
  await mount(new Date(2026, 10, 4, 10));
  vi.setSystemTime(new Date(2026, 10, 6, 10));
  await act(async () => vi.advanceTimersByTime(60_000));
  expect(date).toBe('2026-11-06');
  vi.setSystemTime(new Date(2026, 10, 3, 10));
  await act(async () => vi.advanceTimersByTime(60_000));
  expect(date).toBe('2026-11-03');
});

it('cancels its timer and app-state subscription when unmounted', async () => {
  await mount(new Date(2026, 10, 4));
  await act(async () => renderer!.unmount());
  renderer = undefined;
  expect(vi.getTimerCount()).toBe(0);
  expect(mocks.remove).toHaveBeenCalledOnce();
});
