import { Platform } from "react-native";

/** iOS 26+ uses native tabs; Android, older iOS and web use the JS tab bar. */
export const usesNativeTabs = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
