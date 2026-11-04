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
      <View style={{ gap: 8, paddingBottom: 16 }}>
        <Txt size={14} weight="500">
          {entry.note || categoryFor(ledger, entry.categoryId).label}
        </Txt>
        <Txt size={11} color={t.muted}>
          {entry.date} · {categoryFor(ledger, entry.categoryId).label}
        </Txt>
        <MoneyText
          amount={entry.amount}
          currency
          size={32}
          style={{ marginBottom: 12 }}
        />
        <Button
          label="再记一笔"
          onPress={() => {
            feedback('light');
            onRepeat(entry);
          }}
        >
          <View style={styles.row}>
            <Icon
              name="copy"
              size={18}
              color={t.dark ? '#193423' : '#FFFFFF'}
            />
            <Txt weight="600" color={t.dark ? '#193423' : '#FFFFFF'}>
              再记一笔
            </Txt>
          </View>
        </Button>
        <Button variant="soft" onPress={() => onEdit(entry)}>
          编辑这笔账单
        </Button>
        <Txt
          size={11}
          color={t.muted}
          style={{ textAlign: 'center', marginTop: 6 }}
        >
          再记一笔会预填原内容，日期默认今天，确认后保存。
        </Txt>
      </View>
    </Sheet>
  );
}
