// Payment schedule: what the client owes us (deposit, instalments, balance) next to what we owe suppliers.
// Each instalment can be in its own currency (blank = the trip's); every total is converted into the trip's currency.
import * as store from "./store.js";
import * as fx from "./fx.js";

export const DEPOSIT_PCT = Number(process.env.DEPOSIT_PCT || 30);
export const BALANCE_DAYS = Number(process.env.BALANCE_DAYS_BEFORE || 60);

const round = (n) => Math.round(n * 100) / 100;
const isoToday = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(new Date(iso + "T12:00:00Z").getTime() + n * 864e5).toISOString().slice(0, 10);

// What the client pays in total, in the trip's currency: client prices on cost lines, else the accepted proposal, else the budget.
export function tripPrice(eventId) {
  const ev = store.get("events", eventId), cur = ev?.currency || fx.BASE;
  const priced = store.list("costs", { eventId }).filter((c) => Number(c.sell) > 0);
  if (priced.length) {
    const t = fx.total(priced.map((c) => [c.sell, c.currency || cur]), cur);
    return { amount: t.total, source: "client prices on cost lines", missingRates: t.missing };
  }
  const chosen = store.list("proposals", { eventId }).find((p) => p.choice && Number(p.price) > 0);
  if (chosen) return { amount: Number(chosen.price), source: `accepted proposal (${chosen.choice})`, missingRates: [] };
  return { amount: Number(ev?.budget || 0), source: "trip budget", missingRates: [] };
}

// Creates a deposit now and the balance N days before departure. If that date has passed (or there are no dates), one payment in full.
export function plan(eventId, { depositPct = DEPOSIT_PCT, balanceDaysBefore = BALANCE_DAYS, total, today = isoToday() } = {}) {
  const ev = store.get("events", eventId);
  if (!ev) throw new Error("Trip not found");
  if (store.list("payments", { eventId }).length) throw new Error("This trip already has a payment schedule. Edit its lines instead.");
  const amount = total != null && total !== "" ? Number(total) : tripPrice(eventId).amount;
  if (!(amount > 0)) throw new Error("No price to schedule yet: add client prices to the cost lines or a budget, or give a total.");
  const pct = Math.min(100, Math.max(0, Number(depositPct)));
  if (!isFinite(pct)) throw new Error("Deposit % must be a number");
  const deposit = round((amount * pct) / 100), balanceDue = ev.startDate ? addDays(ev.startDate, -Math.max(0, Number(balanceDaysBefore) || 0)) : null;
  const rows = !balanceDue || balanceDue <= today || pct >= 100
    ? [{ kind: "full", label: "Payment in full", amount: round(amount), dueDate: today }]
    : [...(deposit > 0 ? [{ kind: "deposit", label: `Deposit (${pct}%)`, amount: deposit, dueDate: today }] : []),
      { kind: "balance", label: "Balance", amount: round(amount - deposit), dueDate: balanceDue }];
  return rows.map((r) => store.create("payments", { eventId, ...r, received: 0 }));
}

const status = (due, left, today, in7) => (left <= 0 ? "paid" : !due ? "no date" : due < today ? "overdue" : due <= in7 ? "due soon" : "upcoming");

export function schedule(eventId, today = isoToday()) {
  const ev = store.get("events", eventId);
  if (!ev) return { error: "event not found" };
  const cur = ev.currency || fx.BASE, in7 = addDays(today, 7), missing = new Set();
  // A missing rate leaves the amount out of the totals and is reported, never added at face value.
  const conv = (n, c) => { const v = fx.convert(n, c, cur); if (v == null) { missing.add(c); return null; } return round(v); };
  const line = (id, label, c, amount, done, dueDate) => {
    const left = Math.max(0, round(amount - done));
    return { id, label, dueDate: dueDate || "", currency: c, amount, received: done, outstanding: left, status: status(dueDate, left, today, in7),
      inTrip: { amount: conv(amount, c), received: conv(done, c), outstanding: conv(left, c) } };
  };
  const byDate = (a, b) => (a.dueDate || "9").localeCompare(b.dueDate || "9");
  const instalments = store.list("payments", { eventId })
    .map((p) => ({ ...line(p.id, p.label, (p.currency || cur).toUpperCase(), Number(p.amount || 0), Number(p.received || 0), p.dueDate), kind: p.kind || "", receivedOn: p.receivedOn || "" })).sort(byDate);
  // Supplier side: cost lines with a due date, contracted (net) against what we've paid out.
  const suppliers = store.list("costs", { eventId }).filter((c) => c.dueDate)
    .map((c) => ({ ...line(c.id, c.item, (c.currency || cur).toUpperCase(), Number(c.contracted || c.quoted || 0), Number(c.paid || 0), c.dueDate), supplierId: c.supplierId || "" })).sort(byDate);
  const sum = (rows, k, only = () => true) => round(rows.filter(only).reduce((a, r) => a + (r.inTrip[k] ?? 0), 0));
  const price = tripPrice(eventId);
  price.missingRates.forEach((m) => missing.add(m));
  const scheduled = sum(instalments, "amount");
  // Cash position by date: if we must have paid suppliers more than the client was due to pay us by then, we're funding the trip.
  const flows = new Map();
  for (const i of instalments) if (i.dueDate) flows.set(i.dueDate, (flows.get(i.dueDate) || 0) + (i.inTrip.amount ?? 0));
  for (const s of suppliers) flows.set(s.dueDate, (flows.get(s.dueDate) || 0) - (s.inTrip.amount ?? 0));
  let running = 0, cashGap = null;
  for (const d of [...flows.keys()].sort()) {
    running = round(running + flows.get(d));
    if (running < 0 && (!cashGap || -running > cashGap.amount)) cashGap = { from: cashGap?.from || d, worstOn: d, amount: -running };
  }
  return {
    currency: cur, price: price.amount, priceSource: price.source,
    scheduled, unscheduled: round(price.amount - scheduled),
    received: sum(instalments, "received"), outstanding: sum(instalments, "outstanding"),
    overdue: sum(instalments, "outstanding", (i) => i.status === "overdue"),
    supplierOutstanding: sum(suppliers, "outstanding"),
    cashGap, missingRates: [...missing], instalments, suppliers,
  };
}

// Client payments that are overdue or due within 7 days, on every trip that wasn't cancelled.
export function due(today = isoToday()) {
  return store.list("events").filter((e) => e.status !== "cancelled")
    .flatMap((e) => schedule(e.id, today).instalments.filter((i) => ["overdue", "due soon"].includes(i.status))
      .map(({ inTrip, ...i }) => ({ ...i, eventId: e.id, event: e.name })));
}
