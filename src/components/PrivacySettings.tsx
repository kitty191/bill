import React, { useState } from 'react';
import { Switch, View } from 'react-native';
import { usePrivacy } from '../state/PrivacyContext';
import { useTheme } from '../theme';
import { Button, SectionTitle, Txt, styles } from './ui';

export function PrivacySettings({
  onBack,
  onBackup,
}: {
  onBack: () => void;
  onBackup: () => Promise<void>;
}) {
  const t = useTheme();
  const privacy = usePrivacy();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const disabled = privacy.saving || privacy.authBusy || busy;
  const perform = async (task: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await task();
    } catch (error) {
      setError(error instanceof Error ? error.message : '操作失败，请重试');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        variant="plain"
        onPress={onBack}
        style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
      >
        返回设置
      </Button>
      <SectionTitle title="隐私" />
      <View
        style={{
          backgroundColor: t.surfaceAlt,
          borderRadius: 18,
          padding: 16,
          gap: 20,
        }}
      >
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt size={13} weight="500">
              隐藏金额
            </Txt>
            <Txt size={10} color={t.muted}>
              隐藏账本与统计中的数字金额，编辑和导出保留真实金额。
            </Txt>
          </View>
          <Switch
            accessibilityLabel="隐藏金额开关"
            value={privacy.preferences.hideAmounts}
            disabled={disabled}
            trackColor={{ true: t.accent, false: t.border }}
            onValueChange={(hideAmounts) =>
              void perform(() =>
                privacy.update((value) => ({ ...value, hideAmounts })),
              )
            }
          />
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt size={13} weight="500">
              应用锁
            </Txt>
            <Txt size={10} color={t.muted}>
              {privacy.supportsAppLock
                ? '返回应用时，使用系统指纹、面容或设备密码验证。'
                : '指纹／Face ID 应用锁仅在手机独立安装版可用。'}
            </Txt>
          </View>
          <Switch
            accessibilityLabel="应用锁"
            value={privacy.preferences.appLockEnabled}
            disabled={disabled || !privacy.supportsAppLock}
            trackColor={{ true: t.accent, false: t.border }}
            onValueChange={(enabled) =>
              void perform(() => privacy.setAppLock(enabled))
            }
          />
        </View>
      </View>
      <SectionTitle title="备份提醒" />
      <Txt size={11} color={t.muted} style={{ marginBottom: 12 }}>
        到期后在首页提醒导出 JSON 备份。最近导出：
        {privacy.preferences.lastExportAt
          ? new Date(privacy.preferences.lastExportAt).toLocaleDateString(
              'zh-CN',
            )
          : '尚无记录'}
        。
      </Txt>
      <View style={styles.row}>
        {(
          [
            [0, '关闭提醒'],
            [7, '每周提醒'],
            [30, '每月提醒'],
          ] as const
        ).map(([days, label]) => (
          <Button
            key={days}
            disabled={disabled}
            variant={
              privacy.preferences.backupReminderDays === days ? 'soft' : 'plain'
            }
            onPress={() =>
              void perform(() =>
                privacy.update((value) => ({
                  ...value,
                  backupReminderDays: days,
                  reminderStartedAt: days
                    ? (value.reminderStartedAt ?? new Date().toISOString())
                    : null,
                  snoozeUntil: null,
                })),
              )
            }
          >
            {label}
          </Button>
        ))}
      </View>
      <Button
        disabled={disabled}
        onPress={() => void perform(onBackup)}
        style={{ marginTop: 20 }}
      >
        导出 JSON 备份
      </Button>
      <Txt size={10} color={t.muted} style={{ marginTop: 12 }}>
        请确认导出的文件已妥善保存。应用锁和金额显示设置只保存在本机，不随账本备份迁移。
      </Txt>
      {!!error && (
        <Txt
          testID="privacy-error"
          color={t.danger}
          size={12}
          style={{ marginTop: 15 }}
        >
          {error}
        </Txt>
      )}
    </>
  );
}
