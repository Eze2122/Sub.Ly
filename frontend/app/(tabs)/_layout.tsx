import Ionicons from "@react-native-vector-icons/ionicons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { usesNativeTabs } from "@/src/navigation";
import { fonts, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="house.fill" />
          <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="services">
          <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" />
          <NativeTabs.Trigger.Label>Servicios</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="reports">
          <NativeTabs.Trigger.Icon sf="chart.pie.fill" />
          <NativeTabs.Trigger.Label>Reportes</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf="gearshape.fill" />
          <NativeTabs.Trigger.Label>Ajustes</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }
  const icon = (name: string, focusedName: string) =>
    function TabIcon({ color, focused }: { color: any; focused: boolean }) {
      return <Ionicons name={(focused ? focusedName : name) as any} size={22} color={color} />;
    };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
        tabBarItemStyle: { alignSelf: "center" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio", tabBarButtonTestID: "tab-home", tabBarIcon: icon("home-outline", "home") }} />
      <Tabs.Screen name="services" options={{ title: "Servicios", tabBarButtonTestID: "tab-services", tabBarIcon: icon("albums-outline", "albums") }} />
      <Tabs.Screen name="reports" options={{ title: "Reportes", tabBarButtonTestID: "tab-reports", tabBarIcon: icon("pie-chart-outline", "pie-chart") }} />
      <Tabs.Screen name="settings" options={{ title: "Ajustes", tabBarButtonTestID: "tab-settings", tabBarIcon: icon("settings-outline", "settings") }} />
    </Tabs>
  );
}
