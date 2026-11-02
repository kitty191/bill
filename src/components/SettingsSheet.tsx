import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useLedger } from '../state/LedgerProvider';
import {
  type Account,
  type Ledger,
  accountBalance,
  amountInput,
  demoLedger,
  emptyLedger,
  id,
  money,
  parseAmount,
  validateLedger,
} from '../domain/ledger';
import { exportLedger, importLedger } from '../storage/backup';
import { useTheme } from '../theme';
import { Sheet } from './Sheet';
import { Button, Icon, SectionTitle, Txt, styles } from './ui';

export function SettingsSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const t = useTheme();
  const { ledger: data, update, saving } = useLedger();
  const ledger = data!;
  const [budget, setBudget] = useState(
    ledger.monthlyBudget ? amountInput(ledger.monthlyBudget) : '',
  );
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [accountName, setAccountName] = useState('');
  const [opening, setOpening] = useState('');
  const [confirmation, setConfirmation] = useState<
    'clear' | 'demo' | 'import' | null
  >(null);
  const [imported, setImported] = useState<Ledger | null>(null);
  const disabled = saving || busy;
  const inputStyle = {
    fontSize: 14,
    color: t.text,
    backgroundColor: t.surfaceAlt,
    borderRadius: 13,
    paddingHorizontal: 13,
    minHeight: 46,
    flex: 1,
  };
  const perform = async (fn: () => Promise<void>, message?: string) => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await fn();
      if (message) {
        setNotice(message);
        onSaved(message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败，请重试');
    } finally {
      setBusy(false);
    }
  };
  const editAccount = (a?: Account) => {
    setAccount(a ?? { id: id(), name: '', openingBalance: 0 });
    setAccountName(a?.name ?? '');
    setOpening(a ? amountInput(a.openingBalance) : '0.00');
    setError('');
  };
  const saveAccount = async () => {
    if (!account) return;
    if (!accountName.trim()) throw new Error('请填写账户名称');
    const signed = opening.trim().startsWith('-');
    const openingBalance =
      parseAmount(signed ? opening.trim().slice(1) : opening, true) *
      (signed ? -1 : 1);
    const nextAccount = {
      ...account,
      name: accountName.trim(),
      openingBalance,
    };
    await update((current) =>
      validateLedger({
        ...current,
        accounts: current.accounts.some((a) => a.id === account.id)
          ? current.accounts.map((a) => (a.id === account.id ? nextAccount : a))
          : [...current.accounts, nextAccount],
      }),
    );
    setAccount(null);
  };
  const confirm = async () => {
    if (confirmation === 'import' && !imported) return;
    const next =
      confirmation === 'clear'
        ? emptyLedger()
        : confirmation === 'demo'
          ? demoLedger()
          : imported!;
    await update(() => next);
    setBudget(next.monthlyBudget ? amountInput(next.monthlyBudget) : '');
    setConfirmation(null);
    setImported(null);
    setAccount(null);
  };
  return (
    <Sheet visible onClose={onClose} title="我的清账" dismissible={!disabled}>
      <View
        style={[
          styles.row,
          {
            backgroundColor: t.accentSoft,
            borderRadius: 18,
            padding: 16,
            gap: 12,
          },
        ]}
      >
        <Icon name="shield" size={25} color={t.accent} />
        <View style={{ flex: 1 }}>
          <Txt size={13} weight="500">
            你的生活，由你保管
          </Txt>
          <Txt size={11} color={t.muted} style={{ marginTop: 3 }}>
            无需注册 · 离线可用 · 数据保存在本机
          </Txt>
        </View>
      </View>
      {!!notice && (
        <View accessibilityLiveRegion="polite" style={{ marginTop: 12 }}>
          <Txt size={12} color={t.accent}>
            {notice}
          </Txt>
        </View>
      )}
      {!!error && (
        <View accessibilityLiveRegion="polite" style={{ marginTop: 12 }}>
          <Txt testID="settings-error" size={12} color={t.danger}>
            {error}
          </Txt>
        </View>
      )}
      <SectionTitle title="月度预算" />
      <View style={styles.row}>
        <TextInput
          accessibilityLabel="月度预算金额"
          placeholder="输入每月预算"
          placeholderTextColor={t.subtle}
          keyboardType="decimal-pad"
          inputMode="decimal"
          value={budget}
          onChangeText={setBudget}
          editable={!disabled}
          style={inputStyle}
        />
        <Button
          disabled={disabled}
          onPress={() =>
            void perform(async () => {
              const value = budget.trim() ? parseAmount(budget, true) : 0;
              await update((current) => ({ ...current, monthlyBudget: value }));
            }, '预算已更新')
          }
        >
          保存预算
        </Button>
      </View>
      <Txt size={10} color={t.muted} style={{ marginTop: 8 }}>
        所有月份共用此预算；留空或设为 0 可关闭。
      </Txt>
      <SectionTitle
        title="账户管理"
        action="添加账户"
        onPress={() => editAccount()}
      />
      <View
        style={{
          borderRadius: 18,
          backgroundColor: t.surfaceAlt,
          paddingHorizontal: 15,
        }}
      >
        {ledger.accounts.map((a, i) => (
          <View
            key={a.id}
            style={[
              styles.row,
              {
                paddingVertical: 11,
                justifyContent: 'space-between',
                borderBottomWidth: i === ledger.accounts.length - 1 ? 0 : 1,
                borderColor: t.border,
              },
            ]}
          >
            <View style={{ gap: 2 }}>
              <Txt size={13}>{a.name}</Txt>
              <Txt size={10} color={t.muted}>
                余额 ¥{money(accountBalance(ledger, a.id))}
              </Txt>
            </View>
            <Button
              disabled={disabled}
              variant="plain"
              label={`编辑账户${a.name}`}
              onPress={() => editAccount(a)}
              style={{ minHeight: 36, paddingHorizontal: 8 }}
            >
              <Icon name="edit" size={16} color={t.muted} />
            </Button>
          </View>
        ))}
      </View>
      {account && (
        <View style={{ gap: 10, paddingTop: 15 }}>
          <Txt size={13} weight="500">
            {ledger.accounts.some((a) => a.id === account.id)
              ? '编辑账户'
              : '添加账户'}
          </Txt>
          <TextInput
            accessibilityLabel="账户名称"
            placeholder="账户名称"
            placeholderTextColor={t.subtle}
            maxLength={20}
            value={accountName}
            onChangeText={setAccountName}
            style={[inputStyle, { flex: undefined }]}
          />
          <TextInput
            accessibilityLabel="初始余额"
            placeholder="初始余额，可输入负数"
            placeholderTextColor={t.subtle}
            keyboardType="numbers-and-punctuation"
            value={opening}
            onChangeText={setOpening}
            style={[inputStyle, { flex: undefined }]}
          />
          <Txt size={10} color={t.muted}>
            当前余额 = 初始余额 + 所有账单变动。修改初始余额不计入收支。
          </Txt>
          <View style={styles.row}>
            <Button
              variant="soft"
              disabled={disabled}
              onPress={() => setAccount(null)}
              style={{ flex: 1 }}
            >
              取消编辑
            </Button>
            <Button
              disabled={disabled}
              onPress={() => void perform(saveAccount, '账户已保存')}
              style={{ flex: 1 }}
            >
              保存账户
            </Button>
          </View>
        </View>
      )}
      <SectionTitle title="数据与备份" />
      <View style={{ gap: 9 }}>
        <SettingAction
          icon="download"
          title="备份账本"
          description="导出完整 JSON 文件，可用于恢复"
          disabled={disabled}
          onPress={() =>
            void perform(
              () => exportLedger(ledger, 'json'),
              '备份已导出，请妥善保存',
            )
          }
        />
        <SettingAction
          icon="upload"
          title="恢复备份"
          description="选择 JSON 备份，确认后替换当前账本"
          disabled={disabled}
          onPress={() =>
            void perform(async () => {
              const result = await importLedger();
              if (result) {
                setImported(result);
                setConfirmation('import');
              }
            })
          }
        />
        <SettingAction
          icon="list"
          title="导出表格"
          description="将全部账单导出为 CSV 文件"
          disabled={disabled}
          onPress={() =>
            void perform(() => exportLedger(ledger, 'csv'), '账单表格已导出')
          }
        />
      </View>
      <Txt size={10} color={t.muted} style={{ marginTop: 11 }}>
        本地数据不会自动同步。卸载应用或清除浏览器数据可能导致账本丢失，请定期备份。备份文件包含财务记录，请妥善保管。
      </Txt>
      {!ledger.entries.length && (
        <Button
          variant="soft"
          disabled={disabled}
          onPress={() => setConfirmation('demo')}
          style={{ marginTop: 20 }}
        >
          载入示例账本，看看效果
        </Button>
      )}
      <Button
        variant="plain"
        disabled={disabled}
        onPress={() => setConfirmation('clear')}
        style={{ marginTop: 10 }}
      >
        <Txt size={12} color={t.danger}>
          清空本地账本
        </Txt>
      </Button>
      {!!confirmation && (
        <View
          style={{
            padding: 17,
            borderWidth: 1,
            borderColor: t.border,
            borderRadius: 18,
            gap: 12,
            marginTop: 12,
          }}
        >
          <Txt size={14} weight="600">
            {confirmation === 'clear'
              ? '确定清空账本？'
              : confirmation === 'demo'
                ? '载入示例账本？'
                : '确定恢复此备份？'}
          </Txt>
          <Txt size={12} color={t.muted}>
            {confirmation === 'clear'
              ? '全部账单、账户与预算将重置。此操作无法撤销，建议先备份。'
              : confirmation === 'demo'
                ? '示例将替换当前账户和预算，添加 9 条演示记录。你可以随时清空后开始自己的记录。'
                : `备份包含 ${imported?.entries.length} 笔账单、${imported?.accounts.length} 个账户。当前数据将被替换，此操作无法撤销，建议先备份。`}
          </Txt>
          <View style={styles.row}>
            <Button
              disabled={disabled}
              variant="soft"
              onPress={() => {
                setConfirmation(null);
                setImported(null);
              }}
              style={{ flex: 1 }}
            >
              取消
            </Button>
            <Button
              disabled={disabled}
              variant={confirmation === 'clear' ? 'danger' : 'primary'}
              onPress={() => void perform(confirm, '账本已更新')}
              style={{ flex: 1 }}
            >
              {confirmation === 'clear'
                ? '确认清空'
                : confirmation === 'demo'
                  ? '确认载入示例'
                  : '确认恢复备份'}
            </Button>
          </View>
        </View>
      )}
      <View
        style={{ alignItems: 'center', marginTop: 28, marginBottom: 6, gap: 4 }}
      >
        <Icon name="leaf" size={20} color={t.accent} />
        <Txt size={13} weight="500">
          清账
        </Txt>
        <Txt size={10} color={t.subtle}>
          简单记录，轻盈生活 · v0.1.0
        </Txt>
        <Txt size={10} color={t.subtle}>
          浅色与深色外观跟随系统
        </Txt>
      </View>
    </Sheet>
  );
}

function SettingAction({
  icon,
  title,
  description,
  onPress,
  disabled,
}: {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const t = useTheme();
  return (
    <Button
      variant="plain"
      label={title}
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: t.surfaceAlt,
        flexDirection: 'row',
        padding: 14,
        gap: 12,
        justifyContent: 'flex-start',
        borderRadius: 17,
      }}
    >
      <Icon name={icon} color={t.accent} size={19} />
      <View style={{ flex: 1 }}>
        <Txt size={13} weight="500">
          {title}
        </Txt>
        <Txt size={10} color={t.muted} style={{ marginTop: 3 }}>
          {description}
        </Txt>
      </View>
      <Icon name="right" size={15} color={t.muted} />
    </Button>
  );
}
