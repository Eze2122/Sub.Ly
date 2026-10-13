import { Image } from "expo-image";
import { Text, View } from "react-native";

import { fonts, useTheme } from "@/src/theme";

export function Logo({ size = 40, wordmark = true, light = true }: { size?: number; wordmark?: boolean; light?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", borderWidth: light ? 1 : 0, borderColor: colors.heroBorder }}>
        <Image source={require("@/assets/images/logo-mark.png")} style={{ width: size * 0.78, height: size * 0.78 }} contentFit="contain" />
      </View>
      {wordmark ? <Text style={{ fontFamily: fonts.extrabold, fontSize: size * 0.55, letterSpacing: -0.5, color: light ? colors.onBrand : colors.brand }}>Subly</Text> : null}
    </View>
  );
}
