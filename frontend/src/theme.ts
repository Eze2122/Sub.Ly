// Subly design tokens. Keys match the "color" block of /app/design_guidelines.json.
// Light theme with navy hero areas. Components import `useTheme` / `makeStyles`.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#F8FAFC",
  onSurface: "#0F172A",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#0F172A",
  surfaceTertiary: "#F1F5F9",
  onSurfaceTertiary: "#334155",
  surfaceInverse: "#0F172A",
  onSurfaceInverse: "#F8FAFC",
  muted: "#64748B",

  brand: "#0B1528",
  onBrand: "#FFFFFF",
  brandPrimary: "#059669",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#1E293B",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#D1FAE5",
  onBrandTertiary: "#065F46",

  // Hero (navy) helpers
  heroMuted: "#94A3B8",
  heroCard: "#13213A",
  heroBorder: "#22314D",
  mintBright: "#34D399",

  success: "#10B981",
  onSuccess: "#FFFFFF",
  successSoft: "#D1FAE5",
  warning: "#F59E0B",
  onWarning: "#FFFFFF",
  warningSoft: "#FEF3C7",
  warningText: "#B45309",
  error: "#EF4444",
  onError: "#FFFFFF",
  errorSoft: "#FEE2E2",
  errorText: "#B91C1C",
  info: "#3B82F6",
  onInfo: "#FFFFFF",
  infoSoft: "#DBEAFE",
  infoText: "#1D4ED8",

  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  divider: "#F1F5F9",
  overlay: "rgba(11,21,40,0.55)",

  // Chart palette (one per category)
  chart1: "#059669",
  chart2: "#3B82F6",
  chart3: "#F59E0B",
  chart4: "#0EA5E9",
  chart5: "#EF4444",
  chart6: "#8B5CF6",
  chart7: "#14B8A6",
  chart8: "#EC4899",
  chart9: "#64748B",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export const fonts = {
  regular: "PlusJakartaSans-Regular",
  medium: "PlusJakartaSans-Medium",
  semibold: "PlusJakartaSans-SemiBold",
  bold: "PlusJakartaSans-Bold",
  extrabold: "PlusJakartaSans-ExtraBold",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
export const fontSize = { sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, hero: 32 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const s = system as ColorScheme | null | undefined;
  const scheme: ColorScheme = s && themes[s] ? s : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const shadow = {
  shadowColor: "#0B1528",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};
