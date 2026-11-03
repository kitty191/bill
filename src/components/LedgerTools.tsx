import React, { useState } from 'react';
import { Switch, TextInput, View } from 'react-native';
import {
  type ManagedCategory,
  type QuickTemplate,
  amountInput,
  categoryColors,
  categoryFor,
  categoryIcons,
  entryDefault,
  id,
  parseAmount,
} from '../domain/ledger';
import { useLedger } from '../state/LedgerProvider';
import { useMoney } from '../state/PrivacyContext';
import { useTheme } from '../theme';
import { Button, Icon, Txt, styles } from './ui';

function useOperation() {
  const context = useLedger();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const perform = async (operation: () => Promise<void>, message: string) => {
    setError('');
    setNotice('');
    try {
      await operation();
      setNotice(message);
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败，请重试');
    }
  };
  return { ...context, error, notice, perform };
}
function ToolStatus({
  error,
  notice,
  testID,
}: {
  error: string;
  notice: string;
  testID: string;
}) {
  const t = useTheme();
  return (
    <View accessibilityLiveRegion="polite">
      {!!error && (
        <Txt
          testID={testID}
          color={t.danger}
          size={12}
          style={{ marginVertical: 10 }}
        >
          {error}
        </Txt>
      )}
      {!!notice && (
        <Txt color={t.accent} size={12} style={{ marginVertical: 10 }}>
          {notice}
        </Txt>
      )}
    </View>
  );
}

export function CategoryManager({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const {
    ledger: data,
    update,
    saving,
    error,
    notice,
    perform,
  } = useOperation();
  const ledger = data!;
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [form, setForm] = useState<ManagedCategory | null>(null);
  const list = ledger.categories.filter((category) => category.kind === kind);
  const move = (categoryId: string, direction: number) =>
    update((current) => {
      const same = current.categories.filter((item) => item.kind === kind);
      const index = same.findIndex((item) => item.id === categoryId);
      const destination = same[index + direction];
      if (!destination) return current;
      const next = [...current.categories];
      const a = next.findIndex((item) => item.id === categoryId),
        b = next.findIndex((item) => item.id === destination.id);
      [next[a], next[b]] = [next[b]!, next[a]!];
      return { ...current, categories: next };
    });
  return (
    <>
      <Button
        variant="plain"
        onPress={onBack}
        style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
      >
        返回设置
      </Button>
      <Txt size={11} color={t.muted} style={{ marginVertical: 10 }}>
        隐藏分类后，已有账单与统计仍会保留。上下箭头调整记账时的顺序。
      </Txt>
      <View style={styles.row}>
        <Button
          variant={kind === 'expense' ? 'soft' : 'plain'}
          onPress={() => {
            setKind('expense');
            setForm(null);
          }}
        >
          支出分类
        </Button>
        <Button
          variant={kind === 'income' ? 'soft' : 'plain'}
          onPress={() => {
            setKind('income');
            setForm(null);
          }}
        >
          收入分类
        </Button>
        <Button
          variant="plain"
          disabled={saving}
          onPress={() =>
            setForm({
              id: `category-${id()}`,
              label: '',
              kind,
              color: categoryColors[0]!,
              icon: 'leaf',
              hidden: false,
            })
          }
        >
          新增分类
        </Button>
      </View>
      <ToolStatus error={error} notice={notice} testID="category-error" />
      {!form && (
        <View
          style={{
            backgroundColor: t.surfaceAlt,
            paddingHorizontal: 12,
            borderRadius: 18,
            marginTop: 10,
          }}
        >
          {list.map((category, index) => (
            <View
              key={category.id}
              style={[
                styles.row,
                {
                  paddingVertical: 11,
                  borderBottomWidth: index === list.length - 1 ? 0 : 1,
                  borderColor: t.border,
                  gap: 7,
                },
              ]}
            >
              <Button
                variant="plain"
                label={`编辑分类${category.label}`}
                disabled={saving}
                onPress={() => setForm({ ...category })}
                style={{
                  flex: 1,
                  justifyContent: 'flex-start',
                  paddingHorizontal: 0,
                  gap: 8,
                }}
              >
                <Icon name={category.icon} size={20} color={category.color} />
                <View>
                  <Txt size={12}>{category.label}</Txt>
                  {category.hidden && (
                    <Txt size={9} color={t.muted}>
                      已隐藏
                    </Txt>
                  )}
                </View>
              </Button>
              <Button
                variant="plain"
                label={`上移${category.label}`}
                disabled={saving || index === 0}
                onPress={() =>
                  void perform(() => move(category.id, -1), '分类顺序已更新')
                }
                style={{ paddingHorizontal: 7 }}
              >
                ↑
              </Button>
              <Button
                variant="plain"
                label={`下移${category.label}`}
                disabled={saving || index === list.length - 1}
                onPress={() =>
                  void perform(() => move(category.id, 1), '分类顺序已更新')
                }
                style={{ paddingHorizontal: 7 }}
              >
                ↓
              </Button>
              <Switch
                accessibilityLabel={`显示分类${category.label}`}
                value={!category.hidden}
                disabled={saving}
                trackColor={{ true: t.accent, false: t.border }}
                onValueChange={(visible) =>
                  void perform(
                    () =>
                      update((current) => ({
                        ...current,
                        categories: current.categories.map((item) =>
                          item.id === category.id
                            ? { ...item, hidden: !visible }
                            : item,
                        ),
                      })),
                    visible ? '分类已显示' : '分类已隐藏',
                  )
                }
              />
            </View>
          ))}
        </View>
      )}
      {form && (
        <View style={{ marginTop: 20, gap: 12 }}>
          <Txt size={14} weight="500">
            {ledger.categories.some((item) => item.id === form.id)
              ? '编辑分类'
              : '新建分类'}
          </Txt>
          <TextInput
            accessibilityLabel="分类名称"
            placeholder="分类名称"
            maxLength={20}
            value={form.label}
            onChangeText={(label) => setForm({ ...form, label })}
            editable={!saving}
            style={{
              backgroundColor: t.surfaceAlt,
              color: t.text,
              borderRadius: 13,
              paddingHorizontal: 14,
              minHeight: 46,
            }}
          />
          <Txt size={11} color={t.muted}>
            图标
          </Txt>
          <View style={[styles.row, { flexWrap: 'wrap', gap: 7 }]}>
            {categoryIcons.map((icon) => (
              <Button
                key={icon}
                label={`分类图标${icon}`}
                disabled={saving}
                variant={form.icon === icon ? 'soft' : 'plain'}
                onPress={() => setForm({ ...form, icon })}
                style={{ width: 42, paddingHorizontal: 0 }}
              >
                <Icon name={icon} color={form.color} />
              </Button>
            ))}
          </View>
          <Txt size={11} color={t.muted}>
            颜色
          </Txt>
          <View style={[styles.row, { flexWrap: 'wrap', gap: 7 }]}>
            {categoryColors.map((color) => (
              <Button
                key={color}
                label={`分类颜色${color}`}
                disabled={saving}
                onPress={() => setForm({ ...form, color })}
                style={{
                  width: 30,
                  minHeight: 30,
                  paddingHorizontal: 0,
                  backgroundColor: color,
                }}
              >
                {form.color === color ? (
                  <Icon name="check" size={17} color="#FFFFFF" />
                ) : null}
              </Button>
            ))}
          </View>
          <View style={styles.row}>
            <Button
              variant="soft"
              disabled={saving}
              onPress={() => setForm(null)}
              style={{ flex: 1 }}
            >
              取消编辑
            </Button>
            <Button
              disabled={saving}
              style={{ flex: 1 }}
              onPress={() =>
                void perform(async () => {
                  await update((current) => ({
                    ...current,
                    categories: current.categories.some(
                      (item) => item.id === form.id,
                    )
                      ? current.categories.map((item) =>
                          item.id === form.id ? form : item,
                        )
                      : [...current.categories, form],
                  }));
                  setForm(null);
                }, '分类已保存')
              }
            >
              保存分类
            </Button>
          </View>
        </View>
      )}
    </>
  );
}

export function TemplateManager({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const money = useMoney();
  const {
    ledger: data,
    update,
    saving,
    error,
    notice,
    perform,
  } = useOperation();
  const ledger = data!;
  const [form, setForm] = useState<QuickTemplate | null>(null);
  const [amount, setAmount] = useState('');
  const create = () => {
    setForm({
      id: `template-${id()}`,
      name: '',
      kind: 'expense',
      amount: 0,
      note: '',
      ...entryDefault(ledger, 'expense'),
    });
    setAmount('');
  };
  const inputStyle = {
    backgroundColor: t.surfaceAlt,
    color: t.text,
    borderRadius: 13,
    paddingHorizontal: 14,
    minHeight: 46,
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
      <Txt size={11} color={t.muted} style={{ marginVertical: 10 }}>
        常用项会预填记账面板，确认后记入账本。也可在记账时选择「同时存为常用」。
      </Txt>
      <Button variant="soft" onPress={create} disabled={saving}>
        新增常用项
      </Button>
      <ToolStatus error={error} notice={notice} testID="template-error" />
      {!form &&
        ledger.templates.map((item) => (
          <Button
            key={item.id}
            label={`编辑常用${item.name}`}
            variant="plain"
            disabled={saving}
            onPress={() => {
              setForm({ ...item });
              setAmount(amountInput(item.amount));
            }}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              padding: 15,
              backgroundColor: t.surfaceAlt,
              borderRadius: 15,
              marginTop: 10,
            }}
          >
            <View style={{ gap: 3 }}>
              <Txt size={13} weight="500">
                {item.name}
              </Txt>
              <Txt size={10} color={t.muted}>
                {categoryFor(ledger, item.categoryId).label} ·{' '}
                {
                  ledger.accounts.find(
                    (account) => account.id === item.accountId,
                  )?.name
                }
                {ledger.categories.find(
                  (category) => category.id === item.categoryId,
                )?.hidden
                  ? ' · 分类已隐藏'
                  : ''}
              </Txt>
            </View>
            <Txt size={14}>¥{money(item.amount)}</Txt>
          </Button>
        ))}
      {form && (
        <View style={{ gap: 12, marginTop: 20 }}>
          <Txt size={14} weight="500">
            {ledger.templates.some((item) => item.id === form.id)
              ? '编辑常用项'
              : '新建常用项'}
          </Txt>
          <TextInput
            accessibilityLabel="常用名称"
            placeholder="例如早餐、通勤、咖啡"
            maxLength={20}
            value={form.name}
            onChangeText={(name) => setForm({ ...form, name })}
            editable={!saving}
            style={inputStyle}
          />
          <View style={styles.row}>
            {(['expense', 'income'] as const).map((kind) => (
              <Button
                key={kind}
                disabled={saving}
                variant={form.kind === kind ? 'soft' : 'plain'}
                onPress={() =>
                  setForm({ ...form, kind, ...entryDefault(ledger, kind) })
                }
              >
                {kind === 'expense' ? '常用支出' : '常用收入'}
              </Button>
            ))}
          </View>
          <TextInput
            accessibilityLabel="常用金额"
            placeholder="金额"
            keyboardType="decimal-pad"
            inputMode="decimal"
            value={amount}
            onChangeText={setAmount}
            editable={!saving}
            style={inputStyle}
          />
          <Txt size={11} color={t.muted}>
            分类
          </Txt>
          <View style={[styles.row, { flexWrap: 'wrap', gap: 7 }]}>
            {ledger.categories
              .filter(
                (item) =>
                  item.kind === form.kind &&
                  (!item.hidden || item.id === form.categoryId),
              )
              .map((category) => (
                <Button
                  key={category.id}
                  label={`常用分类${category.label}`}
                  disabled={saving}
                  variant={form.categoryId === category.id ? 'soft' : 'plain'}
                  onPress={() => setForm({ ...form, categoryId: category.id })}
                >
                  {category.label}
                </Button>
              ))}
          </View>
          <Txt size={11} color={t.muted}>
            账户
          </Txt>
          <View style={[styles.row, { flexWrap: 'wrap', gap: 7 }]}>
            {ledger.accounts.map((account) => (
              <Button
                key={account.id}
                label={`常用账户${account.name}`}
                disabled={saving}
                variant={form.accountId === account.id ? 'soft' : 'plain'}
                onPress={() => setForm({ ...form, accountId: account.id })}
              >
                {account.name}
              </Button>
            ))}
          </View>
          <TextInput
            accessibilityLabel="常用备注"
            placeholder="备注（选填）"
            value={form.note}
            maxLength={120}
            onChangeText={(note) => setForm({ ...form, note })}
            editable={!saving}
            style={inputStyle}
          />
          <View style={styles.row}>
            <Button
              variant="soft"
              disabled={saving}
              style={{ flex: 1 }}
              onPress={() => setForm(null)}
            >
              取消编辑
            </Button>
            <Button
              disabled={saving}
              style={{ flex: 1 }}
              onPress={() =>
                void perform(async () => {
                  const next = { ...form, amount: parseAmount(amount) };
                  await update((current) => ({
                    ...current,
                    templates: current.templates.some(
                      (item) => item.id === form.id,
                    )
                      ? current.templates.map((item) =>
                          item.id === form.id ? next : item,
                        )
                      : [...current.templates, next],
                  }));
                  setForm(null);
                }, '常用项已保存')
              }
            >
              保存常用项
            </Button>
          </View>
          {ledger.templates.some((item) => item.id === form.id) && (
            <Button
              variant="plain"
              disabled={saving}
              onPress={() =>
                void perform(async () => {
                  await update((current) => ({
                    ...current,
                    templates: current.templates.filter(
                      (item) => item.id !== form.id,
                    ),
                  }));
                  setForm(null);
                }, '常用项已删除')
              }
            >
              <Txt color={t.danger} size={12}>
                删除常用项
              </Txt>
            </Button>
          )}
        </View>
      )}
    </>
  );
}
