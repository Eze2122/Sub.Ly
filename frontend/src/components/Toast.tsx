import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, radius, spacing, useTheme } from "@/src/theme";

import { Ionicons } from "./ui";

type Tone = "success" | "error" | "info";
const Ctx = createContext<(msg: string, tone?: Tone) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ msg: string; tone: Tone } | null>(null);
  const op = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(
    (msg: string, tone: Tone = "success") => {
      setToast({ msg, tone });
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
      }, 3200);
    },
    [op],
  );
  const icon = toast?.tone === "error" ? "alert-circle" : toast?.tone === "info" ? "information-circle" : "checkmark-circle";
  const accent = toast?.tone === "error" ? colors.error : toast?.tone === "info" ? colors.info : colors.mintBright;
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: spacing.lg, right: spacing.lg, top: insets.top + spacing.sm, opacity: op, transform: [{ translateY: op.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }}>
          <View testID="toast" style={{ backgroundColor: colors.surfaceInverse, borderRadius: radius.md, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name={icon} size={20} color={accent} />
            <Text testID="toast-message" style={{ flex: 1, color: colors.onSurfaceInverse, fontFamily: fonts.semibold, fontSize: 14 }}>{toast.msg}</Text>
          </View>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
