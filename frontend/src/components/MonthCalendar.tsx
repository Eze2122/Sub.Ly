import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { daysInMonth, MONTHS_LONG, pad, parseISO } from "@/src/domain/dates.ts";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

import { IconButton, T } from "./ui";

const WD = ["L", "M", "M", "J", "V", "S", "D"];

/** Month grid. `marks` maps ISO date -> dot color. */
export function MonthCalendar({
  initial,
  selected,
  onSelect,
  marks = {},
  today,
  testID,
}: {
  initial: string;
  selected?: string | null;
  onSelect?: (iso: string) => void;
  marks?: Record<string, string>;
  today: string;
  testID: string;
}) {
  const { colors } = useTheme();
  const start = parseISO(initial);
  const [ym, setYm] = useState({ y: start.y, m: start.m });
  const cells = useMemo(() => {
    const first = new Date(ym.y, ym.m - 1, 1).getDay();
    const lead = (first + 6) % 7;
    const n = daysInMonth(ym.y, ym.m);
    const arr: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= n; d++) arr.push(`${ym.y}-${pad(ym.m)}-${pad(d)}`);
    while (arr.length % 7) arr.push(null);
    return arr;
  }, [ym]);
  const move = (k: number) => setYm(({ y, m }) => {
    const t = y * 12 + (m - 1) + k;
    return { y: Math.floor(t / 12), m: (t % 12) + 1 };
  });
  return (
    <View testID={testID}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
        <IconButton testID={`${testID}-prev`} icon="chevron-back" onPress={() => move(-1)} label="Mes anterior" />
        <T v="h3" testID={`${testID}-month`} style={{ textTransform: "capitalize" }}>{`${MONTHS_LONG[ym.m - 1]} ${ym.y}`}</T>
        <IconButton testID={`${testID}-next`} icon="chevron-forward" onPress={() => move(1)} label="Mes siguiente" />
      </View>
      <View style={{ flexDirection: "row" }}>
        {WD.map((w, i) => (
          <T key={i} v="caption" style={{ flex: 1, textAlign: "center", paddingVertical: 4 }}>{w}</T>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((iso, i) => {
          const sel = iso && iso === selected;
          const isToday = iso === today;
          return (
            <Pressable
              key={iso ?? `e${i}`}
              testID={iso ? `${testID}-day-${iso}` : undefined}
              disabled={!iso || !onSelect}
              onPress={() => iso && onSelect?.(iso)}
              style={{ width: `${100 / 7}%`, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              {iso ? (
                <View style={{ width: 38, height: 38, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: sel ? colors.brand : "transparent", borderWidth: isToday && !sel ? 1.5 : 0, borderColor: colors.brandPrimary }}>
                  <T v="label" style={{ fontFamily: isToday ? fonts.bold : fonts.medium, color: sel ? colors.onBrand : colors.onSurface }}>{Number(iso.slice(8))}</T>
                  {marks[iso] ? <View style={{ position: "absolute", bottom: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: sel ? colors.mintBright : marks[iso] }} /> : null}
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
