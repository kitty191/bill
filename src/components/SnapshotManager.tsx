import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { validateLedger, totals, type Ledger } from '../domain/ledger';
import { type LocalSnapshot } from '../domain/snapshots';
import { loadSnapshots } from '../storage/ledgerStore';
import { exportSnapshot } from '../storage/backup';
import { useLedger } from '../state/LedgerProvider';
import { useMoney } from '../state/PrivacyContext';
import { useTheme } from '../theme';
import { Button, Txt, styles } from './ui';

export function SnapshotManager({
  onBack,
  onRestored,
}: {
  onBack?: () => void;
  onRestored?: () => void;
}) {
  const t = useTheme();
  const money = useMoney();
  const { ledger, saving, restoreSnapshot, clearSnapshotHistory } = useLedger();
  const [snapshots, setSnapshots] = useState<LocalSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<{
    snapshot: LocalSnapshot;
    ledger: Ledger;
  } | null>(null);
  const [confirm, setConfirm] = useState<'restore' | 'clear' | null>(null);
  const summary = useMemo(
    () => (selected ? totals(selected.ledger.entries) : null),
    [selected],
  );
  const counts = useMemo(
    () =>
      snapshots.map((snapshot) => {
        try {
          return validateLedger(JSON.parse(snapshot.payload)).entries.length;
        } catch {
          return undefined;
        }
      }),
    [snapshots],
  );
  useEffect(() => {
    let active = true;
    void loadSnapshots()
      .then((items) => {
        if (active) setSnapshots(items);
      })
      .catch((error) => {
        if (active)
          setError(error instanceof Error ? error.message : '无法读取本机快照');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const disabled = saving || busy || loading;
  const perform = async (operation: () => Promise<void>) => {
    if (disabled) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      setError(error instanceof Error ? error.message : '操作失败，请重试');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {onBack && (
        <Button
          variant="plain"
          onPress={onBack}
          disabled={saving || busy}
          style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
        >
          返回设置
        </Button>
      )}
      <Txt size={12} color={t.muted} style={{ marginVertical: 12 }}>
        自动保留最近 5
        个修改前的有效账本，包含账单、预算、分类与周期账单。快照仅保存在本机，换机或卸载前仍需导出备份。
      </Txt>
      {!!error && (
        <Txt
          testID="snapshot-error"
          color={t.danger}
          size={12}
          style={{ marginBottom: 12 }}
        >
          {error}
        </Txt>
      )}
      {!!notice && (
        <Txt size={12} color={t.accent} style={{ marginBottom: 12 }}>
          {notice}
        </Txt>
      )}
      {loading ? (
        <Txt color={t.muted}>正在读取快照…</Txt>
      ) : (
        !snapshots.length && (
          <Txt color={t.muted} size={12}>
            还没有快照，修改账本后会自动保留上一版本。
          </Txt>
        )
      )}
      {snapshots.map((snapshot, index) => {
        const count = counts[index];
        return (
          <Button
            key={snapshot.id}
            label={`查看本机快照${index + 1}`}
            variant="plain"
            disabled={disabled}
            onPress={() => {
              setConfirm(null);
              setError('');
              try {
                setSelected({
                  snapshot,
                  ledger: validateLedger(JSON.parse(snapshot.payload)),
                });
              } catch {
                setSelected(null);
                setError('此快照已损坏，无法恢复，请选择其他版本');
              }
            }}
            style={{
              alignItems: 'flex-start',
              backgroundColor: t.surfaceAlt,
              padding: 15,
              marginBottom: 9,
              gap: 4,
            }}
          >
            <Txt size={13} weight="500">
              {new Date(snapshot.createdAt).toLocaleString('zh-CN')}
            </Txt>
            <Txt size={11} color={t.muted}>
              {count === undefined ? '此版本无法读取' : `${count} 笔账单`}
              {index === 0 ? ' · 最近保存' : ''}
            </Txt>
          </Button>
        );
      })}
      {selected && (
        <View
          testID="snapshot-preview"
          style={{
            padding: 15,
            borderRadius: 17,
            borderWidth: 1,
            borderColor: t.border,
            gap: 12,
            marginTop: 12,
          }}
        >
          <Txt size={13} weight="500">
            此版本：{selected.ledger.entries.length} 笔账单 ·{' '}
            {selected.ledger.accounts.length} 个账户 ·{' '}
            {selected.ledger.recurringBills.length} 个周期账单
          </Txt>
          {summary && (
            <Txt size={11} color={t.muted}>
              累计收入 ¥{money(summary.income)} · 净支出 ¥
              {money(summary.expense)}
            </Txt>
          )}
          <View style={styles.row}>
            <Button
              variant="soft"
              disabled={disabled}
              style={{ flex: 1 }}
              onPress={() =>
                void perform(async () => {
                  await exportSnapshot(
                    selected.snapshot.payload,
                    selected.snapshot.id,
                  );
                  setNotice('快照文件已生成，请确认已保存');
                })
              }
            >
              导出此快照
            </Button>
            <Button
              disabled={disabled}
              style={{ flex: 1 }}
              onPress={() => setConfirm('restore')}
            >
              恢复此快照
            </Button>
          </View>
        </View>
      )}
      <Button
        variant="plain"
        disabled={saving || busy || loading}
        onPress={() => setConfirm('clear')}
        style={{ marginTop: 15 }}
      >
        <Txt size={12} color={t.danger}>
          清理全部快照
        </Txt>
      </Button>
      {confirm && (
        <View
          style={{
            borderRadius: 17,
            padding: 15,
            backgroundColor: t.surfaceAlt,
            gap: 12,
            marginTop: 12,
          }}
        >
          <Txt size={14} weight="600">
            {confirm === 'restore'
              ? '确认恢复这个版本？'
              : '确认清理全部快照？'}
          </Txt>
          <Txt size={12} color={t.muted}>
            {confirm === 'restore'
              ? `当前${ledger ? ` ${ledger.entries.length} 笔账单` : '账本'}将替换为此版本。恢复前会保存当前有效账本，方便返回。`
              : '仅清理快照历史，当前账本与升级前备份保留。后续修改会重新生成快照。'}
          </Txt>
          <View style={styles.row}>
            <Button
              variant="soft"
              disabled={disabled}
              style={{ flex: 1 }}
              onPress={() => setConfirm(null)}
            >
              取消
            </Button>
            <Button
              variant={confirm === 'clear' ? 'danger' : 'primary'}
              disabled={disabled}
              style={{ flex: 1 }}
              onPress={() =>
                void perform(async () => {
                  if (confirm === 'restore') {
                    if (!selected) throw new Error('请重新选择快照');
                    await restoreSnapshot(
                      selected.snapshot.id,
                      selected.snapshot.payload,
                    );
                    setNotice('账本已恢复，恢复前的版本也已保留');
                  } else {
                    await clearSnapshotHistory();
                    setNotice('快照已清理，当前账本未改变');
                  }
                  setSelected(null);
                  setConfirm(null);
                  setSnapshots(await loadSnapshots());
                  if (confirm === 'restore') onRestored?.();
                })
              }
            >
              {confirm === 'restore' ? '确认恢复快照' : '确认清理快照'}
            </Button>
          </View>
        </View>
      )}
    </>
  );
}
