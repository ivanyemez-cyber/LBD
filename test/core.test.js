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

test("encryption at rest: db file is unreadable without the key and round-trips with it", async () => {
  const { execFileSync } = await import("node:child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blue-enc-"));
  const storePath = new URL("../store.js", import.meta.url).href;
  const run = (code, key) => execFileSync(process.execPath, ["--input-type=module", "-e", `const s = await import(${JSON.stringify(storePath)}); ${code}`], { cwd: dir, env: { ...process.env, DATA_KEY: key || "" }, encoding: "utf8" });
  run(`s.create("clients", { name: "Secret Sam" });`, "a-long-test-secret");
  const raw = fs.readFileSync(path.join(dir, "data/db.json"), "utf8");
  assert.ok(!raw.includes("Secret Sam") && raw.includes("aes-256-gcm"));
  assert.match(run(`console.log(s.list("clients")[0].name)`, "a-long-test-secret"), /Secret Sam/);
  assert.throws(() => run(`s.list("clients")`, "wrong-key"), /./);
  assert.throws(() => run(`s.list("clients")`, ""), /./);
});

test("erasure also strips the name from linked event names and notes; privacy notice draft is filled in", async () => {
  const privacy = await import("../privacy.js");
  const c = store.create("clients", { name: "Maria Lopez", email: "maria@x.co" });
  const e = store.create("events", { name: "Maria & Jo · Lisbon", notes: "Maria Lopez prefers aisle", clientId: c.id });
  const d = privacy.noticeDraft(c.id);
  assert.equal(d.kind, "privacy-notice");
  assert.ok(d.body.includes("Dear Maria") && !d.body.includes("{{"));
  privacy.eraseClient(c.id);
  const after = store.get("events", e.id);
  assert.equal(after.name, "[client] & Jo · Lisbon");
  assert.ok(!after.notes.includes("Maria"));
});

test("commission: supplier % by default, line % overrides, received reduces outstanding; ended trips need feedback", async () => {
  const { commission, glance } = await import("../agent.js");
  const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const sup = store.create("suppliers", { name: "Comm Hotel", commission: 10 });
  const e = store.create("events", { name: "Comm Trip", startDate: d(-5), endDate: d(-2), status: "completed" });
  store.create("costs", { eventId: e.id, supplierId: sup.id, item: "Rooms", contracted: 1000 });
  store.create("costs", { eventId: e.id, supplierId: sup.id, item: "Spa", contracted: 500, commission: 20, commissionReceived: 30 });
  const c = commission(e.id);
  assert.equal(c.expected, 200);
  assert.equal(c.outstanding, 170);
  const g = glance();
  assert.ok(g.feedbackDue.some((x) => x.id === e.id));
  assert.ok(g.commissionDue.some((x) => x.id === e.id && x.outstanding === 170));
  store.update("events", e.id, { feedback: { rating: 5 } });
  assert.ok(!glance().feedbackDue.some((x) => x.id === e.id));
});

test("growth: pipeline, rebook and referral opportunities; proposal options parse", async () => {
  const { growth, parseOption } = await import("../agent.js");
  assert.deepEqual(parseOption("Signature | €52,000 | Villa | chef"), { name: "Signature", price: 52000, summary: "Villa | chef" });
  const d = (n, yearsBack = 0) => { const x = new Date(Date.now() + n * 864e5); x.setFullYear(x.getFullYear() - yearsBack); return x.toISOString().slice(0, 10); };
  const c = store.create("clients", { name: "Grow Client" });
  const q = store.create("events", { name: "Grow Quote", status: "quoted", budget: 1000 });
  store.create("proposals", { eventId: q.id, title: "P", options: ["A | 5000 | x", "B | 9000 | y"] });
  const past = store.create("events", { name: "Grow Past", status: "completed", clientId: c.id, startDate: d(10, 1), endDate: d(12, 1), feedback: { rating: 5 } });
  const g = growth();
  assert.ok(g.pipeline.value >= 9000);
  assert.ok(g.opportunities.some((o) => o.kind === "rebook" && o.eventId === past.id));
  assert.ok(g.opportunities.some((o) => o.kind === "referral" && o.eventId === past.id));
  store.create("events", { name: "Grow Next", status: "planning", clientId: c.id, startDate: d(30) });
  assert.ok(!growth().opportunities.some((o) => o.kind === "rebook" && o.eventId === past.id)); // already booked again
});

test("growth: anniversary pitch is only suppressed by a trip near the anniversary", async () => {
  const { growth } = await import("../agent.js");
  const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const c = store.create("clients", { name: "Anni Client", anniversary: "2015-" + d(45).slice(5) });
  store.create("events", { name: "Anni Soon Trip", clientId: c.id, status: "confirmed", startDate: d(2), endDate: d(4) });
  assert.ok(growth().opportunities.some((o) => o.kind === "anniversary" && o.clientId === c.id));
  store.create("events", { name: "Anni Trip", clientId: c.id, status: "planning", startDate: d(44), endDate: d(47) });
  assert.ok(!growth().opportunities.some((o) => o.kind === "anniversary" && o.clientId === c.id));
});

test("travellers: guests get passport checks, export includes guest trips, erasure removes them from parties", async () => {
  const { glance } = await import("../agent.js");
  const privacy = await import("../privacy.js");
  const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const lead = store.create("clients", { name: "Lead Lena" });
  const guest = store.create("clients", { name: "Guest Gus", passportExpiry: d(30) });
  const e = store.create("events", { name: "Party Trip", clientId: lead.id, guestIds: [guest.id], startDate: d(5), endDate: d(8), status: "confirmed" });
  const i = store.create("itinerary", { eventId: e.id, date: d(5), kind: "dining", title: "Dinner", guestIds: [guest.id] });
  assert.ok(glance().passport.some((p) => p.clientId === guest.id && p.eventId === e.id));
  assert.ok(privacy.exportClient(guest.id).events.some((x) => x.id === e.id));
  privacy.eraseClient(guest.id);
  assert.deepEqual(store.get("events", e.id).guestIds, []);
  assert.deepEqual(store.get("itinerary", i.id).guestIds, []);
  assert.equal(store.get("events", e.id).name, "Party Trip"); // the lead's trip name is untouched
});
