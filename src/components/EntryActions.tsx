import React from 'react';
import { View } from 'react-native';
import { type Entry, type Ledger, categoryFor } from '../domain/ledger';
import { useTheme } from '../theme';
import { feedback } from '../motion';
import { Sheet } from './Sheet';
import { Button, Icon, MoneyText, Txt, styles } from './ui';

export function EntryActions({
  entry,
  ledger,
  onClose,
  onEdit,
  onRepeat,
}: {
  entry: Entry;
  ledger: Ledger;
  onClose: () => void;
  onEdit: (entry: Entry) => void;
  onRepeat: (entry: Entry) => void;
}) {
  const t = useTheme();
  return (
    <Sheet visible title="账单快捷操作" onClose={onClose}>
      <View style={{ gap: 10, paddingBottom: 14 }}>
        <View
          style={{
            backgroundColor: t.surfaceAlt,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: t.cardBorder,
            padding: 16,
            gap: 4,
            marginBottom: 4,
          }}
        >
          <Txt size={15} weight="600">
            {entry.note || categoryFor(ledger, entry.categoryId).label}
          </Txt>
          <Txt size={12} color={t.muted}>
            {entry.date} · {categoryFor(ledger, entry.categoryId).label}
          </Txt>
          <MoneyText
            amount={entry.amount}
            currency
            size={30}
            style={{ marginTop: 4, fontWeight: '600' }}
          />
        </View>
        <Button
          label="再记一笔"
          onPress={() => {
            feedback('light');
            onRepeat(entry);
          }}
          style={{ minHeight: 50, borderRadius: 16 }}
        >
          <View style={styles.row}>
            <Icon
              name="copy"
              size={18}
              color={t.onPrimary}
            />
            <Txt weight="600" color={t.onPrimary}>
              再记一笔
            </Txt>
          </View>
        </Button>
        <Button
          variant="soft"
          onPress={() => onEdit(entry)}
          style={{ minHeight: 48, borderRadius: 16 }}
        >
          编辑这笔账单
        </Button>
        <Txt
          size={11}
          color={t.muted}
          style={{ textAlign: 'center', marginTop: 4 }}
        >
          再记一笔会预填原内容，日期默认今天，确认后保存。
        </Txt>
      </View>
    </Sheet>
  );
}
