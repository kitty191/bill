import React, { useState } from 'react';
import { Platform, Switch, View } from 'react-native';
import { useAutomaticBackup } from '../state/AutomaticBackupProvider';
import { useTheme } from '../theme';
import { Button, SectionTitle, Txt, styles } from './ui';
export function AutomaticBackupSettings() {
  const t = useTheme();
  const backup = useAutomaticBackup();
  const [operationError, setOperationError] = useState('');
  const p = backup.preferences;
  const perform = (task: () => Promise<void>) => {
    setOperationError('');
    void task().catch((error) =>
      setOperationError(
        error instanceof Error ? error.message : '操作失败，请重试',
      ),
    );
  };
  return (
    <>
      <SectionTitle title="自动文件备份" />
      <Txt size={11} color={t.muted} style={{ marginBottom: 12 }}>
        选择目录后，到期生成完整备份，保留最近 7 份。
        {backup.backgroundSupported
          ? '可另行允许系统后台调度，执行时间由系统安排。'
          : '打开或回到应用时检查是否到期。'}
      </Txt>
      {!backup.supported && (
        <Txt size={11} color={t.muted} style={{ marginBottom: 12 }}>
          此浏览器不支持目录自动写入，可使用下方导出 JSON 备份。
        </Txt>
      )}
      {Platform.OS === 'ios' && (
        <Txt size={11} color={t.muted} style={{ marginBottom: 12 }}>
          系统可能要求重新选择目录授权，届时会提示，不会将失败记为成功。
        </Txt>
      )}
      <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
        {(
          [
            [0, '关闭自动备份'],
            [1, '每天备份'],
            [7, '每周备份'],
            [30, '每月备份'],
          ] as const
        ).map(([days, label]) => (
          <Button
            key={days}
            variant={p?.days === days ? 'soft' : 'plain'}
            label={label}
            disabled={backup.busy || !p || (!backup.supported && days !== 0)}
            onPress={() => perform(() => backup.configure(days))}
            style={{ paddingHorizontal: 10 }}
          >
            {label}
          </Button>
        ))}
      </View>
      {backup.backgroundSupported && (
        <View style={{ marginTop: 14, gap: 8 }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Txt size={12} style={{ flex: 1 }}>
              允许系统后台备份
            </Txt>
            <Switch
              accessibilityLabel="允许系统后台备份"
              value={p?.background ?? false}
              disabled={backup.busy || !p?.days || !p?.directory}
              onValueChange={(enabled) =>
                perform(() => backup.configureBackground(enabled))
              }
              trackColor={{ false: t.border, true: t.accent }}
            />
          </View>
          <Txt size={10} color={t.muted}>
            {backup.backgroundStatus === 'scheduled'
              ? '已加入系统后台调度。'
              : '后台备份尚未启用。'}
            省电和网络状态可能延迟执行；系统“强行停止”后，需要重新打开应用。
          </Txt>
          <Txt size={10} color={t.muted}>
            最近后台成功：
            {p?.lastBackgroundSuccessAt
              ? new Date(p.lastBackgroundSuccessAt).toLocaleString('zh-CN')
              : '尚无成功记录'}
          </Txt>
          {!!backup.backgroundError && (
            <>
              <Txt size={11} color={t.danger}>
                {backup.backgroundError}
              </Txt>
              <Button
                variant="plain"
                disabled={backup.busy}
                onPress={() => perform(backup.retryBackground)}
              >
                重试后台调度
              </Button>
            </>
          )}
        </View>
      )}
      <Txt size={11} color={t.muted} style={{ marginTop: 12 }}>
        目录：{p?.directoryName || '尚未选择'}
        {'\n'}最近成功：
        {p?.lastSuccessAt
          ? new Date(p.lastSuccessAt).toLocaleString('zh-CN')
          : '尚无成功备份'}
      </Txt>
      {p?.lastFileName && (
        <Txt
          testID="automatic-backup-file"
          size={10}
          color={t.muted}
          style={{ marginTop: 6 }}
        >
          {p.lastFileName}
        </Txt>
      )}
      <View style={[styles.row, { flexWrap: 'wrap', marginTop: 10 }]}>
        <Button
          variant="soft"
          label="选择自动备份目录"
          disabled={backup.busy || !p || !backup.supported}
          onPress={() => perform(backup.selectDirectory)}
        >
          {p?.directory ? '更换备份目录' : '选择备份目录'}
        </Button>
        <Button
          variant="plain"
          label="立即生成自动备份"
          disabled={backup.busy || !p?.directory || !backup.supported}
          onPress={() => perform(backup.run)}
        >
          {backup.busy ? '正在处理…' : '立即备份'}
        </Button>
      </View>
      {!!(operationError || backup.error) && (
        <Txt
          testID="automatic-backup-error"
          size={12}
          color={t.danger}
          style={{ marginTop: 10 }}
        >
          {operationError || backup.error}
        </Txt>
      )}
      {!p && (
        <View style={{ gap: 8 }}>
          <Button variant="plain" onPress={backup.reload}>
            重新读取备份设置
          </Button>
          <Button
            variant="soft"
            disabled={backup.busy}
            onPress={() => perform(backup.reset)}
          >
            重置自动备份设置
          </Button>
          <Txt size={10} color={t.muted}>
            重置只关闭自动备份并清除目录选择，已有备份文件与账本保留。
          </Txt>
        </View>
      )}
      <Txt size={10} color={t.muted} style={{ marginTop: 10 }}>
        备份写入并回读校验后才记录成功，不包含草稿和设备隐私设置。所选目录若随卸载删除，文件也会丢失；请选独立目录并保留换机备份。
      </Txt>
    </>
  );
}
