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
