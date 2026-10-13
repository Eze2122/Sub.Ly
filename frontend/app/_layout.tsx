import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState as RNAppState, LogBox, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { refreshEntitlement } from "@/src/billing/entitlement.ts";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/Toast";
import { getState, loadState, onPersisted, useLoaded } from "@/src/data/store.ts";
import "@/src/gmail/background";
import { queryClient } from "@/src/query-client";
import { rescheduleSoon } from "@/src/services/notifications";
import { useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const { colors } = useTheme();
  // Prewarm icon font + brand fonts before first paint (fixes icons on Expo Go Android).
  const [fontsLoaded, fontError] = useFonts({
    Ionicons: require("@react-native-vector-icons/ionicons/fonts/Ionicons.ttf"),
    "PlusJakartaSans-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "PlusJakartaSans-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "PlusJakartaSans-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });
  const loaded = useLoaded();

  useEffect(() => {
    loadState().then((s) => rescheduleSoon(s));
    refreshEntitlement().catch(() => undefined);
    const off = onPersisted((s) => rescheduleSoon(s));
    const sub = RNAppState.addEventListener("change", (st) => {
      if (st === "active") {
        rescheduleSoon(getState());
        refreshEntitlement().catch(() => undefined);
      }
    });
    return () => {
      off();
      sub.remove();
    };
  }, []);

  const ready = (fontsLoaded || !!fontError) && loaded;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.brand }} />;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <ToastProvider>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, animation: "slide_from_right" }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="premium" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              </Stack>
            </ToastProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
