// Domain unit tests. Run: node --test src/__tests__/domain.test.ts  (Node >= 23, type stripping)
import assert from "node:assert/strict";
import { test } from "node:test";

import { decryptBackup, encryptBackup, servicesCsv } from "../domain/backup.ts";
import { addMonths, computeStatus, firstDueOnOrAfter, nextDueAfter } from "../domain/dates.ts";
import { detect, extractAmount, groupDetections, inferFrequency } from "../domain/gmailParser.ts";
import { convertTotals, parseAmount } from "../domain/money.ts";
import { confirmPayment, createService, deleteService, emptyState, migrate, restoreInto, updateService, validateServiceInput, type ServiceInput } from "../domain/operations.ts";
import { summarize } from "../domain/stats.ts";
import { planNotifications as planNotificationsPure } from "../domain/reminders.ts";
import { randomBytes } from "node:crypto";

const NOW = "2026-06-10T12:00:00.000Z";
const TODAY = "2026-06-10";
const base = (o: Partial<ServiceInput> = {}): ServiceInput => ({ name: "Internet", category: "telecom", amountMinor: 1500000, currency: "ARS", frequency: "monthly", nextDue: "2026-06-15", reminders: true, ...o });

test("CRUD: create, edit, delete with/without history", () => {
  let { state, service } = createService(emptyState(), base(), NOW, TODAY);
  assert.equal(state.services.length, 1);
  state = updateService(state, service.id, base({ name: "Fibra" }), NOW, TODAY);
  assert.equal(state.services[0].name, "Fibra");
  state = confirmPayment(state, service.id, TODAY, 1500000, NOW);
  assert.equal(deleteService(state, service.id, false).payments.length, 1);
  assert.equal(deleteService(state, service.id, true).payments.length, 0);
});

test("due dates for all frequencies", () => {
  const f = (frequency: any, customInterval?: any) => nextDueAfter({ frequency, customInterval, anchorDay: 15 }, "2026-01-15");
  assert.equal(f("weekly"), "2026-01-22");
  assert.equal(f("monthly"), "2026-02-15");
  assert.equal(f("quarterly"), "2026-04-15");
  assert.equal(f("annual"), "2027-01-15");
  assert.equal(f("custom", { count: 10, unit: "day" }), "2026-01-25");
  assert.equal(f("custom", { count: 2, unit: "month" }), "2026-03-15");
  assert.equal(f("once"), null);
});

test("end of month and leap years", () => {
  assert.equal(addMonths("2026-01-31", 1, 31), "2026-02-28");
  assert.equal(addMonths("2026-02-28", 1, 31), "2026-03-31");
  assert.equal(addMonths("2028-01-31", 1, 31), "2028-02-29");
  assert.equal(nextDueAfter({ frequency: "annual", anchorDay: 29 }, "2028-02-29"), "2029-02-28");
  assert.equal(nextDueAfter({ frequency: "monthly", anchorDay: 31, endDate: "2026-03-01" }, "2026-01-31"), "2026-02-28");
  assert.equal(nextDueAfter({ frequency: "monthly", anchorDay: 31, endDate: "2026-02-01" }, "2026-01-31"), null);
  assert.equal(firstDueOnOrAfter({ frequency: "monthly", anchorDay: 31 }, "2026-01-31", "2026-04-02"), "2026-04-30");
});

test("confirm payment advances due date, once becomes paid, no double payment", () => {
  let { state, service } = createService(emptyState(), base({ nextDue: "2026-01-31" }), NOW, TODAY);
  state = confirmPayment(state, service.id, "2026-01-30", 1500000, NOW);
  assert.equal(state.services[0].nextDue, "2026-02-28");
  const again = confirmPayment(state, service.id, "2026-01-30", 1500000, NOW);
  assert.equal(again.payments.length, 1 + 0 + (again.services[0].nextDue === "2026-03-31" ? 1 : 0));
  const one = createService(emptyState(), base({ frequency: "once", nextDue: "2026-06-01" }), NOW, TODAY);
  const paid = confirmPayment(one.state, one.service.id, "2026-06-01", 100, NOW);
  assert.equal(paid.services[0].nextDue, null);
  assert.equal(computeStatus(paid.services[0], TODAY), "paid");
});

test("overdue / today / trial / cancelled statuses; invoices are not paid", () => {
  const mk = (o: Partial<ServiceInput>) => createService(emptyState(), base(o), NOW, TODAY).service;
  assert.equal(computeStatus(mk({ nextDue: "2026-06-01" }), TODAY), "overdue");
  assert.equal(computeStatus(mk({ nextDue: TODAY }), TODAY), "due_today");
  assert.equal(computeStatus(mk({ nextDue: "2026-06-20" }), TODAY), "upcoming");
  assert.equal(computeStatus(mk({ trialEnd: "2026-06-17" }), TODAY), "trial");
  assert.equal(computeStatus({ ...mk({}), cancelled: true }, TODAY), "cancelled");
  const inv = detect({ id: "m1", from: "Edesur <facturas@edesur.com.ar>", subject: "Tu factura de junio", date: "2026-06-01", text: "Total a pagar $ 25.300,50 fecha de vencimiento 20/06/2026" });
  assert.equal(inv?.kind, "invoice");
  const g = groupDetections([inv!], TODAY)[0];
  assert.ok(g.confidence < 0.8, "single invoice must not auto-create a paid record");
});

test("validation", () => {
  assert.ok(validateServiceInput(base({ name: "" })).name);
  assert.ok(validateServiceInput(base({ amountMinor: null })).amountMinor);
  assert.ok(validateServiceInput(base({ frequency: "custom", customInterval: { count: 0, unit: "day" } })).customCount);
  assert.deepEqual(validateServiceInput(base()), {});
});

test("money parsing and conversion without mixing currencies", () => {
  assert.equal(parseAmount("1.234,56"), 123456);
  assert.equal(parseAmount("1234.56"), 123456);
  assert.equal(parseAmount("9,99"), 999);
  assert.equal(parseAmount("1.500"), 150000);
  assert.equal(parseAmount("abc"), null);
  let s = createService(emptyState(), base({ amountMinor: 1000, currency: "USD" }), NOW, TODAY).state;
  s = createService(s, base({ name: "Luz", amountMinor: 200000, currency: "ARS" }), NOW, TODAY).state;
  const sum = summarize(s.services, TODAY);
  assert.deepEqual(Object.keys(sum.monthly).sort(), ["ARS", "USD"]);
  const noRate = convertTotals(sum.monthly, "ARS", []);
  assert.deepEqual(noRate.missing, ["USD"]);
  assert.equal(noRate.total, 200000);
  const withRate = convertTotals(sum.monthly, "ARS", [{ id: "r", from: "USD", to: "ARS", rate: 1000, updatedAt: NOW }]);
  assert.equal(withRate.total, 1200000);
  const inverse = convertTotals({ ARS: 100000 }, "USD", [{ id: "r", from: "USD", to: "ARS", rate: 1000, updatedAt: NOW }]);
  assert.equal(inverse.total, 100);
  assert.equal(convertTotals({ USD: 1 }, "ARS", [{ id: "z", from: "USD", to: "ARS", rate: 0, updatedAt: NOW }]).missing[0], "USD");
});

test("CSV keeps Spanish characters, BOM and no tokens", () => {
  const s = createService(emptyState(), base({ name: "Teléfono ñandú", notes: 'dice "hola"; chau' }), NOW, TODAY).state;
  const csv = servicesCsv(s, TODAY);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("Teléfono ñandú"));
  assert.ok(csv.includes('"dice ""hola""; chau"'));
  assert.ok(!/token/i.test(csv));
});

test("encrypted backup roundtrip, wrong password and tamper detection", () => {
  const s = createService(emptyState(), base({ name: "Gimnasio" }), NOW, TODAY).state;
  const rb = (n: number) => new Uint8Array(randomBytes(n));
  const enc = encryptBackup({ ...s, gmail: { ...s.gmail, processedIds: ["abc"], email: "x@y.com" } }, "contraseña-segura", rb, NOW);
  assert.ok(!enc.includes("Gimnasio"));
  assert.ok(!enc.includes("x@y.com"));
  const back = decryptBackup(enc, "contraseña-segura");
  assert.equal(back.services[0].name, "Gimnasio");
  assert.deepEqual(back.gmail.processedIds, []);
  assert.throws(() => decryptBackup(enc, "otra-clave-123"));
  const obj = JSON.parse(enc);
  obj.ct = obj.ct.slice(0, -4) + "AAAA";
  assert.throws(() => decryptBackup(JSON.stringify(obj), "contraseña-segura"));
  assert.throws(() => decryptBackup("not json", "x"));
  const merged = restoreInto(s, back, "merge");
  assert.equal(merged.state.services.length, 1);
  assert.equal(merged.skipped, 1);
});

test("migration from schema v1", () => {
  const m = migrate({ schemaVersion: 1, services: [{ id: "a", name: "X" }] });
  assert.equal(m.schemaVersion, 2);
  assert.equal(m.services[0].reminders, true);
  assert.deepEqual(m.dismissedRefs, []);
});

test("Gmail detection: amounts, recurrence, dedupe", () => {
  assert.deepEqual(extractAmount("Total: US$ 15,99"), { amountMinor: 1599, currency: "USD" });
  assert.deepEqual(extractAmount("Importe $ 4.599,00"), { amountMinor: 459900, currency: "ARS" });
  assert.deepEqual(extractAmount("Cobro de R$ 39,90"), { amountMinor: 3990, currency: "BRL" });
  assert.equal(inferFrequency(["2026-03-05", "2026-04-05", "2026-05-05"]), "monthly");
  const mails = ["2026-03-05", "2026-04-05", "2026-05-05"].map((d, i) =>
    detect({ id: `n${i}`, from: "Netflix <info@mailer.netflix.com>", subject: "Recibimos tu pago", date: d, text: "Tu suscripción mensual. Total ARS 8.999,00" })!,
  );
  const promo = detect({ id: "p", from: "Tienda <promo@shop.com>", subject: "Oferta 50% off", date: "2026-05-01", text: "newsletter" });
  assert.equal(promo, null);
  const g = groupDetections(mails, TODAY);
  assert.equal(g.length, 1);
  assert.equal(g[0].frequency, "monthly");
  assert.equal(g[0].nextDue, "2026-07-05");
  assert.ok(g[0].confidence >= 0.8);
});

test("notifications plan: deterministic ids, no duplicates, cancelled excluded", () => {
  let { state, service } = createService(emptyState(), base({ nextDue: "2026-06-20" }), NOW, TODAY);
  state = createService(state, base({ name: "Viejo", nextDue: "2026-06-25" }), NOW, TODAY).state;
  state = { ...state, services: state.services.map((s) => (s.name === "Viejo" ? { ...s, cancelled: true } : s)) };
  const plan = planNotificationsPure(state, new Date(2026, 5, 10, 8));
  const ids = plan.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.includes(service.id)));
  assert.equal(plan.length, 4);
  const again = planNotificationsPure(state, new Date(2026, 5, 10, 8));
  assert.deepEqual(again.map((p) => p.id), ids);
});
