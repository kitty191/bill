import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useReducedMotion,
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
import { EntriesScreen } from './src/screens/EntriesScreen';
import { StatsScreen } from './src/screens/StatsScreen';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LedgerProvider>
            <Main />
          </LedgerProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Main() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { ledger, loading, error, reload, recover, saving } = useLedger();
  const [recovery, setRecovery] = useState<Ledger | null>(null);
  const [recoveryError, setRecoveryError] = useState('');
  const [tab, setTab] = useState<Tab>('home');
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [editor, setEditor] = useState<{ entry?: Entry } | null>(null);
  const [settings, setSettings] = useState(false);
  const [toast, setToast] = useState('');
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const blurTarget = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(timer);
  }, [toast]);
  const navigate = (next: typeof tab) => {
    setTab(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
    void Haptics.selectionAsync().catch(() => {});
  };
  const onMonth = (offset: number) =>
    setMonth((current) => shiftMonth(current, offset));
  const onEntry = (entry: Entry) => setEditor({ entry });

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
          <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
            <ScrollView
              ref={scroll}
              contentContainerStyle={{
                paddingTop: Math.max(
                  insets.top,
                  Platform.OS === 'web' ? 26 : 12,
                ),
                paddingHorizontal: 24,
                paddingBottom: Math.max(insets.bottom, 20) + 110,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View
                style={[
                  styles.row,
                  { justifyContent: 'space-between', marginBottom: 27 },
                ]}
              >
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
                <IconButton
                  name="settings"
                  label="打开设置"
                  onPress={() => setSettings(true)}
                  style={{ width: 38, height: 38, borderRadius: 19 }}
                />
              </View>
              <Animated.View
                key={tab}
                entering={reduce ? undefined : FadeInDown.duration(220)}
              >
                {tab === 'home' && (
                  <HomeScreen
                    ledger={ledger}
                    month={month}
                    onMonth={onMonth}
                    onAdd={() => setEditor({})}
                    onEntry={onEntry}
                    onAll={() => navigate('entries')}
                    onSettings={() => setSettings(true)}
                  />
                )}
                {tab === 'entries' && (
                  <EntriesScreen
                    ledger={ledger}
                    month={month}
                    onMonth={onMonth}
                    onEntry={onEntry}
                    onAdd={() => setEditor({})}
                  />
                )}
                {tab === 'stats' && (
                  <StatsScreen
                    ledger={ledger}
                    month={month}
                    onMonth={onMonth}
                  />
                )}
              </Animated.View>
            </ScrollView>
          </BlurTargetView>
          <BottomNavigation
            tab={tab}
            onTab={navigate}
            bottom={Math.max(insets.bottom, 18)}
            onAdd={() => {
              setEditor({});
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
            }}
          />
          {!!toast && (
            <Animated.View
              entering={reduce ? undefined : FadeIn.duration(150)}
              exiting={reduce ? undefined : FadeOut.duration(150)}
              accessibilityLiveRegion="polite"
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: Math.max(insets.top, 25) + 48,
                left: 30,
                right: 30,
                borderRadius: 17,
                backgroundColor: t.text,
                paddingHorizontal: 17,
                paddingVertical: 13,
                alignItems: 'center',
              }}
            >
              <Txt size={12} color={t.background}>
                {toast}
              </Txt>
            </Animated.View>
          )}
          {editor && (
            <EntryEditor
              key={editor.entry?.id ?? 'new'}
              entry={editor.entry}
              onClose={() => setEditor(null)}
              onSaved={(message, date) => {
                setMonth(date.slice(0, 7));
                setToast(message);
              }}
            />
          )}
          {settings && (
            <SettingsSheet
              onClose={() => setSettings(false)}
              onSaved={setToast}
            />
          )}
        </View>
      </View>
    </BlurTargetContext.Provider>
  );
}
