import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePagerScrollLock } from '../components/SwipePager';
import { useTheme } from '../theme';
import {
  type Entry,
  type Ledger,
  accountBalance,
  localDate,
  money,
  monthEntries,
  totals,
} from '../domain/ledger';
import {
  Button,
  Card,
  EmptyState,
  EntryRow,
  Icon,
  MonthPicker,
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
  onAll,
  onSettings,
}: {
  today: string;
  ledger: Ledger;
  month: string;
  onMonth: (offset: number) => void;
  onAdd: () => void;
  onEntry: (entry: Entry) => void;
  onAll: () => void;
  onSettings: () => void;
}) {
  const t = useTheme();
  const { lock, unlock } = usePagerScrollLock();
  const entries = useMemo(
    () => monthEntries(ledger, month),
    [ledger.entries, month],
  );
  const { income, expense } = totals(entries);
  const budget = ledger.monthlyBudget;
  const remaining = budget - expense;
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
      <View
        style={[
          styles.row,
          { justifyContent: 'space-between', marginBottom: 20 },
        ]}
      >
        <View>
          <Txt
            color={t.muted}
            size={11}
            style={{ letterSpacing: 1.5, marginBottom: 6 }}
          >
            A LITTLE LESS, A LITTLE BETTER
          </Txt>
          <Txt size={26} weight="600" style={{ letterSpacing: -0.8 }}>
            每一笔，都是生活。
          </Txt>
        </View>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: t.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="leaf" color={t.accent} size={21} />
        </View>
      </View>
      <LinearGradient
        colors={
          t.dark
            ? ['#2B4535', '#223C2D', '#1E3226']
            : ['#E6F0E3', '#E4EDE1', '#F0F3E8']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 28,
          padding: 25,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: t.dark ? '#3D5744' : '#DDE7D9',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 180,
            height: 180,
            borderRadius: 90,
            right: -68,
            top: 45,
            borderWidth: 1,
            borderColor: t.dark ? '#49634C' : '#D4DFCD',
            transform: [{ rotate: '-25deg' }, { scaleX: 0.7 }],
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 160,
            height: 160,
            borderRadius: 80,
            right: -38,
            top: 70,
            borderWidth: 1,
            borderColor: t.dark ? '#49634C' : '#D4DFCD',
            transform: [{ rotate: '-25deg' }, { scaleX: 0.7 }],
          }}
        />
        <View
          style={[
            styles.row,
            { justifyContent: 'space-between', marginTop: -7, marginBottom: 8 },
          ]}
        >
          <Txt color={t.dark ? '#B6C9B8' : '#6B826B'} size={12}>
            本月支出
          </Txt>
          <MonthPicker month={month} onChange={onMonth} />
        </View>
        <View style={[styles.row, { gap: 7, alignItems: 'baseline' }]}>
          <Txt size={24} color={t.dark ? '#B6C9B8' : '#6B826B'} weight="400">
            ¥
          </Txt>
          <Txt
            testID="month-expense"
            size={43}
            weight="500"
            style={{ letterSpacing: -1.5, fontVariant: ['tabular-nums'] }}
          >
            {money(expense)}
          </Txt>
        </View>
        <View
          style={{
            height: 1,
            backgroundColor: t.dark ? '#405643' : '#D3DFCD',
            marginVertical: 19,
          }}
        />
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 5 }}>
            <View style={styles.row}>
              <Icon
                name="arrow-down"
                size={13}
                color={t.dark ? '#B6C9B8' : '#6B826B'}
              />
              <Txt color={t.dark ? '#B6C9B8' : '#6B826B'} size={11}>
                本月收入
              </Txt>
            </View>
            <Txt
              testID="month-income"
              size={20}
              weight="500"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {money(income)}
            </Txt>
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
                color={t.dark ? '#B6C9B8' : '#6B826B'}
              />
              <Txt color={t.dark ? '#B6C9B8' : '#6B826B'} size={11}>
                本月结余
              </Txt>
            </View>
            <Txt
              testID="month-net"
              size={20}
              weight="500"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {money(income - expense)}
            </Txt>
          </View>
        </View>
      </LinearGradient>

      <Card style={{ marginTop: 13, padding: 18, borderRadius: 20 }}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <View style={styles.row}>
            <View
              style={{
                width: 29,
                height: 29,
                backgroundColor: t.accentSoft,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="sparkles" color={t.accent} size={15} />
            </View>
            <Txt size={13} weight="500">
              月度预算
            </Txt>
          </View>
          <Button
            variant="plain"
            onPress={onSettings}
            style={{ minHeight: 30, paddingHorizontal: 0 }}
            label="设置月度预算"
          >
            <View style={styles.row}>
              <Txt
                size={11}
                color={remaining < 0 && budget > 0 ? t.expense : t.muted}
              >
                {budget
                  ? remaining < 0
                    ? `已超支 ¥${money(-remaining)}`
                    : `还可用 ¥${money(remaining)}`
                  : '给花费一点边界'}
              </Txt>
              <Icon name="right" size={12} color={t.muted} />
            </View>
          </Button>
        </View>
        <View
          style={{
            height: 5,
            borderRadius: 3,
            backgroundColor: t.surfaceAlt,
            overflow: 'hidden',
            marginTop: 12,
          }}
        >
          <View
            style={{
              height: 5,
              borderRadius: 3,
              backgroundColor: remaining < 0 ? t.expense : t.accent,
              width: `${budget ? Math.min((expense / budget) * 100, 100) : 0}%`,
            }}
          />
        </View>
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
      </Card>

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
            {ledger.accounts.map((account, i) => (
              <Button
                key={account.id}
                label={`管理${account.name}账户`}
                variant="plain"
                onPress={onSettings}
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
      <View
        style={[
          styles.row,
          { justifyContent: 'center', marginTop: 25, marginBottom: 8 },
        ]}
      >
        <Icon name="shield" size={11} color={t.subtle} />
        <Txt size={10} color={t.subtle}>
          数据保存在本机 · 记得定期备份
        </Txt>
      </View>
      <Txt
        size={10}
        color={t.subtle}
        style={{ textAlign: 'center', letterSpacing: 2 }}
      >
        {Number(today.slice(0, 4))} · 简单记录，轻盈生活
      </Txt>
    </>
  );
}
