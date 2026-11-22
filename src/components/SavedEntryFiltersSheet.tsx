import React, { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { id } from '../domain/ledger';
import {
  type SavedEntryFilter,
  savedFilterLimit,
  savedFilterNameLimit,
} from '../domain/savedEntryFilters';
import {
  loadSavedEntryFilters,
  saveSavedEntryFilters,
} from '../storage/savedEntryFilters';
import { useTheme } from '../theme';
import { Sheet } from './Sheet';
import { Button, SectionTitle, Txt, styles } from './ui';

export function SavedEntryFiltersSheet({
  current,
  canSave,
  onUse,
  onClose,
}: {
  current: Omit<SavedEntryFilter, 'id' | 'name'>;
  canSave: boolean;
  onUse: (filter: SavedEntryFilter) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [saved, setSaved] = useState<SavedEntryFilter[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const writing = useRef(false);
  useEffect(() => {
    let open = true;
    void loadSavedEntryFilters().then(
      (items) => {
        if (open) setSaved(items);
      },
      () => {
        if (open) setError('无法读取常用筛选，请关闭后重试');
      },
    );
    return () => {
      open = false;
    };
  }, []);

  const persist = async (next: SavedEntryFilter[]) => {
    if (writing.current) return false;
    writing.current = true;
    setBusy(true);
    setError('');
    try {
      await saveSavedEntryFilters(next);
      setSaved(next);
      return true;
    } catch {
      setError('无法保存常用筛选，请重试');
      return false;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };

  const add = async () => {
    const title = name.trim();
    if (!title || !canSave || !saved || saved.length >= savedFilterLimit) return;
    if (saved.some((item) => item.name === title)) {
      setError('已有同名常用筛选');
      return;
    }
    if (await persist([...saved, { ...current, name: title, id: id() }]))
      setName('');
  };

  return (
    <Sheet visible onClose={onClose} title="常用筛选" dismissible={!busy}>
      {saved?.length === 0 && <Txt color={t.muted}>还没有保存的筛选</Txt>}
      {saved?.map((item) => (
        <View key={item.id} style={[styles.row, { gap: 6, marginBottom: 5 }]}>
          <Button
            variant="soft"
            label={`应用${item.name}`}
            disabled={busy}
            style={{ flex: 1 }}
            onPress={() => {
              if (writing.current) return;
              try {
                onUse(item);
                onClose();
              } catch (failure) {
                setError(
                  failure instanceof Error ? failure.message : '无法应用这个筛选',
                );
              }
            }}
          >
            {item.name}
          </Button>
          <Button
            variant="plain"
            label={`移除${item.name}`}
            disabled={busy}
            onPress={() =>
              void persist(saved.filter((value) => value.id !== item.id))
            }
          >
            移除
          </Button>
        </View>
      ))}
      {saved === null && !error && <Txt color={t.muted}>正在读取常用筛选…</Txt>}
      {saved && (
        <>
          {canSave && saved.length < savedFilterLimit ? (
            <>
              <SectionTitle title="保存当前筛选" />
              <TextInput
                accessibilityLabel="筛选名称"
                placeholder="例如：上月报销"
                placeholderTextColor={t.subtle}
                value={name}
                onChangeText={setName}
                maxLength={savedFilterNameLimit}
                editable={!busy}
                style={{
                  minHeight: 46,
                  paddingHorizontal: 13,
                  borderRadius: 13,
                  fontSize: 16,
                  color: t.text,
                  backgroundColor: t.surfaceAlt,
                }}
              />
              <Button
                disabled={busy || !name.trim()}
                onPress={() => void add()}
                style={{ marginTop: 8 }}
              >
                保存筛选
              </Button>
            </>
          ) : (
            <Txt size={12} color={t.muted}>
              {saved.length >= savedFilterLimit
                ? `已保存 ${savedFilterLimit} 个筛选，移除旧筛选后可以继续添加。`
                : '先在账单页选好条件，再保存为常用筛选。'}
            </Txt>
          )}
        </>
      )}
      <View accessibilityLiveRegion="polite">
        {!!error && (
          <Txt color={t.danger} size={12}>
            {error}
          </Txt>
        )}
      </View>
    </Sheet>
  );
}
