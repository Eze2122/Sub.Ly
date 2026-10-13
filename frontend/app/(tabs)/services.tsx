import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Input } from "@/src/components/fields";
import { ServiceRow } from "@/src/components/ServiceRow";
import { Sheet } from "@/src/components/Sheet";
import { Button, Chip, EmptyState, IconButton, Ionicons, T } from "@/src/components/ui";
import { useGuard } from "@/src/data/actions.ts";
import { useAppState } from "@/src/data/store.ts";
import { addDays, computeStatus, todayISO } from "@/src/domain/dates.ts";
import { parseAmount } from "@/src/domain/money.ts";
import { normName } from "@/src/domain/operations.ts";
import { CATEGORIES, STATUS_LABEL, type CategoryId, type Service, type ServiceStatus } from "@/src/domain/types.ts";
import { usesNativeTabs } from "@/src/navigation";
import { radius, spacing, useTheme } from "@/src/theme";

type View_ = "all" | "active" | "pending" | "paid" | "overdue" | "trial" | "cancelled";
const VIEWS: { id: View_; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Activos" },
  { id: "pending", label: "Pendientes" },
  { id: "paid", label: "Pagados" },
  { id: "overdue", label: "Atrasados" },
  { id: "trial", label: "Pruebas" },
  { id: "cancelled", label: "Cancelados" },
];
type Sort = "due" | "amount" | "name" | "updated";
const SORTS: { id: Sort; label: string }[] = [
  { id: "due", label: "Próximo vencimiento" },
  { id: "amount", label: "Importe" },
  { id: "name", label: "Nombre" },
  { id: "updated", label: "Última modificación" },
];
type DueRange = "any" | "7" | "30" | "90";

function inView(v: View_, st: ServiceStatus) {
  switch (v) {
    case "all": return true;
    case "active": return st !== "cancelled";
    case "pending": return st === "upcoming" || st === "due_today" || st === "overdue";
    case "paid": return st === "paid";
    case "overdue": return st === "overdue";
    case "trial": return st === "trial";
    case "cancelled": return st === "cancelled";
  }
}

export default function Services() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const guard = useGuard();
  const st = useAppState();
  const today = todayISO();
  const [q, setQ] = useState("");
  const [view, setView] = useState<View_>("active");
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState<CategoryId[]>([]);
  const [statuses, setStatuses] = useState<ServiceStatus[]>([]);
  const [curs, setCurs] = useState<string[]>([]);
  const [due, setDue] = useState<DueRange>("any");
  const [minA, setMinA] = useState("");
  const [maxA, setMaxA] = useState("");
  const [sort, setSort] = useState<Sort>("due");
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const usedCurrencies = Array.from(new Set(st.services.map((s) => s.currency)));
  const filterCount = cats.length + statuses.length + curs.length + (due !== "any" ? 1 : 0) + (minA || maxA ? 1 : 0);

  const list = useMemo(() => {
    const nq = normName(q);
    const min = minA ? parseAmount(minA) : null;
    const max = maxA ? parseAmount(maxA) : null;
    const res = st.services.filter((s) => {
      const status = computeStatus(s, today);
      if (!inView(view, status)) return false;
      if (nq && !normName(s.name).includes(nq)) return false;
      if (cats.length && !cats.includes(s.category)) return false;
      if (statuses.length && !statuses.includes(status)) return false;
      if (curs.length && !curs.includes(s.currency)) return false;
      if (due !== "any" && (!s.nextDue || s.nextDue > addDays(today, Number(due)))) return false;
      if (min !== null && s.amountMinor < min) return false;
      if (max !== null && s.amountMinor > max) return false;
      return true;
    });
    const cmp: Record<Sort, (a: Service, b: Service) => number> = {
      due: (a, b) => (a.nextDue ?? "9999").localeCompare(b.nextDue ?? "9999"),
      amount: (a, b) => b.amountMinor - a.amountMinor,
      name: (a, b) => a.name.localeCompare(b.name, "es"),
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    };
    return res.sort(cmp[sort]);
  }, [st.services, q, view, cats, statuses, curs, due, minA, maxA, sort, today]);

  const toggle = <X,>(arr: X[], v: X, set: (a: X[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const clear = () => { setCats([]); setStatuses([]); setCurs([]); setDue("any"); setMinA(""); setMaxA(""); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <T v="title">Servicios</T>
          <IconButton testID="services-add-button" icon="add" label="Agregar servicio" onPress={() => guard(() => router.push("/service/form"))} />
        </View>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Input testID="services-search-input" value={q} onChangeText={setQ} placeholder="Buscar por nombre" style={{ paddingLeft: 40 }} returnKeyType="search" />
            <Ionicons name="search" size={18} color={colors.muted} style={{ position: "absolute", left: 14 }} />
          </View>
          <View>
            <IconButton testID="services-filter-button" icon="options-outline" label="Filtros y orden" onPress={() => setOpen(true)} />
            {filterCount ? <View style={{ position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}><T v="caption" style={{ color: colors.onBrandPrimary, fontSize: 10 }}>{filterCount}</T></View> : null}
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 56, flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" }}>
          {VIEWS.map((v) => <Chip key={v.id} testID={`services-view-${v.id}`} label={v.label} selected={view === v.id} onPress={() => setView(v.id)} />)}
        </ScrollView>
      </View>
      <FlatList
        testID="services-list"
        data={list}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: bottomChrome + spacing.xl, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.divider }} />}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={list.length ? <T v="caption" style={{ paddingVertical: spacing.xs }}>{list.length} {list.length === 1 ? "registro" : "registros"} · {SORTS.find((s) => s.id === sort)?.label}</T> : null}
        renderItem={({ item }) => <ServiceRow s={item} today={today} testID={`services-row-${item.id}`} onPress={() => router.push(`/service/${item.id}`)} />}
        ListEmptyComponent={
          st.services.length === 0 ? (
            <EmptyState testID="services-empty" icon="albums-outline" title="Todavía no hay servicios" body="Registrá suscripciones, facturas y pagos recurrentes para ver sus vencimientos." action="Agregar servicio" onAction={() => guard(() => router.push("/service/form"))} />
          ) : (
            <EmptyState testID="services-empty-filter" icon="search-outline" title="Sin resultados" body="Ningún registro coincide con la búsqueda o los filtros actuales." />
          )
        }
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Filtros y orden" testID="services-filter-sheet">
        <T v="label" color="muted">Ordenar por</T>
        <Wrap>{SORTS.map((s) => <Chip key={s.id} testID={`filter-sort-${s.id}`} label={s.label} selected={sort === s.id} onPress={() => setSort(s.id)} />)}</Wrap>
        <T v="label" color="muted">Categoría</T>
        <Wrap>{CATEGORIES.map((c) => <Chip key={c.id} testID={`filter-category-${c.id}`} label={c.label} selected={cats.includes(c.id)} onPress={() => toggle(cats, c.id, setCats)} />)}</Wrap>
        <T v="label" color="muted">Estado</T>
        <Wrap>{(Object.keys(STATUS_LABEL) as ServiceStatus[]).map((s) => <Chip key={s} testID={`filter-status-${s}`} label={STATUS_LABEL[s]} selected={statuses.includes(s)} onPress={() => toggle(statuses, s, setStatuses)} />)}</Wrap>
        {usedCurrencies.length ? <T v="label" color="muted">Moneda</T> : null}
        <Wrap>{usedCurrencies.map((c) => <Chip key={c} testID={`filter-currency-${c}`} label={c} selected={curs.includes(c)} onPress={() => toggle(curs, c, setCurs)} />)}</Wrap>
        <T v="label" color="muted">Vencimiento</T>
        <Wrap>
          {([["any", "Cualquiera"], ["7", "Próx. 7 días"], ["30", "Próx. 30 días"], ["90", "Próx. 90 días"]] as [DueRange, string][]).map(([id, l]) => <Chip key={id} testID={`filter-due-${id}`} label={l} selected={due === id} onPress={() => setDue(id)} />)}
        </Wrap>
        <T v="label" color="muted">Rango de importes</T>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Input testID="filter-amount-min" value={minA} onChangeText={setMinA} placeholder="Mínimo" keyboardType="decimal-pad" style={{ flex: 1 }} />
          <Input testID="filter-amount-max" value={maxA} onChangeText={setMaxA} placeholder="Máximo" keyboardType="decimal-pad" style={{ flex: 1 }} />
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
          <Button testID="filter-clear" kind="secondary" title="Limpiar" onPress={clear} style={{ flex: 1 }} />
          <Button testID="filter-apply" title="Aplicar" onPress={() => setOpen(false)} style={{ flex: 1 }} />
        </View>
      </Sheet>
    </View>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, borderRadius: radius.md }}>{children}</View>;
}
