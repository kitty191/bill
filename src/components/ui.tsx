import React, { createContext, useContext, type RefObject } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Download,
  Ellipsis,
  Gamepad2,
  Gift,
  Heart,
  House,
  Leaf,
  Moon,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  Utensils,
  Wallet,
  X,
  ShoppingBag,
  TrainFront,
  ChartNoAxesCombined,
  ListFilter,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  LockKeyhole,
  RotateCcw,
  Bell,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../theme';
import { useMoney } from '../state/PrivacyContext';
import {
  categoryFor,
  type Entry,
  type Ledger,
  localDate,
} from '../domain/ledger';

const icons: Record<string, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  train: TrainFront,
  'shopping-bag': ShoppingBag,
  house: House,
  gamepad: Gamepad2,
  heart: Heart,
  ellipsis: Ellipsis,
  briefcase: BriefcaseBusiness,
  gift: Gift,
  sparkles: Sparkles,
  plus: Plus,
  arrows: ArrowLeftRight,
  home: House,
  list: ListFilter,
  chart: ChartNoAxesCombined,
  settings: Settings2,
  wallet: Wallet,
  leaf: Leaf,
  down: ChevronDown,
  left: ChevronLeft,
  right: ChevronRight,
  close: X,
  check: Check,
  calendar: CalendarDays,
  search: Search,
  shield: ShieldCheck,
  download: Download,
  upload: Upload,
  'arrow-up': ArrowUpRight,
  'arrow-down': ArrowDownLeft,
  trend: TrendingUp,
  trash: Trash2,
  edit: Pencil,
  moon: Moon,
  eye: Eye,
  'eye-off': EyeOff,
  lock: LockKeyhole,
  refund: RotateCcw,
  bell: Bell,
};
export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 1.7,
}: {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const theme = useTheme();
  const Glyph = icons[name] ?? Ellipsis;
  return (
    <Glyph size={size} color={color ?? theme.text} strokeWidth={strokeWidth} />
  );
}

export function Txt({
  children,
  size = 14,
  color,
  weight,
  style,
  numberOfLines,
  testID,
  adjustsFontSizeToFit,
  minimumFontScale,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  weight?: TextStyle['fontWeight'];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  testID?: string;
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
}) {
  const theme = useTheme();
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      minimumFontScale={minimumFontScale}
      style={[
        {
          fontSize: size,
          color: color ?? theme.text,
          fontWeight: weight,
          lineHeight: size * 1.5,
          fontFamily:
            Platform.OS === 'web'
              ? '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
              : undefined,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Button({
  children,
  onPress,
  label,
  variant = 'primary',
  disabled,
  style,
  testID,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label?: string;
  variant?: 'primary' | 'soft' | 'plain' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const t = useTheme();
  const bg = {
    primary: t.dark ? '#A0CCAD' : '#345B48',
    soft: t.accentSoft,
    plain: 'transparent',
    danger: t.dark ? '#4E2A2A' : '#F9EDEC',
  }[variant];
  const fg =
    variant === 'primary'
      ? t.dark
        ? '#193423'
        : '#FFFFFF'
      : variant === 'danger'
        ? t.danger
        : t.accent;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        label ?? (typeof children === 'string' ? children : undefined)
      }
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Txt weight="600" color={fg}>
          {children}
        </Txt>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  label,
  onPress,
  style,
  disabled = false,
}: {
  name: string;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={5}
      style={({ pressed }) => [
        {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed || disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Icon name={name} size={19} />
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderRadius: 24,
          padding: 22,
          borderWidth: 1,
          borderColor: t.dark ? t.border : 'rgba(255,255,255,0.9)',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const BlurTargetContext = createContext<
  RefObject<React.ComponentRef<typeof View> | null> | undefined
>(undefined);

export function Glass({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const blurTarget = useContext(BlurTargetContext);
  return (
    <View
      style={[
        {
          overflow: 'hidden',
          borderRadius: 30,
          borderWidth: 1,
          borderColor: t.dark
            ? 'rgba(255,255,255,0.12)'
            : 'rgba(255,255,255,0.94)',
          backgroundColor: t.glass,
          boxShadow: '0 8px 28px rgba(25, 52, 36, 0.08)',
        },
        style,
      ]}
    >
      {Platform.OS === 'android' ? (
        <LinearGradient
          pointerEvents="none"
          colors={
            t.dark
              ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']
              : ['rgba(255,255,255,0.48)', 'rgba(255,255,255,0.12)']
          }
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <BlurView
          pointerEvents="none"
          intensity={40}
          tint={t.dark ? 'dark' : 'light'}
          blurTarget={blurTarget}
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </View>
  );
}

export function SectionTitle({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.row,
        { justifyContent: 'space-between', marginTop: 26, marginBottom: 14 },
      ]}
    >
      <Txt size={17} weight="600">
        {title}
      </Txt>
      {action && onPress && (
        <Button
          variant="plain"
          onPress={onPress}
          style={{ minHeight: 32, paddingHorizontal: 0 }}
        >
          <View style={styles.row}>
            <Txt size={12} color={t.muted}>
              {action}
            </Txt>
            <Icon name="right" size={13} color={t.muted} />
          </View>
        </Button>
      )}
    </View>
  );
}

export function MonthPicker({
  month,
  onChange,
  labelPrefix = '',
  disabled = false,
}: {
  month: string;
  onChange: (offset: number) => void;
  labelPrefix?: string;
  disabled?: boolean;
}) {
  const t = useTheme();
  const [year, m] = month.split('-');
  return (
    <View style={[styles.row, { gap: 4 }]}>
      <Button
        variant="plain"
        label={`${labelPrefix}上个月`}
        disabled={disabled || month === '1900-01'}
        onPress={() => onChange(-1)}
        style={{ width: 36, paddingHorizontal: 0 }}
      >
        <Icon name="left" size={17} color={t.muted} />
      </Button>
      <Txt size={13} weight="500" style={{ fontVariant: ['tabular-nums'] }}>
        {year} 年 {Number(m)} 月
      </Txt>
      <Button
        variant="plain"
        label={`${labelPrefix}下个月`}
        disabled={disabled || month === '2200-12'}
        onPress={() => onChange(1)}
        style={{ width: 36, paddingHorizontal: 0 }}
      >
        <Icon name="right" size={17} color={t.muted} />
      </Button>
    </View>
  );
}

export function EntryRow({
  entry,
  ledger,
  onPress,
  last = false,
}: {
  entry: Entry;
  ledger: Ledger;
  onPress: () => void;
  last?: boolean;
}) {
  const t = useTheme();
  const money = useMoney();
  const category = categoryFor(ledger, entry.categoryId);
  const account =
    ledger.accounts.find((a) => a.id === entry.accountId)?.name ?? '';
  const destination =
    ledger.accounts.find((a) => a.id === entry.toAccountId)?.name ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.date} ${entry.note || category.label} ${entry.kind === 'income' ? '收入' : entry.kind === 'expense' ? '支出' : entry.kind === 'refund' ? '退款' : '转账'} ${money(entry.amount)} 元，查看详情`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          paddingVertical: 16,
          gap: 13,
          opacity: pressed ? 0.6 : 1,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderColor: t.border,
        },
      ]}
    >
      <View
        style={{
          width: 43,
          height: 43,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${category.color}${t.dark ? '24' : '15'}`,
        }}
      >
        <Icon
          name={entry.kind === 'refund' ? 'refund' : category.icon}
          color={category.color}
          size={20}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={14} weight="500" numberOfLines={1}>
          {entry.note || category.label}
        </Txt>
        <Txt size={11} color={t.muted} numberOfLines={1}>
          {entry.kind === 'refund' ? '退款 · ' : ''}
          {category.label} · {account}
          {entry.kind === 'transfer' ? ` → ${destination}` : ''}
        </Txt>
      </View>
      <Txt
        size={16}
        weight="500"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        color={
          entry.kind === 'income' || entry.kind === 'refund' ? t.income : t.text
        }
        style={{ fontVariant: ['tabular-nums'], flexShrink: 1 }}
      >
        {entry.kind === 'income' || entry.kind === 'refund'
          ? '+'
          : entry.kind === 'expense'
            ? '−'
            : ''}
        {money(entry.amount)}
      </Txt>
    </Pressable>
  );
}

export function EmptyState({
  title,
  description,
  action,
  onAction,
  compact = false,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: compact ? 25 : 42,
        paddingHorizontal: 15,
        gap: 11,
      }}
    >
      <View
        style={{
          width: 62,
          height: 62,
          borderRadius: 24,
          backgroundColor: t.accentSoft,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 5,
        }}
      >
        <Icon name="leaf" size={28} color={t.accent} />
      </View>
      <Txt size={16} weight="500">
        {title}
      </Txt>
      <Txt
        size={12}
        color={t.muted}
        style={{ textAlign: 'center', maxWidth: 260 }}
      >
        {description}
      </Txt>
      {action && onAction && (
        <Button variant="soft" onPress={onAction} style={{ marginTop: 7 }}>
          {action}
        </Button>
      )}
    </View>
  );
}

export function dateHeading(date: string, today = localDate()): string {
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  return date === today
    ? '今天'
    : date === localDate(yesterday)
      ? '昨天'
      : `${Number(date.slice(5, 7))} 月 ${Number(date.slice(8))} 日`;
}
export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: {
    minHeight: 44,
    borderRadius: 15,
    paddingHorizontal: 17,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
