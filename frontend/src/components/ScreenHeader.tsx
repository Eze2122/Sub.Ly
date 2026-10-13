import { Stack, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing, useTheme } from "@/src/theme";

import { IconButton, T } from "./ui";

/** Sticky screen header for stack screens (navy or light). */
export function ScreenHeader({ title, right, dark = false, testID }: { title: string; right?: ReactNode; dark?: boolean; testID: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View testID={testID} style={{ paddingTop: insets.top + spacing.sm, paddingBottom: spacing.md, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: dark ? colors.brand : colors.surface, borderBottomWidth: dark ? 0 : 1, borderBottomColor: colors.border }}>
      <Stack.Screen options={{ headerShown: false }} />
      <IconButton testID={`${testID}-back`} tone={dark ? "hero" : "surface"} icon="chevron-back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <T v="h2" numberOfLines={1} style={{ flex: 1, color: dark ? colors.onBrand : colors.onSurface }}>{title}</T>
      {right}
    </View>
  );
}
