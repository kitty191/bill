import { MonthPageHeader } from '../components/MonthPicker';
import { CategoryBudgets } from '../components/CategoryBudgets';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { usePagerScrollLock } from '../components/SwipePager';
import { useTheme } from '../theme';
import { useMoney, usePrivacy } from '../state/PrivacyContext';
import { backupReminderDue } from '../domain/privacy';
import { dueRecurring } from '../domain/recurring';
import {
  type Entry,
  type Ledger,
  accountBalance,
  activeAccounts,
  budgetForMonth,
  budgetPace,
  localDate,
  monthEntries,
  totals,
} from '../domain/ledger';
import {
  Button,
  Card,
  EmptyState,
  EntryRow,
  Icon,
  MoneyText,
  SectionTitle,
  Txt,
  styles,
} from '../components/ui';

export function HomeScreen({
  today,
  ledger,
  month,
  onMonth,
  onAdd,
  onEntry,
  onEntryActions,
  onAll,
  onToday,
  onSettings,
  onAccountDetails,
  onTemplate,
  onBackup,
  onRecurring,
  onRecurringSettings,
}: {
  today: string;
  ledger: Ledger;
  month: string;
  onMonth: (offset: number) => void;
  onAdd: () => void;
  onEntry: (entry: Entry) => void;
  onEntryActions: (entry: Entry) => void;
  onAll: () => void;
  onToday: () => void;
  onSettings: () => void;
  onAccountDetails: (accountId: string) => void;
  onTemplate: (id: string) => void;
  onBackup: () => void;
  onRecurring: (id: string, date: string) => void;
  onRecurringSettings: () => void;
}) {
  const t = useTheme();
  const money = useMoney();
  const privacy = usePrivacy();
  const due = useMemo(
    () => dueRecurring(ledger, today),
    [ledger.recurringBills, ledger.recurringEnabled, today],
  );
  const [reminderError, setReminderError] = useState('');
  const templates = ledger.templates.filter(
    (item) =>
      !ledger.categories.find((category) => category.id === item.categoryId)
        ?.hidden,
  );
  const { lock, unlock } = usePagerScrollLock();
  const entries = useMemo(
    () => monthEntries(ledger, month),
    [ledger.entries, month],
  );
  const { income, expense } = useMemo(
    () => totals(entries, ledger.entries),
    [entries, ledger.entries],
  );
  const todayExpense = useMemo(
    () =>
      totals(
        ledger.entries.filter((entry) => entry.date === today),
        ledger.entries,
      ).expense,
    [ledger.entries, today],
  );
  const budget = budgetForMonth(ledger, month);
  const remaining = budget - expense;
  const pace =
    budget > 0 && month === today.slice(0, 7)
      ? budgetPace(budget, expense, today)
      : null;
  const totalAssets = useMemo(
    () =>
      ledger.showAccountCards
        ? ledger.accounts.reduce(
            (sum, a) => sum + accountBalance(ledger, a.id),
            0,
          )
        : 0,
    [ledger.accounts, ledger.entries, ledger.showAccountCards],
  );
  return (
    <>
      <MonthPageHeader title="首页" month={month} onChange={onMonth} />
      <Card style={{ backgroundColor: t.accentSoft, padding: 20, borderRadius: 22 }}>
        <Txt color={t.text} size={14} weight="500">本月支出</Txt>
        <View style={[styles.row, { gap: 7, alignItems: 'baseline' }]}>
          <Txt size={24} color={t.muted} weight="400">
            ¥
          </Txt>
          <MoneyText
            amount={expense}
            testID="month-expense"
            size={46}
            style={{ flexShrink: 1 }}
          />
        </View>
        <Button
          variant="plain"
          onPress={onToday}
          label={`查看今日支出明细，${money(todayExpense)} 元`}
          style={{
            marginTop: 3,
            minHeight: 44,
            paddingVertical: 5,
            paddingHorizontal: 0,
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            gap: 9,
          }}
        >
          <Txt size={12} color={t.muted}>
            今日支出
          </Txt>
          <MoneyText
            amount={todayExpense}
            currency
            testID="today-expense"
            size={18}
          />
          <Icon name="right" size={13} color={t.muted} />
        </Button>
        <View
          style={{
            height: 1,
            backgroundColor: t.dark ? '#405643' : '#D3DFCD',
            marginVertical: 12,
          }}
        />
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 5 }}>
            <View style={styles.row}>
              <Icon
                name="arrow-down"
                size={13}
                color={t.muted}
              />
              <Txt color={t.muted} size={11}>
                本月收入
              </Txt>
            </View>
            <MoneyText amount={income} testID="month-income" size={20} />
          </View>
          <View
            style={{
              width: 1,
              height: 32,
              backgroundColor: t.dark ? '#405643' : '#D3DFCD',
              marginRight: 20,
            }}
          />
          <View style={{ flex: 1, gap: 5 }}>
            <View style={styles.row}>
              <Icon
                name="wallet"
                size={13}
                color={t.muted}
              />
              <Txt color={t.muted} size={11}>
                本月结余
              </Txt>
            </View>
            <MoneyText amount={income - expense} testID="month-net" size={20} />
          </View>
        </View>
      </Card>

      <Card style={{ marginTop: 13, padding: 18, borderRadius: 20 }}>
        <Button variant="plain" onPress={onSettings} label="设置月度预算"
          style={{ paddingHorizontal: 0, alignItems: 'stretch', gap: 6 }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Txt size={13} color={t.muted}>月度预算</Txt>
            <Icon name="right" size={15} color={t.muted} />
          </View>
          {budget ? (
            <View style={[styles.row, { flexWrap: 'wrap', alignItems: 'baseline' }]}>
              <Txt size={15}>{remaining < 0 ? '已超支' : '本月还可用'}</Txt>
              <MoneyText amount={Math.abs(remaining)} currency size={25}
                color={remaining < 0 ? t.danger : t.text} style={{ flexShrink: 1 }} />
            </View>
          ) : <Txt size={16} color={t.accent}>设置本月额度</Txt>}
        </Button>
        {budget > 0 && (
          <View style={{ height: 5, borderRadius: 3, backgroundColor: t.surfaceAlt, marginTop: 8 }}>
            <View style={{ height: 5, borderRadius: 3, backgroundColor: remaining < 0 ? t.danger : t.accent,
              width: `${Math.min(expense / budget * 100, 100)}%` }} />
          </View>
        )}
        {budget > 0 && (
          <View
            style={[
              styles.row,
              { justifyContent: 'space-between', marginTop: 7 },
            ]}
          >
            <Txt size={10} color={t.muted}>
              已用 {Math.round((expense / budget) * 100)}%
            </Txt>
            <Txt size={10} color={t.muted}>
              预算 ¥{money(budget, false)}
            </Txt>
          </View>
        )}
        {pace && (
          <View style={{ marginTop: 9, gap: 3 }}>
            <Txt size={11} color={t.muted} testID="budget-daily-allowance">
              本月还剩 {pace.daysLeft} 天（含今天） · 日均可用 ¥
              {money(pace.dailyAllowance)}
            </Txt>
            {pace.overPace && remaining >= 0 && (
              <Txt size={11} color={t.expense}>
                预算用量已超过本月进度
              </Txt>
            )}
          </View>
        )}
      </Card>

      <SectionTitle title="最近账单" action="查看全部" onPress={onAll} />
      <Card style={{ paddingVertical: 0, paddingHorizontal: 18 }}>
        {entries.length ? (
          entries
            .slice(0, 4)
            .map((entry, i, list) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                ledger={ledger}
                onPress={() => onEntry(entry)}
                onLongPress={() => onEntryActions(entry)}
                last={i === list.length - 1}
              />
            ))
        ) : (
          <EmptyState
            compact
            title="生活的记录，从这里开始"
            description={
              month === localDate().slice(0, 7)
                ? '一杯咖啡、一顿晚餐。让每一笔花费都有迹可循。'
                : '这个月还没有账单，试试切换月份。'
            }
            action="记下第一笔"
            onAction={onAdd}
          />
        )}
      </Card>

      <CategoryBudgets ledger={ledger} entries={entries} />
      {due.length > 0 && (
        <Card style={{ marginTop: 16, padding: 17, gap: 10 }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Txt size={13} weight="500">
              周期账单待确认 · {due.length}
            </Txt>
            <Button
              variant="plain"
              label="管理周期账单"
              onPress={onRecurringSettings}
              style={{ minHeight: 32, paddingHorizontal: 4 }}
            >
              管理
            </Button>
          </View>
          {due.slice(0, 3).map((bill) => (
            <Button
              key={bill.id}
              label={`确认周期账单${bill.name}`}
              variant="plain"
              onPress={() => onRecurring(bill.id, bill.nextDate)}
              style={{ alignItems: 'stretch', paddingHorizontal: 0 }}
            >
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Txt size={13} weight="500" style={{ flex: 1 }}>
                  {bill.name}
                </Txt>
                <Txt size={14}>¥{money(bill.amount)}</Txt>
                <Icon name="right" size={13} color={t.muted} />
              </View>
              <Txt size={10} color={t.muted}>
                到期 {bill.nextDate} · 点击确认本期
              </Txt>
            </Button>
          ))}
          <Txt size={10} color={t.muted}>
            确认后才写入账本，未发生的消费可在管理中跳过。
          </Txt>
        </Card>
      )}
      {ledger.showAccountCards && (
        <>
          <SectionTitle
            title="我的账户"
            action={`总资产 ¥${money(totalAssets)}`}
            onPress={onSettings}
          />
          <ScrollView
            testID="account-carousel"
            horizontal
            nestedScrollEnabled
            onTouchStart={lock}
            onTouchEnd={unlock}
            onTouchCancel={unlock}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 3 }}
          >
            {activeAccounts(ledger).map((account, i) => (
              <Button
                key={account.id}
                label={`查看${account.name}账户明细`}
                variant="plain"
                onPress={() => onAccountDetails(account.id)}
                style={{
                  backgroundColor: t.surface,
                  borderRadius: 19,
                  alignItems: 'flex-start',
                  padding: 16,
                  minWidth: 128,
                  gap: 9,
                }}
              >
                <View style={styles.row}>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: [
                        '#80A28C',
                        '#7FA0BB',
                        '#B3A586',
                        '#A697BB',
                      ][i % 4],
                    }}
                  />
                  <Txt size={11} color={t.muted}>
                    {account.name}
                  </Txt>
                </View>
                <Txt
                  size={17}
                  weight="500"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {money(accountBalance(ledger, account.id))}
                </Txt>
              </Button>
            ))}
          </ScrollView>
        </>
      )}

      {ledger.entries.length > 0 &&
        backupReminderDue(privacy.preferences, privacy.now) && (
          <Card style={{ marginTop: 20, gap: 10 }}>
            <View style={styles.row}>
              <Icon name="bell" color={t.accent} />
              <Txt size={13} weight="500">
                该导出一份备份了
              </Txt>
            </View>
            <Txt size={11} color={t.muted}>
              定期保存 JSON 文件，换手机时也能恢复完整账本。
            </Txt>
            <View style={styles.row}>
              <Button variant="soft" onPress={onBackup}>
                去备份
              </Button>
              <Button
                variant="plain"
                disabled={privacy.saving}
                onPress={() => {
                  void privacy
                    .snoozeReminder()
                    .catch((error) =>
                      setReminderError(
                        error instanceof Error
                          ? error.message
                          : '提醒设置保存失败',
                      ),
                    );
                }}
              >
                明天提醒
              </Button>
            </View>
            {!!reminderError && (
              <Txt size={11} color={t.danger}>
                {reminderError}
              </Txt>
            )}
          </Card>
        )}
      {templates.length > 0 && (
        <>
          <SectionTitle title="常用记账" action="管理" onPress={onSettings} />
          <ScrollView
            horizontal
            nestedScrollEnabled
            onTouchStart={lock}
            onTouchEnd={unlock}
            onTouchCancel={unlock}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {templates.map((item) => (
              <Button
                key={item.id}
                variant="soft"
                label={`常用记账${item.name}`}
                onPress={() => onTemplate(item.id)}
                style={{ gap: 4, alignItems: 'flex-start' }}
              >
                <Txt size={12} weight="500">
                  {item.name}
                </Txt>
                <Txt size={11} color={t.muted}>
                  ¥{money(item.amount)}
                </Txt>
              </Button>
            ))}
          </ScrollView>
        </>
      )}
    </>
  );
}
