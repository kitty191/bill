import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type TextProps,
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
  Copy,
  Eye,
  EyeOff,
  LockKeyhole,
  RotateCcw,
  Bell,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../theme';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { feedback, motion } from '../motion';
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
  copy: Copy,
};
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
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
  onLayout,
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
  onLayout?: TextProps['onLayout'];
}) {
  const theme = useTheme();
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      minimumFontScale={minimumFontScale}
      onLayout={onLayout}
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
  hitSlop,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label?: string;
  variant?: 'primary' | 'soft' | 'plain' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  hitSlop?: number;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const pressed = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0.45 : 1 - pressed.value * 0.16,
    transform: [{ scale: reduce ? 1 : 1 - pressed.value * 0.025 }],
  }));
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
    <AnimatedPressable
      testID={testID}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={
        label ?? (typeof children === 'string' ? children : undefined)
      }
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = reduce ? 1 : withTiming(1, { duration: motion.press });
      }}
      onPressOut={() => {
        pressed.value = reduce ? 0 : withSpring(0, motion.spring);
      }}
      style={[styles.button, { backgroundColor: bg }, style, pressStyle]}
    >
      {typeof children === 'string' ? (
        <Txt weight="600" color={fg}>
          {children}
        </Txt>
      ) : (
        children
      )}
    </AnimatedPressable>
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
    <Button
      variant="plain"
      label={label}
      hitSlop={5}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          width: 44,
          height: 44,
          minHeight: 0,
          borderRadius: 22,
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.border,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 0,
          paddingVertical: 0,
        },
        style,
        { minWidth: 44, minHeight: 44 },
      ]}
    >
      <Icon name={name} size={19} />
    </Button>
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
          borderColor: t.dark ? t.border : '#E8EDE5',
          boxShadow: t.dark ? 'none' : '0 3px 14px rgba(40,66,45,0.025)',
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
  variant = 'dock',
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'dock' | 'sheet';
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
          borderColor: t.glassEdge,
          backgroundColor: variant === 'sheet' ? t.sheet : t.glass,
          boxShadow: `0 8px 28px ${t.shadow}`,
        },
        style,
      ]}
    >
      {Platform.OS !== 'android' && !t.reduceTransparency && (
        <BlurView
          pointerEvents="none"
          intensity={variant === 'sheet' ? 34 : 48}
          tint={t.dark ? 'dark' : 'light'}
          blurTarget={blurTarget}
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
      )}
      {!t.reduceTransparency && (
        <LinearGradient
          pointerEvents="none"
          colors={[t.glassHighlight, 'rgba(255,255,255,0)', t.glassShade]}
          locations={[0, 0.48, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 20,
          right: 20,
          height: 1,
          backgroundColor: t.glassHighlight,
        }}
      />
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
    <View style={[styles.row, { gap: 4, flexShrink: 1, minWidth: 0 }]}>
      <Button
        variant="plain"
        label={`${labelPrefix}上个月`}
        disabled={disabled || month === '1900-01'}
        onPress={() => onChange(-1)}
        style={{ width: 44, paddingHorizontal: 0 }}
      >
        <Icon name="left" size={17} color={t.muted} />
      </Button>
      <Txt
        size={13}
        weight="500"
        style={{
          fontVariant: ['tabular-nums'],
          flexShrink: 1,
          textAlign: 'center',
        }}
      >
        {year} 年 {Number(m)} 月
      </Txt>
      <Button
        variant="plain"
        label={`${labelPrefix}下个月`}
        disabled={disabled || month === '2200-12'}
        onPress={() => onChange(1)}
        style={{ width: 44, paddingHorizontal: 0 }}
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
  onLongPress,
}: {
  entry: Entry;
  ledger: Ledger;
  onPress: () => void;
  last?: boolean;
  onLongPress?: () => void;
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
      onLongPress={
        onLongPress
          ? () => {
              feedback('light');
              onLongPress();
            }
          : undefined
      }
      delayLongPress={420}
      accessibilityHint={
        onLongPress ? '长按打开快捷操作，也可进入详情再记一笔' : undefined
      }
      accessibilityActions={
        onLongPress ? [{ name: 'longpress', label: '账单快捷操作' }] : undefined
      }
      onAccessibilityAction={onLongPress ? () => onLongPress() : undefined}
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
      <MoneyText
        amount={entry.amount}
        prefix={
          entry.kind === 'income' || entry.kind === 'refund'
            ? '+'
            : entry.kind === 'expense'
              ? '−'
              : ''
        }
        size={16}
        color={
          entry.kind === 'income' || entry.kind === 'refund' ? t.income : t.text
        }
        style={{ flexShrink: 1 }}
      />
    </Pressable>
  );
}

export function MoneyText({
  amount,
  size = 22,
  currency = false,
  prefix = '',
  color,
  style,
  testID,
}: {
  amount: number;
  size?: number;
  currency?: boolean;
  prefix?: string;
  color?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const t = useTheme();
  const money = useMoney();
  const formatted = money(amount);
  const [whole = '', fraction] = formatted.split('.');
  const { width, fontScale } = useWindowDimensions();
  const profile = `${width}:${fontScale}:${size}:${currency}:${prefix}:${formatted}`;
  const [layout, setLayout] = useState<{
    profile: string;
    width: number;
    naturalWidth: number;
  } | null>(null);
  const currentProfile = useRef(profile);
  useLayoutEffect(() => {
    currentProfile.current = profile;
  }, [profile]);
  const measured = layout?.profile === profile ? layout : null;
  const available = measured?.width ?? 0;
  // RN Web ignores adjustsFontSizeToFit. Scale from the original glyph width,
  // rather than repeatedly scaling a previous fitted size after layout events.
  const fitted =
    Platform.OS === 'web' && measured
      ? Math.max(
          Math.min(6, size),
          Math.min(size, (size * (measured.width - 1)) / measured.naturalWidth),
        )
      : size;
  return (
    <Txt
      key={Platform.OS === 'web' ? profile : undefined}
      testID={testID}
      size={fitted}
      weight="500"
      color={color}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.4}
      onLayout={
        Platform.OS === 'web'
          ? (event) => {
              const node = (
                event.nativeEvent as typeof event.nativeEvent & {
                  target?: HTMLElement;
                }
              ).target;
              if (currentProfile.current !== profile || !node?.isConnected)
                return;
              const measuredWidth = Math.min(
                event.nativeEvent.layout.width,
                node.getBoundingClientRect().width,
              );
              if (measuredWidth <= 0) return;
              const walker = node.ownerDocument.createTreeWalker(
                node,
                NodeFilter.SHOW_TEXT,
              );
              let contentWidth = 0;
              while (walker.nextNode()) {
                const range = node.ownerDocument.createRange();
                range.selectNodeContents(walker.currentNode);
                contentWidth += range.getBoundingClientRect().width;
              }
              const computed =
                node.ownerDocument.defaultView!.getComputedStyle(node);
              const actualFont = Number.parseFloat(computed.fontSize) || size;
              const spacing =
                (Number.parseFloat(computed.letterSpacing) || 0) *
                (node.textContent?.length ?? 0);
              const naturalWidth = Math.max(
                1,
                ((contentWidth - spacing) * size) / actualFont + spacing,
              );
              setLayout((current) =>
                current?.profile === profile
                  ? Math.abs(current.width - measuredWidth) < 0.5
                    ? current
                    : { ...current, width: measuredWidth }
                  : { profile, width: measuredWidth, naturalWidth },
              );
            }
          : undefined
      }
      style={[
        {
          fontVariant: ['tabular-nums'],
          letterSpacing: size >= 28 ? -0.8 : -0.15,
        },
        style,
        Platform.OS === 'web' && available > 0
          ? { width: available, maxWidth: '100%' }
          : undefined,
      ]}
    >
      {currency && (
        <Txt size={fitted * 0.6} color={color ?? t.muted}>
          ¥
        </Txt>
      )}
      {prefix}
      {whole}
      {fraction !== undefined && (
        <Txt size={fitted * 0.72} weight="500" color={color ?? t.muted}>
          .{fraction}
        </Txt>
      )}
    </Txt>
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
