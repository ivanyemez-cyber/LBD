// Currencies: every total is converted into ONE currency before adding up.
// Trip totals use the trip's currency; business-wide totals use BASE_CURRENCY.
// rates[CUR] = how many BASE one unit of CUR is worth. Missing rates are reported, never guessed.
import * as store from "./store.js";

export const BASE = (process.env.BASE_CURRENCY || "EUR").toUpperCase();
export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "AED", "SAR", "JPY", "AUD", "CAD", "SEK", "NOK", "DKK", "ZAR", "MXN", "BRL", "SGD", "HKD", "THB", "IDR", "MAD"];

const doc = () => store.list("settings").find((r) => r.key === "fx");
export function rates() {
  const d = doc();
  return { base: BASE, updatedAt: d?.updatedAt || d?.createdAt || null, source: d?.source || "manual", rates: { ...(d?.rates || {}), [BASE]: 1 } };
}
export function setRates(map, source = "manual") {
  const clean = Object.fromEntries(Object.entries(map || {}).map(([k, v]) => [String(k).toUpperCase(), Number(v)]).filter(([k, v]) => /^[A-Z]{3}$/.test(k) && k !== BASE && v > 0 && isFinite(v)));
  const d = doc();
  return d ? store.update("settings", d.id, { rates: clean, source }) : store.create("settings", { key: "fx", rates: clean, source });
}

// Returns null when a rate is missing, so callers can flag it instead of adding apples to oranges.
export function convert(amount, from, to, r = rates().rates) {
  const n = Number(amount || 0);
  from = (from || BASE).toUpperCase(); to = (to || BASE).toUpperCase();
  if (!n || from === to) return n;
  if (!r[from] || !r[to]) return null;
  return (n * r[from]) / r[to];
}

// Adds amounts given as [amount, currency] pairs into one currency; lists currencies it couldn't convert.
export function total(pairs, to) {
  const r = rates().rates, missing = new Set();
  let sum = 0;
  for (const [amount, cur] of pairs) {
    const v = convert(amount, cur, to, r);
    if (v == null) missing.add(String(cur).toUpperCase()); else sum += v;
  }
  return { total: Math.round(sum * 100) / 100, missing: [...missing] };
}

// Latest European Central Bank reference rates via frankfurter.app (no key needed).
export async function fetchLatest() {
  const res = await fetch(`https://api.frankfurter.app/latest?from=${BASE}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Rate service answered ${res.status}`);
  const j = await res.json(); // { rates: { USD: 1.08 } } means 1 BASE = 1.08 USD
  const map = Object.fromEntries(Object.entries(j.rates || {}).map(([k, v]) => [k, 1 / Number(v)]));
  return setRates({ ...rates().rates, ...map }, `ECB via frankfurter.app, ${j.date}`);
}
