import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  type Entry,
  type Ledger,
  localDate,
  shiftMonth,
} from './src/domain/ledger';
import { importLedger } from './src/storage/backup';
import { LedgerProvider, useLedger } from './src/state/LedgerProvider';
import { ThemeProvider, useTheme } from './src/theme';
import {
  Button,
  Icon,
  IconButton,
  Txt,
  styles,
  BlurTargetContext,
} from './src/components/ui';
import { BottomNavigation, type Tab } from './src/components/BottomNavigation';
import { EntryEditor } from './src/components/EntryEditor';
import { SettingsSheet } from './src/components/SettingsSheet';
import { HomeScreen } from './src/screens/HomeScreen';
import {
  EntriesScreen,
  type EntriesListHandle,
} from './src/screens/EntriesScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { SwipePager } from './src/components/SwipePager';
import { PrivacyProvider } from './src/state/PrivacyProvider';
import { PrivacyGuard } from './src/components/PrivacyGuard';
import { usePrivacy } from './src/state/PrivacyContext';
import { useLocalDate } from './src/state/useLocalDate';
import { SnapshotManager } from './src/components/SnapshotManager';
import { Sheet } from './src/components/Sheet';

const PAGE_KEYS: Tab[] = ['home', 'entries', 'stats'];
const MemoHomeScreen = memo(HomeScreen);
const MemoEntriesScreen = memo(EntriesScreen);
const MemoStatsScreen = memo(StatsScreen);
const BackgroundSurface = Platform.OS === 'android' ? View : BlurTargetView;

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <PrivacyProvider>
            <LedgerProvider>
              <PrivacyGuard>
                <Main />
              </PrivacyGuard>
            </LedgerProvider>
          </PrivacyProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Main() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const {
    ledger,
    loading,
    error,
    backgroundError,
    reload,
    recover,
    saving,
    undo,
    restoreDeleted,
  } = useLedger();
  const [recovery, setRecovery] = useState<Ledger | null>(null);
  const [recoveryError, setRecoveryError] = useState('');
  const [tab, setTab] = useState<Tab>('home');
  const [navigationKey, setNavigationKey] = useState(0);
  const tabRef = useRef<Tab>('home');
  const pageProgress = useSharedValue(0);
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [entriesTarget, setEntriesTarget] = useState<{
    key: number;
    date?: string;
  }>({ key: 0 });
  const entriesScroll = useRef<EntriesListHandle>(null);
  const [editor, setEditor] = useState<{
    entry?: Entry;
    refundOf?: Entry;
    templateId?: string;
    recurringId?: string;
    recurringDate?: string;
  } | null>(null);
  const [settings, setSettings] = useState<
    false | 'main' | 'privacy' | 'recurring'
  >(false);
  const [snapshotRecovery, setSnapshotRecovery] = useState(false);
  const privacy = usePrivacy();
  const [notice, setNotice] = useState<{
    message: string;
    entryId?: string;
    expiresAt: number;
  } | null>(null);
  const setToast = useCallback((message: string, entryId?: string) => {
    setNotice(
      message
        ? { message, entryId, expiresAt: Date.now() + (entryId ? 8000 : 2800) }
        : null,
    );
  }, []);
  const toast = notice?.message ?? '';
  useEffect(() => {
    if (backgroundError && !settings) setToast(backgroundError);
  }, [backgroundError, settings]);
  const blurTarget = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(
      () => setNotice((current) => (current === notice ? null : current)),
      Math.max(0, notice.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [notice]);
  const selectTab = useCallback((next: Tab) => {
    if (tabRef.current === next) return;
    tabRef.current = next;
    Keyboard.dismiss();
    setTab(next);
    void Haptics.selectionAsync().catch(() => {});
  }, []);
  const navigate = useCallback(
    (next: Tab) => {
      setNavigationKey((value) => value + 1);
      selectTab(next);
    },
    [selectTab],
  );
  const onPageChange = useCallback(
    (index: number) => selectTab(PAGE_KEYS[index]!),
    [selectTab],
  );
  const today = useLocalDate();
  const onMonth = useCallback(
    (offset: number) => setMonth((current) => shiftMonth(current, offset)),
    [],
  );
  const onEntry = useCallback((entry: Entry) => setEditor({ entry }), []);
  const openEditor = useCallback(() => setEditor({}), []);
  const openSettings = useCallback(() => setSettings('main'), []);
  const closeSettings = useCallback(() => setSettings(false), []);
  const openBackup = useCallback(() => setSettings('privacy'), []);
  const openTemplate = useCallback(
    (templateId: string) => setEditor({ templateId }),
    [],
  );
  const openRefund = useCallback(
    (refundOf: Entry) => setEditor({ refundOf }),
    [],
  );
  const openRecurring = useCallback(
    (recurringId: string, recurringDate: string) => {
      setSettings(false);
      setEditor({ recurringId, recurringDate });
    },
    [],
  );
  const openRecurringSettings = useCallback(() => setSettings('recurring'), []);
  const showAll = useCallback(() => {
    setEntriesTarget((value) => ({ key: value.key + 1 }));
    entriesScroll.current?.scrollToTop();
    navigate('entries');
  }, [navigate]);
  const showToday = useCallback(() => {
    const date = localDate();
    setMonth(date.slice(0, 7));
    setEntriesTarget((value) => ({ key: value.key + 1, date }));
    entriesScroll.current?.scrollToTop();
    navigate('entries');
  }, [navigate]);
  const quickEntry =
    notice?.entryId && Date.now() < notice.expiresAt
      ? ledger?.entries.find((entry) => entry.id === notice.entryId)
      : undefined;
  const editRecentlySaved = () => {
    if (!notice?.entryId || Date.now() >= notice.expiresAt) {
      setToast('快捷修改已过期，请在账单中打开');
      return;
    }
    const current = ledger?.entries.find(
      (entry) => entry.id === notice.entryId,
    );
    if (!current) {
      setToast('这笔账单已不存在');
      return;
    }
    setNotice(null);
    setEditor({ entry: current });
  };
  // Keep the screen elements and callbacks stable while native paging animates.
  const pages = useMemo(
    () =>
      ledger
        ? PAGE_KEYS.map((key) => ({
            key,
            content:
              key === 'entries' ? (
                <MemoEntriesScreen
                  today={today}
                  resetKey={entriesTarget.key}
                  focusDate={entriesTarget.date}
                  listRef={entriesScroll}
                  ledger={ledger}
                  month={month}
                  onMonth={onMonth}
                  onEntry={onEntry}
                  onAdd={openEditor}
                />
              ) : (
                <ScrollView
                  testID={`page-${key}-scroll`}
                  nestedScrollEnabled
                  directionalLockEnabled
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{
                    paddingHorizontal: 24,
                    paddingBottom: Math.max(insets.bottom, 20) + 110,
                  }}
                >
                  {key === 'home' ? (
                    <MemoHomeScreen
                      today={today}
                      ledger={ledger}
                      month={month}
                      onMonth={onMonth}
                      onAdd={openEditor}
                      onEntry={onEntry}
                      onAll={showAll}
                      onToday={showToday}
                      onSettings={openSettings}
                      onTemplate={openTemplate}
                      onBackup={openBackup}
                      onRecurring={openRecurring}
                      onRecurringSettings={openRecurringSettings}
                    />
                  ) : (
                    <MemoStatsScreen
                      today={today}
                      ledger={ledger}
                      month={month}
                      onMonth={onMonth}
                    />
                  )}
                </ScrollView>
              ),
          }))
        : [],
    [
      ledger,
      month,
      onMonth,
      onEntry,
      openEditor,
      openSettings,
      openTemplate,
      openBackup,
      openRecurring,
      openRecurringSettings,
      showAll,
      showToday,
      entriesTarget,
      insets.bottom,
      today,
    ],
  );

  if (loading || !ledger)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 30,
          gap: 17,
        }}
      >
        <Icon name="leaf" size={36} color={t.accent} />
        <Txt size={24} weight="500">
          清账
        </Txt>
        {loading ? (
          <ActivityIndicator color={t.accent} />
        ) : (
          <>
            <Txt color={t.muted} style={{ textAlign: 'center' }}>
              {error}
            </Txt>
            <Button disabled={saving} onPress={reload}>
              重新读取
            </Button>
            <Button variant="soft" onPress={() => setSnapshotRecovery(true)}>
              从本机快照恢复
            </Button>
            {snapshotRecovery && (
              <Sheet
                visible
                title="本机快照恢复"
                onClose={() => setSnapshotRecovery(false)}
                dismissible={!saving}
              >
                <SnapshotManager
                  onRestored={() => setSnapshotRecovery(false)}
                />
              </Sheet>
            )}
            <Button
              variant="soft"
              disabled={saving}
              onPress={() => {
                void importLedger()
                  .then(setRecovery)
                  .catch((e) =>
                    setRecoveryError(
                      e instanceof Error ? e.message : '备份读取失败',
                    ),
                  );
              }}
            >
              从备份恢复账本
            </Button>
            {recovery && (
              <View style={{ gap: 12, maxWidth: 330 }}>
                <Txt size={12}>
                  此备份包含 {recovery.entries.length}{' '}
                  笔账单。确认后会替换当前无法读取的数据，建议先保留原始数据副本。
                </Txt>
                <Button
                  disabled={saving}
                  onPress={() => {
                    void recover(recovery).catch(() =>
                      setRecoveryError('恢复失败，原数据仍保留'),
                    );
                  }}
                >
                  确认恢复账本
                </Button>
                <Button
                  variant="plain"
                  disabled={saving}
                  onPress={() => setRecovery(null)}
                >
                  取消恢复
                </Button>
              </View>
            )}
            {!!recoveryError && (
              <Txt size={12} color={t.danger}>
                {recoveryError}
              </Txt>
            )}
          </>
        )}
      </View>
    );

  return (
    <BlurTargetContext.Provider value={blurTarget}>
      <View
        style={{
          flex: 1,
          backgroundColor:
            Platform.OS === 'web'
              ? t.dark
                ? '#0C140F'
                : '#E9EDE5'
              : t.background,
        }}
      >
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: 540,
            alignSelf: 'center',
            backgroundColor: t.background,
            overflow: 'hidden',
            borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
            borderRightWidth: Platform.OS === 'web' ? 1 : 0,
            borderColor: t.border,
          }}
        >
          <BackgroundSurface ref={blurTarget} style={{ flex: 1 }}>
            <View
              style={{
                paddingTop: Math.max(
                  insets.top,
                  Platform.OS === 'web' ? 26 : 12,
                ),
                paddingHorizontal: 24,
                paddingBottom: 27,
              }}
            >
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <View style={[styles.row, { gap: 8 }]}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 10,
                      backgroundColor: t.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon
                      name="leaf"
                      size={17}
                      color={t.dark ? '#203526' : '#FFFFFF'}
                    />
                  </View>
                  <Txt size={19} weight="600" style={{ letterSpacing: 3 }}>
                    清账
                  </Txt>
                </View>
                <View style={[styles.row, { gap: 4 }]}>
                  <IconButton
                    name={privacy.preferences.hideAmounts ? 'eye-off' : 'eye'}
                    label={
                      privacy.preferences.hideAmounts ? '显示金额' : '隐藏金额'
                    }
                    disabled={privacy.saving}
                    onPress={() => {
                      void privacy
                        .update((value) => ({
                          ...value,
                          hideAmounts: !value.hideAmounts,
                        }))
                        .catch((error) =>
                          setToast(
                            error instanceof Error
                              ? error.message
                              : '设置保存失败',
                          ),
                        );
                    }}
                  />
                  <IconButton
                    name="settings"
                    label="打开设置"
                    onPress={openSettings}
                    style={{ width: 38, height: 38, borderRadius: 19 }}
                  />
                </View>
              </View>
            </View>
            <SwipePager
              index={PAGE_KEYS.indexOf(tab)}
              navigationKey={navigationKey}
              progress={pageProgress}
              onIndexChange={onPageChange}
              pages={pages}
            />
          </BackgroundSurface>
          <BottomNavigation
            tab={tab}
            progress={pageProgress}
            onTab={navigate}
            bottom={Math.max(insets.bottom, 18)}
            onAdd={() => {
              setEditor({});
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
            }}
          />
          {(!!toast || !!undo) && !editor && !settings && (
            <Animated.View
              entering={reduce ? undefined : FadeIn.duration(150)}
              exiting={reduce ? undefined : FadeOut.duration(150)}
              accessibilityLiveRegion="polite"
              pointerEvents={undo || quickEntry ? 'auto' : 'none'}
              style={{
                position: 'absolute',
                top: Math.max(insets.top, 25) + 48,
                left: 30,
                right: 30,
                borderRadius: 17,
                backgroundColor: t.text,
                paddingHorizontal: 17,
                paddingVertical: 13,
                gap: 5,
              }}
            >
              {!!toast && (!undo || !toast.startsWith('账单已删除')) && (
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <Txt size={12} color={t.background} style={{ flex: 1 }}>
                    {toast}
                  </Txt>
                  {quickEntry && (
                    <Button
                      label="修改刚保存的账单"
                      variant="plain"
                      disabled={saving}
                      onPress={editRecentlySaved}
                      style={{
                        minHeight: 36,
                        paddingHorizontal: 9,
                        paddingVertical: 6,
                      }}
                    >
                      <Txt size={12} color={t.background} weight="600">
                        修改
                      </Txt>
                    </Button>
                  )}
                </View>
              )}
              {undo && (
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <Txt size={12} color={t.background} style={{ flex: 1 }}>
                    已删除一笔账单 · 8 秒内可撤销
                  </Txt>
                  <Button
                    label="撤销删除"
                    disabled={saving}
                    variant="plain"
                    onPress={() => {
                      void restoreDeleted()
                        .then(() => setToast('账单已恢复'))
                        .catch((error) =>
                          setToast(
                            error instanceof Error
                              ? error.message
                              : '恢复失败，请重试',
                          ),
                        );
                    }}
                    style={{
                      minHeight: 36,
                      paddingHorizontal: 9,
                      paddingVertical: 6,
                    }}
                  >
                    <Txt size={12} color={t.background} weight="600">
                      {saving ? '正在恢复…' : '撤销删除'}
                    </Txt>
                  </Button>
                </View>
              )}
            </Animated.View>
          )}
          {editor && (
            <EntryEditor
              key={
                editor.entry?.id ??
                (editor.refundOf
                  ? `refund-${editor.refundOf.id}`
                  : editor.recurringId
                    ? `recurring-${editor.recurringId}-${editor.recurringDate}`
                    : (editor.templateId ?? 'new'))
              }
              entry={editor.entry}
              refundOf={editor.refundOf}
              templateId={editor.templateId}
              recurringId={editor.recurringId}
              recurringDate={editor.recurringDate}
              onRefund={openRefund}
              onClose={() => setEditor(null)}
              onSaved={(message, date, entryId) => {
                setMonth(date.slice(0, 7));
                setToast(message, entryId);
              }}
            />
          )}
          {settings && (
            <SettingsSheet
              month={month}
              initialPage={settings || 'main'}
              onClose={closeSettings}
              onSaved={setToast}
              onRecurring={openRecurring}
            />
          )}
        </View>
      </View>
    </BlurTargetContext.Provider>
  );
}
