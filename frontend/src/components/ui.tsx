import Ionicons, { type IoniconsIconName } from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { STATUS_LABEL, type ServiceStatus } from "@/src/domain/types.ts";
import { fonts, fontSize, makeStyles, radius, shadow, spacing, useTheme, type ThemeColors } from "@/src/theme";

export { Ionicons };
export type IconName = IoniconsIconName;

type TextVariant = "hero" | "title" | "h2" | "h3" | "body" | "bodyStrong" | "caption" | "label" | "overline";

const variantStyle: Record<TextVariant, TextStyle> = {
  hero: { fontFamily: fonts.extrabold, fontSize: fontSize.hero, letterSpacing: -0.8 },
  title: { fontFamily: fonts.extrabold, fontSize: 28, letterSpacing: -0.6 },
  h2: { fontFamily: fonts.bold, fontSize: fontSize.xl, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.bold, fontSize: fontSize.lg },
  body: { fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 20 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: fontSize.base, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: fontSize.sm, lineHeight: 16 },
  label: { fontFamily: fonts.semibold, fontSize: 13 },
  overline: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" },
};

export function T({
  v = "body",
  color,
  style,
  children,
  numberOfLines,
  testID,
}: {
  v?: TextVariant;
  color?: keyof ThemeColors;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Text testID={testID} numberOfLines={numberOfLines} style={[variantStyle[v], { color: colors[color ?? (v === "caption" ? "muted" : "onSurface")] }, style]}>
      {children}
    </Text>
  );
}

type BtnKind = "primary" | "secondary" | "ghost" | "danger" | "hero";

export function Button({
  title,
  onPress,
  kind = "primary",
  icon,
  loading,
  disabled,
  testID,
  style,
  small,
}: {
  title: string;
  onPress: () => void;
  kind?: BtnKind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  testID: string;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const { colors } = useTheme();
  const map: Record<BtnKind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.brandPrimary, fg: colors.onBrandPrimary },
    hero: { bg: colors.mintBright, fg: colors.brand },
    secondary: { bg: colors.surfaceSecondary, fg: colors.onSurface, border: colors.border },
    ghost: { bg: "transparent", fg: colors.brandPrimary },
    danger: { bg: colors.errorSoft, fg: colors.errorText },
  };
  const c = map[kind];
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      disabled={off}
      onPress={() => {
        if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: small ? 40 : 52,
          paddingHorizontal: small ? spacing.md : spacing.lg,
          borderRadius: radius.md,
          backgroundColor: c.bg,
          borderWidth: c.border ? 1 : 0,
          borderColor: c.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          opacity: off ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={c.fg} /> : icon ? <Ionicons name={icon} size={small ? 16 : 18} color={c.fg} /> : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: small ? 13 : 15, color: c.fg }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, testID, tone = "surface", label }: { icon: IconName; onPress: () => void; testID: string; tone?: "surface" | "hero"; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tone === "hero" ? colors.heroCard : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: tone === "hero" ? colors.heroBorder : colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={tone === "hero" ? colors.onBrand : colors.onSurface} />
    </Pressable>
  );
}

const useCardStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, ...shadow },
}));
export function Card({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const s = useCardStyles();
  return (
    <View testID={testID} style={[s.card, style]}>
      {children}
    </View>
  );
}

export function Chip({ label, selected, onPress, testID, icon }: { label: string; selected?: boolean; onPress: () => void; testID: string; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => ({
        height: 36,
        flexShrink: 0,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderColor: selected ? colors.brand : colors.border,
        backgroundColor: selected ? colors.brand : colors.surfaceSecondary,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.onBrand : colors.onSurfaceTertiary} /> : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: selected ? colors.onBrand : colors.onSurfaceTertiary }}>{label}</Text>
    </Pressable>
  );
}

export function statusColors(c: ThemeColors, s: ServiceStatus) {
  return {
    upcoming: { bg: c.infoSoft, fg: c.infoText, icon: "time-outline" as IconName },
    due_today: { bg: c.warningSoft, fg: c.warningText, icon: "alert-circle-outline" as IconName },
    paid: { bg: c.successSoft, fg: c.onBrandTertiary, icon: "checkmark-circle-outline" as IconName },
    overdue: { bg: c.errorSoft, fg: c.errorText, icon: "warning-outline" as IconName },
    trial: { bg: c.brandTertiary, fg: c.onBrandTertiary, icon: "gift-outline" as IconName },
    cancelled: { bg: c.surfaceTertiary, fg: c.muted, icon: "close-circle-outline" as IconName },
  }[s];
}

export function StatusBadge({ status, testID }: { status: ServiceStatus; testID?: string }) {
  const { colors } = useTheme();
  const sc = statusColors(colors, status);
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: sc.bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Ionicons name={sc.icon} size={12} color={sc.fg} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: sc.fg }}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

export function SectionHeader({ title, action, onAction, testID }: { title: string; action?: string; onAction?: () => void; testID?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
      <T v="h3">{title}</T>
      {action && onAction ? (
        <Pressable testID={testID} onPress={onAction} hitSlop={10} style={{ minHeight: 32, justifyContent: "center" }}>
          <T v="label" color="brandPrimary">{action}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, body, action, onAction, testID }: { icon: IconName; title: string; body: string; action?: string; onAction?: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.md }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", width: 96, height: 96, borderRadius: 32, borderWidth: 1, borderColor: colors.brandTertiary }} />
        <Ionicons name={icon} size={30} color={colors.onBrandTertiary} />
      </View>
      <T v="h3" style={{ textAlign: "center" }}>{title}</T>
      <T v="body" color="muted" style={{ textAlign: "center", maxWidth: 300 }}>{body}</T>
      {action && onAction ? <Button testID={`${testID}-action`} title={action} onPress={onAction} icon="add" style={{ marginTop: spacing.sm, alignSelf: "stretch" }} /> : null}
    </View>
  );
}

export function Notice({ tone, icon, title, body, children, testID }: { tone: "info" | "warning" | "error" | "success"; icon: IconName; title: string; body?: string; children?: ReactNode; testID?: string }) {
  const { colors } = useTheme();
  const m = {
    info: [colors.infoSoft, colors.infoText],
    warning: [colors.warningSoft, colors.warningText],
    error: [colors.errorSoft, colors.errorText],
    success: [colors.successSoft, colors.onBrandTertiary],
  }[tone];
  return (
    <View testID={testID} style={{ backgroundColor: m[0], borderRadius: radius.md, padding: spacing.md, flexDirection: "row", gap: spacing.md }}>
      <Ionicons name={icon} size={20} color={m[1]} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: m[1] }}>{title}</Text>
        {body ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: m[1] }}>{body}</Text> : null}
        {children}
      </View>
    </View>
  );
}

export function Row({ icon, title, subtitle, onPress, right, testID, danger }: { icon: IconName; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode; testID: string; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, minHeight: 56, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: danger ? colors.errorSoft : colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={18} color={danger ? colors.errorText : colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong" color={danger ? "errorText" : "onSurface"}>{title}</T>
        {subtitle ? <T v="caption">{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} /> : null)}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.divider }} />;
}
