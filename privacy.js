// GDPR helpers: minimise what the AI sees, subject access export, erasure, retention and consent checks.
// This is tooling for compliance, not legal advice. See GDPR.md for what still needs a human decision.
import fs from "node:fs";
import * as store from "./store.js";
import { threadKey } from "./inbox.js";

export const RETENTION_MONTHS = Number(process.env.RETENTION_MONTHS || 24);
// Fields Blue (and the AI provider) never needs to see.
const AGENT_HIDDEN = ["emergency", "assistant", "loyalty", "passportExpiry", "nationality", "birthday", "anniversary"];
// Health data (allergies, dietary needs) is special-category data under GDPR Art. 9: it needs explicit consent.
const HEALTH = ["dietary"];
const hasHealth = (c) => HEALTH.some((k) => String(c[k] || "").trim());
const keysOf = (c) => [c.email, c.phone].filter(Boolean).map(threadKey);

export function forAgent(c) {
  const out = { ...c };
  for (const k of AGENT_HIDDEN) delete out[k];
  if (c.consentHealth !== "yes") for (const k of HEALTH) if (out[k]) out[k] = "[recorded — no health-data consent yet, ask the planner]";
  return out;
}

// Right of access (Art. 15) / portability (Art. 20): everything we hold about one client.
export function exportClient(id) {
  const c = store.get("clients", id);
  if (!c) return null;
  const keys = new Set(keysOf(c)), events = store.list("events").filter((e) => e.clientId === id || (e.guestIds || []).includes(id)), evIds = new Set(events.map((e) => e.id));
  return {
    exportedAt: new Date().toISOString(),
    client: c,
    events: events.map(({ token, ...e }) => e),
    itinerary: store.list("itinerary").filter((i) => evIds.has(i.eventId)),
    approvals: store.list("approvals").filter((a) => evIds.has(a.eventId)).map(({ token, ...a }) => a),
    messages: store.list("messages").filter((m) => m.clientId === id || keys.has(m.threadKey)),
    drafts: store.list("drafts").filter((d) => d.to && keys.has(threadKey(d.to))),
  };
}

// Right to erasure (Art. 17). Messages and drafts go; the client record becomes an anonymous stub so
// events, itinerary and costs (kept for accounting obligations) stay consistent but no longer identify anyone.
export function eraseClient(id) {
  const c = store.get("clients", id);
  if (!c || c.erased) return null;
  const keys = new Set(keysOf(c));
  const msgs = store.list("messages").filter((m) => m.clientId === id || keys.has(m.threadKey));
  const drafts = store.list("drafts").filter((d) => d.to && keys.has(threadKey(d.to)));
  msgs.forEach((m) => store.remove("messages", m.id));
  if (c.name) store.list("audit").filter((a) => String(a.detail).includes(c.name)).forEach((a) => store.update("audit", a.id, { detail: String(a.detail).split(c.name).join("[erased client]") }));
  drafts.forEach((d) => store.remove("drafts", d.id));
  // Linked events keep their bookings but lose the client's name from free text ("Sara & Tom · Sintra wedding").
  const names = [c.name, String(c.name || "").split(/[\s&,]+/)[0]].filter((n) => n && n.length > 2);
  const strip = (t) => names.reduce((acc, n) => acc.replace(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "[client]"), String(t));
  // Travelling guest on someone else's trip: just drop them from the party lists.
  for (const e of store.list("events").filter((e) => (e.guestIds || []).includes(id))) store.update("events", e.id, { guestIds: e.guestIds.filter((g) => g !== id) });
  for (const i of store.list("itinerary").filter((i) => (i.guestIds || []).includes(id))) store.update("itinerary", i.id, { guestIds: i.guestIds.filter((g) => g !== id) });
  for (const e of store.list("events").filter((e) => e.clientId === id)) {
    store.update("events", e.id, { name: strip(e.name || ""), notes: e.notes && strip(e.notes) });
    for (const i of store.list("itinerary", { eventId: e.id })) if (i.notes) store.update("itinerary", i.id, { notes: strip(i.notes) });
  }
  store.update("clients", id, { ...Object.fromEntries(Object.keys(c).map((k) => [k, undefined])), id, createdAt: c.createdAt, name: `Erased client ${id}`, erased: true, erasedAt: new Date().toISOString() });
  return { messages: msgs.length, drafts: drafts.length };
}

const monthsAgo = (n) => new Date(Date.now() - n * 30.44 * 864e5).toISOString().slice(0, 10);
// Privacy notice: a draft built from privacy-notice.md, for a human to review and send.
export function noticeDraft(id) {
  const c = store.get("clients", id);
  if (!c || c.erased) return null;
  let text;
  try { text = fs.readFileSync(new URL("./privacy-notice.md", import.meta.url), "utf8"); } catch { return { error: "privacy-notice.md is missing" }; }
  const fill = { CLIENT: c.name.split(/\s/)[0], COMPANY: process.env.COMPANY_NAME || "Little Blue Door", CONTACT: process.env.PRIVACY_CONTACT || "[privacy contact email]", RETENTION_MONTHS };
  const body = text.replace(/\{\{(\w+)\}\}/g, (m, k) => fill[k] ?? m);
  return store.create("drafts", { to: c.email || c.phone, channel: c.email ? "email" : "whatsapp", recipientType: "client", clientId: id, kind: "privacy-notice", subject: "How we look after your information", body, status: "draft" });
}

export function report() {
  const clients = store.list("clients").filter((c) => !c.erased), cutoff = monthsAgo(RETENTION_MONTHS);
  const lastActivity = (c) => [c.createdAt?.slice(0, 10), ...store.list("events").filter((e) => e.clientId === c.id).map((e) => e.endDate || e.startDate)].filter(Boolean).sort().at(-1);
  const brief = (c, extra = {}) => ({ id: c.id, name: c.name, ...extra });
  return {
    retentionMonths: RETENTION_MONTHS,
    healthNoConsent: clients.filter((c) => hasHealth(c) && c.consentHealth !== "yes").map((c) => brief(c)),
    noPrivacyNotice: clients.filter((c) => !c.privacyNoticeAt).map((c) => brief(c)),
    retentionDue: clients.map((c) => brief(c, { last: lastActivity(c) })).filter((c) => c.last && c.last < cutoff),
    log: store.list("audit").filter((a) => a.action.startsWith("privacy.")).slice(-50).reverse(),
  };
}
