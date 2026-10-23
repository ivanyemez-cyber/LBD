// Run with: npm test  (uses a throwaway data dir)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blue-test-"));
process.chdir(tmp);
const store = await import("../store.js");
const { redact } = await import("../agent.js");
const inbox = await import("../inbox.js");
const users = await import("../auth.js");

test("redacts card numbers and IBANs", () => {
  const out = redact("card 4111 1111 1111 1111 and iban PT50000201231234567890154");
  assert.ok(!out.includes("4111"));
  assert.ok(out.includes("[redacted-card]") && out.includes("[redacted-iban]"));
});

test("thread keys normalise phones and emails", () => {
  assert.equal(inbox.threadKey("+351 912 345 678"), "351912345678");
  assert.equal(inbox.threadKey("Sara <SARA@Example.com>"), "sara@example.com");
});

test("share tokens survive updates and can be rotated", () => {
  const e = store.create("events", { name: "T" });
  const t = e.token;
  store.update("events", e.id, { token: "hacked", name: "T2" });
  assert.equal(store.get("events", e.id).token, t);
  assert.notEqual(store.relink("events", e.id).token, t);
});

test("autopilot flags a quiet supplier once, with a nudge draft", () => {
  const sup = store.create("suppliers", { name: "Slow Co", email: "slow@x.com" });
  store.create("messages", { direction: "out", channel: "email", to: "slow@x.com", threadKey: "slow@x.com", body: "hi", at: new Date(Date.now() - 72 * 36e5).toISOString(), supplierId: sup.id, party: "supplier" });
  const first = inbox.sweep().created.filter((t) => t.includes("Slow Co"));
  const second = inbox.sweep().created.filter((t) => t.includes("Slow Co"));
  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
  assert.ok(store.list("drafts").some((d) => d.to === "slow@x.com" && d.status === "draft"));
});

test("autopilot flags events with no budget", () => {
  store.create("events", { name: "No Budget Gala", status: "planning", startDate: "2030-01-01", headcount: 10, location: "X" });
  assert.ok(inbox.sweep().created.some((t) => t.includes("Clarify budget for No Budget Gala")));
});

test("duplicate WhatsApp webhook deliveries are ignored", () => {
  const p = { entry: [{ changes: [{ value: { messages: [{ from: "447700900999", id: "wamid.T1", type: "text", text: { body: "hello" } }] } }] }] };
  inbox.handleWhatsApp(p); inbox.handleWhatsApp(p);
  assert.equal(store.list("messages").filter((m) => m.waId === "wamid.T1").length, 1);
});

test("webhook signature check", () => {
  process.env.NODE_ENV = "production";
  assert.equal(inbox.validSignature(Buffer.from("{}"), "sha256=bad"), false); // no secret configured → reject in production
});

test("accounts: strong-ish passwords, login, lockout", () => {
  assert.throws(() => users.createUser({ name: "A", email: "a@b.co", password: "short" }));
  users.createUser({ name: "A", email: "a@b.co", password: "long-enough-pw" });
  const { sid } = users.login("A@B.co", "long-enough-pw");
  assert.equal(users.userFromSid(sid).email, "a@b.co");
  for (let i = 0; i < 8; i++) assert.throws(() => users.login("a@b.co", "wrong"));
  assert.throws(() => users.login("a@b.co", "long-enough-pw"), /Too many/);
});

test("today at a glance: arrivals, passport 6-month rule, unconfirmed bookings", async () => {
  const { glance } = await import("../agent.js");
  const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const c = store.create("clients", { name: "Glance Client", passportExpiry: d(60), birthday: "1980-" + d(3).slice(5) });
  const e = store.create("events", { name: "Glance Trip", clientId: c.id, startDate: d(1), endDate: d(5), status: "confirmed" });
  store.create("itinerary", { eventId: e.id, date: d(1), kind: "transfer", title: "Driver" });
  store.create("itinerary", { eventId: e.id, date: d(1), kind: "flight", title: "Flight", confirmation: "ABC123" });
  const g = glance();
  assert.ok(g.arrivals.some((x) => x.id === e.id));
  assert.ok(g.passport.some((x) => x.clientId === c.id));
  assert.ok(g.celebrations.some((x) => x.clientId === c.id && x.what === "birthday"));
  assert.deepEqual(g.unconfirmed.filter((i) => i.eventId === e.id).map((i) => i.title), ["Driver"]);
  store.update("clients", c.id, { passportExpiry: d(400) });
  assert.ok(!glance().passport.some((x) => x.clientId === c.id));
});

test("GDPR: AI sees a minimised client, export and erasure work", async () => {
  const privacy = await import("../privacy.js");
  const c = store.create("clients", { name: "Erin Erase", email: "erin@x.co", phone: "+44 7700 900111", dietary: "Nut allergy", emergency: "Mum 0123", passportExpiry: "2030-01-01" });
  const ai = privacy.forAgent(c);
  assert.equal(ai.emergency, undefined);
  assert.equal(ai.passportExpiry, undefined);
  assert.ok(!ai.dietary.includes("Nut"));
  assert.equal(privacy.forAgent({ ...c, consentHealth: "yes" }).dietary, "Nut allergy");
  assert.ok(privacy.report().healthNoConsent.some((x) => x.id === c.id));
  const e = store.create("events", { name: "Erin trip", clientId: c.id });
  store.create("costs", { eventId: e.id, item: "Hotel", contracted: 100 });
  store.create("messages", { direction: "in", channel: "whatsapp", from: "447700900111", threadKey: "447700900111", body: "hi" });
  store.create("drafts", { to: "erin@x.co", body: "hello", status: "draft" });
  store.create("audit", { action: "clients.create", detail: "Erin Erase" });
  const out = privacy.exportClient(c.id);
  assert.equal(out.messages.length, 1);
  assert.equal(out.drafts.length, 1);
  assert.ok(!JSON.stringify(out.events).includes("token"));
  assert.deepEqual(privacy.eraseClient(c.id), { messages: 1, drafts: 1 });
  const after = store.get("clients", c.id);
  assert.ok(after.erased && !JSON.stringify(after).includes("Erin") && !after.dietary);
  assert.equal(store.list("costs", { eventId: e.id }).length, 1); // accounting records kept
  assert.ok(!JSON.stringify(store.list("audit")).includes("Erin Erase"));
  assert.equal(privacy.eraseClient(c.id), null);
});

test("data gaps: untyped items and missing passport expiry are flagged", async () => {
  const { dataGaps } = await import("../agent.js");
  const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const c = store.create("clients", { name: "Gap Client" });
  const e = store.create("events", { name: "Gap Trip", type: "trip", clientId: c.id, startDate: d(5), status: "confirmed" });
  store.create("itinerary", { eventId: e.id, date: d(5), title: "Something" });
  const texts = dataGaps().filter((g) => g.eventId === e.id).map((g) => g.text).join(" | ");
  assert.match(texts, /no type/);
  assert.match(texts, /no flight, transfer or hotel/);
  assert.match(texts, /No passport expiry/);
});
