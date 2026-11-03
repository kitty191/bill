import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { usePrivacy } from '../state/PrivacyContext';
import { useTheme } from '../theme';
import { Button, Icon, Txt } from './ui';

export function PrivacyGuard({ children }: { children: React.ReactNode }) {
  const privacy = usePrivacy();
  const t = useTheme();
  const attempted = useRef(-1);
  const open = privacy.phase === 'unlocked';
  useEffect(() => {
    if (
      privacy.phase === 'locked' &&
      privacy.active &&
      attempted.current !== privacy.lockEpoch
    ) {
      attempted.current = privacy.lockEpoch;
      void privacy.unlock();
    }
  }, [privacy.phase, privacy.active, privacy.lockEpoch, privacy.unlock]);
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View
        style={{ flex: 1, opacity: open ? 1 : 0 }}
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        aria-hidden={!open}
      >
        {children}
      </View>
      {!open && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: t.background,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 30,
              gap: 18,
            },
          ]}
          accessibilityViewIsModal
        >
          <Icon
            name={privacy.phase === 'locked' ? 'lock' : 'leaf'}
            size={38}
            color={t.accent}
          />
          <Txt size={25} weight="600">
            清账
          </Txt>
          <Txt color={t.muted} style={{ textAlign: 'center' }}>
            {privacy.phase === 'locked'
              ? '验证身份后查看你的账本'
              : privacy.phase === 'loading'
                ? '正在读取本机设置'
                : privacy.error}
          </Txt>
          {privacy.phase === 'loading' || privacy.authBusy ? (
            <ActivityIndicator color={t.accent} />
          ) : privacy.phase === 'locked' ? (
            <Button onPress={() => void privacy.unlock()}>
              使用指纹／面容解锁
            </Button>
          ) : (
            <Button onPress={privacy.reload}>重新读取设置</Button>
          )}
          {privacy.phase === 'locked' && !!privacy.error && (
            <Txt size={12} color={t.danger}>
              {privacy.error}
            </Txt>
          )}
        </View>
      )}
    </View>
  );
}
