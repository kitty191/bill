import React, { useState } from 'react';
import { View } from 'react-native';
import { previewCsv } from '../domain/importCsv';
import { id, type Ledger } from '../domain/ledger';
import { useMoney } from '../state/PrivacyContext';
import { exportCsvTemplate, pickCsv } from '../storage/backup';
import { useTheme } from '../theme';
import { Button, Txt, styles } from './ui';

export function CsvImport({
  ledger,
  disabled,
  onImport,
}: {
  ledger: Ledger;
  disabled: boolean;
  onImport: (change: (current: Ledger) => Ledger) => Promise<void>;
}) {
  const t = useTheme();
  const money = useMoney();
  const [preview, setPreview] = useState<{
    raw: string;
    plan: ReturnType<typeof previewCsv>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await task();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'CSV 操作失败');
    } finally {
      setBusy(false);
    }
  };
  const unavailable = disabled || busy;
  const plan = preview?.plan;
  const duplicateCount =
    plan?.issues.filter((issue) => issue.duplicate).length ?? 0;
  return (
    <View style={{ gap: 9 }}>
      <Txt size={12} color={t.muted}>
        模板支持收入、支出和转账。日期用
        YYYY-MM-DD，账户和分类填写清账里的名称。
      </Txt>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Button
          variant="soft"
          disabled={unavailable}
          onPress={() => void run(() => exportCsvTemplate(ledger))}
        >
          下载 CSV 模板
        </Button>
        <Button
          disabled={unavailable}
          onPress={() =>
            void run(async () => {
              setPreview(null);
              const raw = await pickCsv();
              if (raw === null) return;
              setPreview({ raw, plan: previewCsv(raw, ledger) });
            })
          }
        >
          选择 CSV
        </Button>
      </View>
      {plan && preview && (
        <>
          <Txt size={13}>
            {plan.candidates.length} 笔可导入 · {duplicateCount} 笔疑似重复 ·{' '}
            {plan.issues.length - duplicateCount} 笔有问题
          </Txt>
          {plan.candidates.slice(0, 5).map((entry, index) => (
            <Txt key={index} size={12}>
              {entry.date} · ¥{money(entry.amount)} ·{' '}
              {entry.note ||
                ledger.categories.find((c) => c.id === entry.categoryId)
                  ?.label ||
                '转账'}
            </Txt>
          ))}
          {plan.issues.slice(0, 8).map((issue) => (
            <Txt key={issue.record} size={11} color={t.muted}>
              记录 {issue.record} · {issue.message}
            </Txt>
          ))}
          {plan.issues.length > 8 && (
            <Txt size={11}>另有 {plan.issues.length - 8} 笔跳过</Txt>
          )}
          <Button
            disabled={unavailable || !plan.candidates.length}
            onPress={() =>
              void run(async () => {
                const createdAt = new Date().toISOString();
                await onImport((current) => {
                  const checked = previewCsv(preview.raw, current);
                  if (JSON.stringify(checked) !== JSON.stringify(plan)) {
                    setPreview({ raw: preview.raw, plan: checked });
                    throw new Error('账本已变化，请核对更新后的预览再确认');
                  }
                  const entries = checked.candidates.map((candidate) => ({
                    ...candidate,
                    id: id(),
                    createdAt,
                  }));
                  return {
                    ...current,
                    entries: [...current.entries, ...entries],
                  };
                });
                setPreview(null);
                setMessage(`已导入 ${plan.candidates.length} 笔账单`);
              })
            }
          >
            确认导入有效账单
          </Button>
        </>
      )}
      {!!error && (
        <Txt size={12} color={t.danger}>
          {error}
        </Txt>
      )}
      {!!message && (
        <Txt size={12} color={t.accent}>
          {message}
        </Txt>
      )}
    </View>
  );
}
