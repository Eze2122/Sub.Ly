import { View } from "react-native";
import Svg, { Circle, G, Rect } from "react-native-svg";

import { radius, spacing, useTheme } from "@/src/theme";

import { T } from "./ui";

export type Slice = { key: string; label: string; value: number; color: string; valueLabel: string };

export function Donut({ slices, size = 150, centerTop, centerBottom, testID }: { slices: Slice[]; size?: number; centerTop: string; centerBottom: string; testID: string }) {
  const { colors } = useTheme();
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
          <G>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceTertiary} strokeWidth={stroke} fill="none" />
            {slices.map((s) => {
              const len = (s.value / total) * circ;
              const el = (
                <Circle key={s.key} cx={size / 2} cy={size / 2} r={r} stroke={s.color} strokeWidth={stroke} fill="none" strokeDasharray={`${Math.max(len - 2, 0.1)} ${circ}`} strokeDashoffset={-offset} />
              );
              offset += len;
              return el;
            })}
          </G>
        </Svg>
        <T v="h3" style={{ fontVariant: ["tabular-nums"] }}>{centerTop}</T>
        <T v="caption">{centerBottom}</T>
      </View>
      <View style={{ flex: 1, gap: spacing.sm }}>
        {slices.slice(0, 6).map((s) => (
          <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
            <T v="caption" color="onSurfaceTertiary" numberOfLines={1} style={{ flex: 1 }}>{s.label}</T>
            <T v="caption" color="onSurface">{Math.round((s.value / total) * 100)}%</T>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Bars({ data, height = 140, testID }: { data: { label: string; value: number; highlight?: boolean }[]; height?: number; testID: string }) {
  const { colors } = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, height: height + 24 }}>
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * height, d.value > 0 ? 4 : 2);
        return (
          <View key={`${d.label}-${i}`} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <Svg width="100%" height={h}>
              <Rect x="15%" y={0} width="70%" height={h} rx={radius.sm} fill={d.highlight ? colors.brandPrimary : d.value > 0 ? colors.brand : colors.surfaceTertiary} />
            </Svg>
            <T v="caption" style={{ fontSize: 11 }}>{d.label}</T>
          </View>
        );
      })}
    </View>
  );
}
