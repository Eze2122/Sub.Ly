import { Pressable, View } from "react-native";

import { computeStatus, formatShort, relativeDue } from "@/src/domain/dates.ts";
import { formatMoney } from "@/src/domain/money.ts";
import { categoryOf, frequencyLabel, type Service } from "@/src/domain/types.ts";
import { radius, spacing, useTheme, type ThemeColors } from "@/src/theme";

import { Ionicons, StatusBadge, T, type IconName } from "./ui";

export function ServiceRow({ s, today, onPress, testID }: { s: Service; today: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  const cat = categoryOf(s.category);
  const status = computeStatus(s, today);
  const tint = colors[cat.chart as keyof ThemeColors];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, minHeight: 64, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={cat.icon as IconName} size={20} color={tint} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <T v="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{s.name}</T>
          {s.source === "gmail" ? <Ionicons name="mail-outline" size={13} color={colors.muted} /> : null}
        </View>
        <T v="caption" numberOfLines={1}>
          {frequencyLabel(s)} · {status === "trial" && s.trialEnd ? `Prueba hasta ${formatShort(s.trialEnd)}` : relativeDue(s.nextDue, today)}
        </T>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <T v="bodyStrong" style={{ fontVariant: ["tabular-nums"] }}>{formatMoney(s.amountMinor, s.currency)}</T>
        <StatusBadge status={status} testID={`${testID}-status`} />
      </View>
    </Pressable>
  );
}
