import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { PRIVACY_SECTIONS as SECTIONS, PRIVACY_URL } from "@/src/domain/privacyPolicy.ts";
import { Card, T } from "@/src/components/ui";
import { spacing, useTheme } from "@/src/theme";


export default function Privacy() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader testID="privacy-header" title="Privacidad" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
        <T v="caption" testID="privacy-url">Versión pública: {PRIVACY_URL}</T>
        {SECTIONS.map(([h, b]) => (
          <Card key={h}>
            <T v="h3" style={{ marginBottom: spacing.sm }}>{h}</T>
            <T v="body" color="onSurfaceTertiary">{b}</T>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
