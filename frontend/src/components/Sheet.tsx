import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Modal, Pressable, ScrollView, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, spacing, useTheme } from "@/src/theme";

import { IconButton, T } from "./ui";

/** Bottom sheet built on Modal, rendered above tabs and navigation. */
export function Sheet({ visible, onClose, title, children, testID }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; testID: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(40)).current;
  useEffect(() => {
    if (visible) {
      y.setValue(40);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
    }
  }, [visible, y]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay }}>
          <Pressable testID={`${testID}-backdrop`} style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Cerrar" />
          <Animated.View
            testID={testID}
            style={{ transform: [{ translateY: y }], backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: "88%", paddingBottom: insets.bottom + spacing.lg }}
          >
            <View style={{ alignItems: "center", paddingTop: spacing.sm }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
              <T v="h2" style={{ flex: 1 }}>{title}</T>
              <IconButton testID={`${testID}-close`} icon="close" onPress={onClose} label="Cerrar" />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
