import { useState, type ReactNode } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";

import { formatDate, todayISO } from "@/src/domain/dates.ts";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

import { MonthCalendar } from "./MonthCalendar";
import { Sheet } from "./Sheet";
import { Button, Ionicons, T } from "./ui";

export function FieldLabel({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="label" color="onSurfaceTertiary">{label}</T>
      {children}
      {error ? <T v="caption" color="errorText">{error}</T> : hint ? <T v="caption">{hint}</T> : null}
    </View>
  );
}

export function Input({ error, testID, ...p }: TextInputProps & { error?: boolean; testID: string }) {
  const { colors } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      testID={testID}
      placeholderTextColor={colors.muted}
      {...p}
      onFocus={(e) => {
        setFocus(true);
        p.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocus(false);
        p.onBlur?.(e);
      }}
      style={[
        {
          minHeight: 50,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: error ? colors.error : focus ? colors.brandPrimary : colors.border,
          backgroundColor: colors.surfaceSecondary,
          paddingHorizontal: spacing.md,
          fontFamily: fonts.medium,
          fontSize: 15,
          color: colors.onSurface,
        },
        p.multiline ? { minHeight: 88, paddingTop: spacing.md, textAlignVertical: "top" } : null,
        p.style,
      ]}
    />
  );
}

export function DateField({ value, onChange, testID, error, placeholder = "Elegir fecha", allowClear = true }: { value: string | null; onChange: (v: string | null) => void; testID: string; error?: boolean; placeholder?: string; allowClear?: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const today = todayISO();
  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        style={{ minHeight: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: error ? colors.error : colors.border, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        <T v="bodyStrong" color={value ? "onSurface" : "muted"} style={{ flex: 1 }}>{value ? formatDate(value) : placeholder}</T>
        {value && allowClear ? (
          <Pressable testID={`${testID}-clear`} hitSlop={10} onPress={() => onChange(null)} accessibilityLabel="Borrar fecha">
            <Ionicons name="close-circle" size={18} color={colors.borderStrong} />
          </Pressable>
        ) : null}
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Elegir fecha" testID={`${testID}-sheet`}>
        <MonthCalendar
          testID={`${testID}-calendar`}
          initial={value ?? today}
          selected={value}
          today={today}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
        <Button testID={`${testID}-today`} kind="secondary" title="Hoy" onPress={() => { onChange(today); setOpen(false); }} />
      </Sheet>
    </>
  );
}

export function Segmented<T extends string>({ options, value, onChange, testID }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const sel = o.id === value;
        return (
          <Pressable key={o.id} testID={`${testID}-${o.id}`} onPress={() => onChange(o.id)} style={{ flex: 1, minHeight: 40, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: sel ? colors.surfaceSecondary : "transparent" }}>
            <T v="label" color={sel ? "onSurface" : "muted"}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
