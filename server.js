import "./env.js";
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import { chat, radar, glance, budget, commission, growth, parseOption, PROVIDER, UPLOAD_DIR } from "./agent.js";
import * as store from "./store.js";
import * as inbox from "./inbox.js";
import * as users from "./auth.js";
import * as privacy from "./privacy.js";
import * as fx from "./fx.js";

const PASSCODE = process.env.APP_PASSCODE;
if (!PASSCODE || PASSCODE === "change-me") console.warn("⚠️  Set a real APP_PASSCODE in .env before sharing this app.");

const app = express();
app.use(express.json({ limit: "500kb", verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use((_, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" });
  next();
});
app.use(express.static("public"));

function auth(req, res, next) {
  const u = users.userFromSid(users.sidFrom(req));
  if (u) { req.user = u; return next(); }
  res.status(401).json({ error: "Please sign in", setup: users.needsSetup() });
}
const adminOnly = (req, res, next) => (req.user?.role === "admin" ? next() : res.status(403).json({ error: "Admins only" }));

// Basic CSRF guard: state-changing /api calls must come from this site.
app.use("/api", (req, res, next) => {
  if (req.method === "GET") return next();
  const origin = req.get("origin");
  if (origin && new URL(origin).host !== req.get("host")) return res.status(403).json({ error: "Cross-site request blocked" });
  next();
});

// ---- Accounts ----
app.get("/api/auth/me", (req, res) => {
  const u = users.userFromSid(users.sidFrom(req));
  res.json({ user: users.publicUser(u), setup: users.needsSetup() });
});
app.post("/api/auth/setup", (req, res) => {
  if (!users.needsSetup()) return res.status(400).json({ error: "Already set up — sign in instead." });
  const given = Buffer.from(String(req.body.passcode || "")), want = Buffer.from(PASSCODE || "");
  if (!want.length || given.length !== want.length || !crypto.timingSafeEqual(given, want)) return res.status(401).json({ error: "Wrong team passcode" });
  try {
    users.createUser({ ...req.body, role: "admin" });
    const { sid, user } = users.login(req.body.email, req.body.password);
    users.audit(user, "setup", "first admin created");
    res.set("Set-Cookie", users.cookie(sid)).json({ user: users.publicUser(user) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/auth/login", (req, res) => {
  try {
    const { sid, user } = users.login(req.body.email, req.body.password);
    users.audit(user, "login");
    res.set("Set-Cookie", users.cookie(sid)).json({ user: users.publicUser(user) });
  } catch (e) { res.status(401).json({ error: e.message }); }
});
app.post("/api/auth/logout", (req, res) => { users.logout(users.sidFrom(req)); res.set("Set-Cookie", users.cookie("", 0)).json({ ok: true }); });
app.get("/api/users", auth, adminOnly, (_, res) => res.json(store.list("users").map(users.publicUser)));
app.post("/api/users", auth, adminOnly, (req, res) => {
  try { const u = users.createUser(req.body); users.audit(req.user, "user.create", u.email); res.json(users.publicUser(u)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/users/:id/disable", auth, adminOnly, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't disable yourself" });
  store.update("users", req.params.id, { disabled: true });
  store.list("sessions").filter((s) => s.userId === req.params.id).forEach((s) => store.remove("sessions", s.id));
  users.audit(req.user, "user.disable", req.params.id); res.json({ ok: true });
});
app.get("/api/audit", auth, adminOnly, (_, res) => res.json(store.list("audit").slice(-200).reverse()));

// Simple per-IP rate limit: 30 chat calls / 5 min
const hits = new Map();
function limit(req, res, next) {
  const now = Date.now(), key = req.ip;
  const arr = (hits.get(key) || []).filter((t) => now - t < 300_000);
  if (arr.length >= 30) return res.status(429).json({ error: "Slow down a touch — try again in a few minutes." });
  arr.push(now); hits.set(key, arr); next();
}

app.post("/api/chat", auth, limit, async (req, res) => {
  const history = Array.isArray(req.body.messages) ? req.body.messages.slice(-30) : [];
  try {
    const { text, messages } = await chat(history);
    res.json({ text, messages });
  } catch (e) {
    console.error(e);
    const busy = e.status === 429 || e.status === 529;
    res.status(busy ? 503 : 500).json({ error: busy ? "Blue's a bit swamped right now — give it a minute and resend." : "Blue tripped over the doormat. Your message wasn't lost — tap send again." });
  }
});

app.get("/api/data", auth, (req, res) => res.json({ ...store.snapshot(), push: undefined, users: undefined, sessions: undefined, audit: undefined, me: users.publicUser(req.user), radar: radar(), glance: glance(),
  settings: undefined, fx: fx.rates(), currencies: fx.CURRENCIES, budgets: Object.fromEntries(store.list("events").map((e) => [e.id, budget(e.id)])) }));
app.get("/api/fx", auth, (_, res) => res.json(fx.rates()));
app.post("/api/fx", auth, adminOnly, (req, res) => { fx.setRates(req.body?.rates, "manual"); users.audit(req.user, "fx.update", Object.keys(req.body?.rates || {}).join(",")); res.json(fx.rates()); });
app.post("/api/fx/refresh", auth, adminOnly, async (req, res) => {
  try { await fx.fetchLatest(); users.audit(req.user, "fx.refresh", "ECB"); res.json(fx.rates()); }
  catch (e) { res.status(502).json({ error: `Couldn't fetch rates (${e.message}). Enter them by hand instead.` }); }
});

// Humans can tick tasks off directly.
app.post("/api/tasks/:id/done", auth, (req, res) => res.json(store.update("tasks", req.params.id, { status: "done" }) ?? { error: "not found" }));

// ---- Manual CRUD for the management pages (humans, behind the passcode) ----
const EDITABLE = ["events", "suppliers", "clients", "tasks", "drafts", "costs", "itinerary", "approvals", "proposals"];
const clean = (b) => { const { id, token, createdAt, updatedAt, ...rest } = b || {}; return rest; };
app.post("/api/rec/:col", auth, (req, res) => {
  if (!EDITABLE.includes(req.params.col)) return res.status(404).end();
  const rec = store.create(req.params.col, clean(req.body));
  users.audit(req.user, `${req.params.col}.create`, rec.name || rec.title || rec.item || rec.id); res.json(rec);
});
app.patch("/api/rec/:col/:id", auth, (req, res) => {
  if (!EDITABLE.includes(req.params.col)) return res.status(404).end();
  res.json(store.update(req.params.col, req.params.id, clean(req.body)) ?? { error: "not found" });
});
app.delete("/api/rec/:col/:id", auth, (req, res) => {
  if (!EDITABLE.includes(req.params.col)) return res.status(404).end();
  users.audit(req.user, `${req.params.col}.delete`, req.params.id);
  res.json({ deleted: store.remove(req.params.col, req.params.id) });
});
// New share link (old one stops working) — e.g. if a link went to the wrong person.
app.post("/api/rec/:col/:id/relink", auth, (req, res) => {
  if (!["events", "approvals", "proposals"].includes(req.params.col)) return res.status(404).end();
  res.json(store.relink(req.params.col, req.params.id) ?? { error: "not found" });
});

// Humans (not the agent) mark drafts as sent / approved.
app.post("/api/drafts/:id/status", auth, (req, res) => {
  const status = ["draft", "approved", "sent", "discarded"].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: "bad status" });
  const d = store.update("drafts", req.params.id, { status });
  if (d && status === "sent") noticeSent(d);
  if (d && status === "sent" && d.to) inbox.recordOutbound({ channel: d.channel || "email", to: d.to, body: d.body, draftId: d.id });
  res.json(d ?? { error: "not found" });
});

// ---- Inbox & WhatsApp ----
// Human taps "Send via WhatsApp" on a draft. Blue itself can never call this.
app.post("/api/drafts/:id/send", auth, async (req, res) => {
  const d = store.get("drafts", req.params.id);
  if (!d || d.status !== "draft") return res.status(400).json({ error: "Draft not found or already handled" });
  if (d.channel !== "whatsapp") return res.status(400).json({ error: "Only WhatsApp can be sent from Blue — use Open in app for email." });
  try {
    const waId = await inbox.sendWhatsApp(d.to, d.body);
    store.update("drafts", d.id, { status: "sent", sentAt: new Date().toISOString(), sentBy: req.user.name });
    users.audit(req.user, "whatsapp.send", d.to);
    noticeSent(d);
    inbox.recordOutbound({ channel: "whatsapp", to: d.to, body: d.body, draftId: d.id, waId });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/webhooks/whatsapp", (req, res) => {
  const ch = inbox.verifyWebhook(req.query);
  ch ? res.send(ch) : res.sendStatus(403);
});
app.post("/webhooks/whatsapp", (req, res) => {
  if (!inbox.validSignature(req.rawBody || Buffer.from(""), req.get("x-hub-signature-256"))) return res.sendStatus(401);
  res.sendStatus(200); // ack fast; Meta retries otherwise
  try { inbox.handleWhatsApp(req.body); } catch (e) { console.error("whatsapp webhook", e); }
});

// Inbound email: point an inbound-parse service (Postmark, Mailgun, SendGrid, Zapier…) here.
app.post("/webhooks/email", express.urlencoded({ extended: true, limit: "2mb" }), (req, res) => {
  const want = process.env.INBOUND_EMAIL_KEY;
  if (!want || req.query.key !== want) return res.sendStatus(401);
  const b = req.body || {};
  inbox.recordInbound({ channel: "email", from: b.From || b.from || b.sender, name: b.FromName || b.fromName || "", subject: b.Subject || b.subject, body: b.TextBody || b["stripped-text"] || b.text || b["body-plain"] || "" });
  res.sendStatus(200);
});

// Test without WhatsApp: pretend a customer or supplier just messaged.
app.post("/api/inbox/simulate", auth, (req, res) => {
  const { channel = "whatsapp", from, name, subject, body } = req.body || {};
  if (!from || !body) return res.status(400).json({ error: "from and body are required" });
  res.json(inbox.recordInbound({ channel, from, name, subject, body }));
});
app.post("/api/inbox/:id/status", auth, (req, res) => {
  const status = ["new", "triaged", "replied", "ignored"].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: "bad status" });
  if (status === "new") inbox.enqueueTriage(req.params.id);
  res.json(store.update("messages", req.params.id, { status }) ?? { error: "not found" });
});
app.post("/api/autopilot/run", auth, (_, res) => res.json(inbox.sweep()));
const AUTOPILOT_MIN = Number(process.env.AUTOPILOT_MINUTES || 30);
setInterval(() => { try { inbox.sweep(); } catch (e) { console.error("sweep", e); } }, AUTOPILOT_MIN * 60_000);

// ---- Public client pages (token links, no passcode; client-safe fields only) ----
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const page = (title, body, img) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} · Little Blue Door</title><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Montserrat:wght@400;500&display=swap" rel="stylesheet">
<style>body{margin:0;font:15px/1.6 Montserrat,sans-serif;background:#f6f5f2;color:#29282e}header{background:linear-gradient(180deg,rgba(29,32,41,.2),rgba(29,32,41,.8)),${img && /^https:\/\//.test(img) ? `url("${esc(img)}") center/cover` : "linear-gradient(180deg,#ffb88a,#f0756a 55%,#2f5b7a 56%,#272b37)"};color:#fff;padding:90px 20px 28px;text-align:center}
a.v{display:inline-block;margin-top:8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#131f5b}@media print{header{padding:24px;background:#272b37!important}button{display:none}}
.l{font-size:10px;letter-spacing:.32em;text-transform:uppercase;opacity:.75}h1,h2{font-family:"Cormorant Garamond",serif;font-weight:500;margin:6px 0}h1{font-size:34px}
main{max-width:560px;margin:auto;padding:16px}.c{background:#fff;border:1px solid #e2e1dc;padding:14px;margin:10px 0}.m{color:#6f7180;font-size:13px}
button{font:500 12px Montserrat;letter-spacing:.15em;text-transform:uppercase;background:#272b37;color:#fff;border:0;padding:14px;width:100%;margin:6px 0;cursor:pointer}</style></head>
<body><header><div class="l">Little Blue Door</div><h1>${esc(title)}</h1></header><main>${body}</main></body></html>`;

const KIND_ICON = { flight: "✈︎", transfer: "🚘", hotel: "🛏", dining: "🍽", activity: "✦", other: "•" };
const FILE_RE = /^[0-9a-f-]{36}\.(pdf|jpg|png|webp|gif)$/;
app.get("/t/:token", (req, res) => {
  const ev = store.byToken("events", req.params.token);
  if (!ev) return res.status(404).send(page("Not found", "<p>This link doesn't open any doors.</p>"));
  const items = store.list("itinerary", { eventId: ev.id }).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const today = new Date().toISOString().slice(0, 10);
  const nice = (d) => { const t = new Date(d + "T12:00:00Z"); return isNaN(t) ? esc(d) : t.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }); };
  let day = "";
  const list = items.map((i) => (i.date !== day ? `<h2>${(day = i.date) === today ? "Today" : nice(i.date)}</h2>` : "") +
    `<div class="c"><b>${KIND_ICON[i.kind] || ""} ${esc(i.time)}${i.endTime ? "–" + esc(i.endTime) : ""} ${esc(i.title)}</b><div class="m">${esc(i.location)}${i.supplierId && store.get("suppliers", i.supplierId) ? ` · with ${esc(store.get("suppliers", i.supplierId).name)}` : ""}</div>${i.guestIds?.length ? `<div class="m">For: ${i.guestIds.map((g) => esc(String(store.get("clients", g)?.name || "").split(" ")[0])).filter(Boolean).join(", ")}</div>` : ""}${i.confirmation ? `<div class="m">Ref: <b>${esc(i.confirmation)}</b></div>` : ""}${i.notes ? `<div style="white-space:pre-wrap">${esc(i.notes)}</div>` : ""}${i.voucher && FILE_RE.test(i.voucher) ? `<a class="v" href="/t/${esc(ev.token)}/v/${esc(i.voucher)}" target="_blank">Open voucher / ticket</a>` : ""}</div>`).join("");
  res.set("Cache-Control", "no-store").send(page(ev.name, `<p class="m" style="text-align:center">${esc(ev.location)} · ${esc(ev.startDate)}${ev.endDate ? " → " + esc(ev.endDate) : ""}</p>${list || "<p>Your itinerary is being crafted ✨</p>"}${ev.faq ? `<h2>Good to know</h2><div class="c" style="white-space:pre-wrap">${esc(ev.faq)}</div>` : ""}${items.length ? `<button onclick="location.href='/t/${esc(ev.token)}/trip.ics'">Add to my calendar</button>` : ""}<button onclick="print()">Print / save as PDF</button><p class="m" style="text-align:center">Tip: add it to your calendar or save the PDF before you fly, so you have everything offline.</p>`, ev.coverUrl));
});
// Whole trip as a calendar file: clients add it to their phone and have the plan offline.
app.get("/t/:token/trip.ics", (req, res) => {
  const ev = store.byToken("events", req.params.token);
  if (!ev) return res.sendStatus(404);
  const t = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
  const d = (date) => String(date || "").replace(/-/g, ""), hm = (x) => String(x || "").replace(":", "").padEnd(4, "0") + "00";
  const next = (date) => new Date(new Date(date + "T12:00:00Z").getTime() + 864e5).toISOString().slice(0, 10).replace(/-/g, "");
  const plusHour = (x) => { const [h, m] = String(x).split(":").map(Number); return h >= 23 ? "23:59" : `${String(h + 1).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`; };
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const items = store.list("itinerary", { eventId: ev.id }).filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.date || ""));
  const vevents = items.map((i) => ["BEGIN:VEVENT", `UID:${i.id}@littlebluedoor`, `DTSTAMP:${stamp}`,
    ...(i.time ? [`DTSTART:${d(i.date)}T${hm(i.time)}`, `DTEND:${d(i.date)}T${hm(i.endTime || plusHour(i.time))}`] : [`DTSTART;VALUE=DATE:${d(i.date)}`, `DTEND;VALUE=DATE:${next(i.date)}`]),
    `SUMMARY:${t(i.title)}`, i.location && `LOCATION:${t(i.location)}`,
    `DESCRIPTION:${t([i.confirmation && "Ref: " + i.confirmation, i.notes].filter(Boolean).join("\n"))}`, "END:VEVENT"].filter(Boolean).join("\r\n"));
  res.set({ "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="trip.ics"`, "Cache-Control": "no-store" })
    .send(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Little Blue Door//Blue//EN", `X-WR-CALNAME:${t(ev.name)}`, ...vevents, "END:VCALENDAR", ""].join("\r\n"));
});

// Post-trip feedback: same secret link as the trip page, one answer per trip.
app.get("/f/:token", (req, res) => {
  const ev = store.byToken("events", req.params.token);
  if (!ev) return res.status(404).send(page("Not found", "<p>This link doesn't open any doors.</p>"));
  if (ev.feedback) return res.send(page("Thank you", `<div class="c">Thank you, we've received your thoughts. We can't wait to plan the next one. ✨</div>`, ev.coverUrl));
  const stars = [5, 4, 3, 2, 1].map((n) => `<label style="display:block;margin:6px 0"><input type="radio" name="rating" value="${n}" required> ${"★".repeat(n)}${"☆".repeat(5 - n)}</label>`).join("");
  res.send(page("How was it?", `<form method="post"><p>We'd love to hear how <b>${esc(ev.name)}</b> went.</p><div class="c">${stars}</div>
    <div class="c"><label>The highlight?<textarea name="highlight" style="width:100%;min-height:70px;margin-top:6px"></textarea></label></div>
    <div class="c"><label>Anything we could do better?<textarea name="improve" style="width:100%;min-height:70px;margin-top:6px"></textarea></label></div>
    <div class="c"><label><input type="checkbox" name="testimonial" value="yes"> You may quote my highlight (first name only) as a testimonial</label></div>
    <button>Send</button></form>`, ev.coverUrl));
});
app.post("/f/:token", express.urlencoded({ extended: false, limit: "20kb" }), (req, res) => {
  const ev = store.byToken("events", req.params.token);
  const rating = Number(req.body.rating);
  if (ev && !ev.feedback && rating >= 1 && rating <= 5) {
    const clip = (x) => String(x || "").slice(0, 2000);
    store.update("events", ev.id, { feedback: { rating, highlight: clip(req.body.highlight), improve: clip(req.body.improve), testimonial: req.body.testimonial === "yes", at: new Date().toISOString() } });
    if (rating <= 3) store.create("tasks", { title: `⚠️ ${rating}★ feedback on ${ev.name}: call the client`, kind: "followup", priority: "high", eventId: ev.id, dueDate: new Date().toISOString().slice(0, 10), status: "todo" });
  }
  res.redirect(303, req.originalUrl);
});
app.post("/api/events/:id/feedback-request", auth, (req, res) => {
  const ev = store.get("events", req.params.id), c = ev && store.get("clients", ev.clientId);
  if (!ev) return res.status(404).json({ error: "not found" });
  const url = `${req.protocol}://${req.get("host")}/f/${ev.token}`;
  const d = store.create("drafts", { to: c?.email || c?.phone || "", channel: c?.email ? "email" : "whatsapp", recipientType: "client", eventId: ev.id, subject: `How was ${ev.name}?`, status: "draft",
    body: `Dear ${(c?.name || "").split(/\s/)[0] || "there"},\n\nWelcome home! We hope ${ev.name} was everything you dreamed of.\n\nWould you share how it went? It takes a minute and helps us make the next one even better:\n${url}\n\nWarmly,\nLittle Blue Door` });
  store.update("events", ev.id, { feedbackRequestedAt: new Date().toISOString() });
  res.json(d);
});

// Vouchers: only files attached to an itinerary item of THIS trip are reachable from its link.
app.get("/t/:token/v/:file", (req, res) => {
  const ev = store.byToken("events", req.params.token), f = req.params.file;
  if (!ev || !FILE_RE.test(f) || !store.list("itinerary", { eventId: ev.id }).some((i) => i.voucher === f)) return res.sendStatus(404);
  res.set("Cache-Control", "private, no-store").sendFile(path.join(UPLOAD_DIR, f));
});
app.get("/api/file/:file", auth, (req, res) => (FILE_RE.test(req.params.file) ? res.set("Cache-Control", "private, no-store").sendFile(path.join(UPLOAD_DIR, req.params.file)) : res.sendStatus(404)));

// Cost sheet: ?view=client shows only client prices; internal shows net, sell and margin. Print to PDF from the browser.
app.get("/api/events/:id/sheet", auth, (req, res) => {
  const ev = store.get("events", req.params.id);
  if (!ev) return res.status(404).send(page("Not found", ""));
  const client = req.query.view === "client", b = budget(ev.id), cur = b.currency;
  const fmt = (n) => new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(Number(n || 0));
  // Every line is converted into the trip's currency first; the internal view also shows the original amount.
  const sell = (c) => c.inTrip.sell || c.inTrip.contracted || c.inTrip.quoted, net = (c) => c.inTrip.contracted || c.inTrip.quoted;
  const orig = (c) => (c.currency !== cur ? `<div class="m">${esc(c.currency)} ${Number(c.sell || c.contracted || c.quoted || 0).toLocaleString("en-GB")} originally</div>` : "");
  const tot = (fn) => b.lines.reduce((a, c) => a + fn(c), 0);
  const rows = b.lines.map((c) => client ? `<tr><td>${esc(c.item)}</td><td align="right">${fmt(sell(c))}</td></tr>`
    : `<tr><td>${esc(c.item)}<div class="m">${esc(store.get("suppliers", c.supplierId)?.name || "")}</div>${orig(c)}</td><td align="right">${fmt(net(c))}</td><td align="right">${fmt(sell(c))}</td><td align="right">${fmt(sell(c) - net(c))}</td><td align="right">${fmt(c.inTrip.paid)}</td></tr>`).join("");
  const head = client ? "<tr><th align=left>Item</th><th align=right>Price</th></tr>" : "<tr><th align=left>Item</th><th align=right>Net</th><th align=right>Sell</th><th align=right>Margin</th><th align=right>Paid out</th></tr>";
  const foot = client ? `<tr><th align=left>Total</th><th align=right>${fmt(tot(sell))}</th></tr>`
    : `<tr><th align=left>Total</th><th align=right>${fmt(tot(net))}</th><th align=right>${fmt(tot(sell))}</th><th align=right>${fmt(tot(sell) - tot(net))}</th><th align=right>${fmt(b.paid)}</th></tr>
      <tr><td>Supplier commission (expected / received)</td><td></td><td></td><td align=right>${fmt(b.commission.expected)}</td><td align=right>${fmt(b.commission.received)}</td></tr>
      <tr><th align=left>Total earnings (margin + commission)</th><th></th><th></th><th align=right>${fmt(tot(sell) - tot(net) + b.commission.expected)}</th><th></th></tr>`;
  res.set("Cache-Control", "no-store").send(page(client ? ev.name : `${ev.name} · internal`, `<style>table{width:100%;border-collapse:collapse;background:#fff}td,th{padding:10px;border-bottom:1px solid #e2e1dc;font-size:14px}@media print{button{display:none}}</style>
    <p class="m" style="text-align:center">${esc(ev.location)} · ${esc(ev.startDate)}${ev.endDate ? " → " + esc(ev.endDate) : ""}${client ? "" : " · INTERNAL — do not share"}</p>
    ${b.missingRates.length ? `<div class="c" style="border-left:3px solid #b3413b">Missing exchange rate for ${esc(b.missingRates.join(", "))}: those lines are left out of the totals. An admin can add the rate under People → Exchange rates.</div>` : ""}<table>${head}${rows || `<tr><td>No cost lines yet</td></tr>`}${foot}</table><p class="m">Prepared ${new Date().toLocaleDateString("en-GB")}. All prices in ${esc(cur)}${b.lines.some((l) => l.currency !== cur) ? ", converted at our current exchange rates" : ""}.</p><button onclick="print()">Print / save as PDF</button>`));
});

// Proposals: tiered options the client chooses from. Choosing confirms the trip and queues the paperwork.
app.get("/p/:token", (req, res) => {
  const p = store.byToken("proposals", req.params.token), ev = p && store.get("events", p.eventId);
  if (!p) return res.status(404).send(page("Not found", "<p>This link doesn't open any doors.</p>"));
  const cur = ev?.currency || "EUR", fmt = (n) => new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
  const expired = p.validUntil && p.validUntil < new Date().toISOString().slice(0, 10);
  const opts = (p.options || []).map(parseOption);
  const body = p.choice ? `<div class="c">Wonderful — you chose <b>${esc(p.choice)}</b>. Your planner will be in touch shortly with the next steps. ✨</div>`
    : expired ? `<div class="c">This proposal has expired. Message your planner and we'll refresh availability and prices for you.</div>`
    : `${p.intro ? `<p style="white-space:pre-wrap">${esc(p.intro)}</p>` : ""}<form method="post">${opts.map((o) => `<div class="c"><h2 style="margin:0">${esc(o.name)}</h2>${o.price ? `<div class="m">${fmt(o.price)}</div>` : ""}<p style="white-space:pre-wrap">${esc(o.summary)}</p><button name="choice" value="${esc(o.name)}">Choose ${esc(o.name)}</button></div>`).join("")}</form>
      ${p.validUntil ? `<p class="m" style="text-align:center">Held for you until ${esc(p.validUntil)}. Prices depend on availability until confirmed.</p>` : ""}`;
  res.set("Cache-Control", "no-store").send(page(p.title || ev?.name || "Your proposal", body, ev?.coverUrl));
});
app.post("/p/:token", express.urlencoded({ extended: false }), (req, res) => {
  const p = store.byToken("proposals", req.params.token);
  const opt = p && (p.options || []).map(parseOption).find((o) => o.name === req.body.choice);
  if (p && !p.choice && opt && !(p.validUntil && p.validUntil < new Date().toISOString().slice(0, 10))) {
    const day = new Date().toISOString().slice(0, 10), ev = store.get("events", p.eventId);
    store.update("proposals", p.id, { choice: opt.name, price: opt.price, decidedAt: new Date().toISOString() });
    if (ev) store.update("events", ev.id, { status: "confirmed", ...(opt.price ? { budget: opt.price } : {}) });
    store.create("tasks", { title: `🎉 ${ev?.name || "Proposal"} accepted (${opt.name}): send contract & deposit request`, kind: "deadline", priority: "high", eventId: p.eventId, dueDate: day, status: "todo" });
    store.create("tasks", { title: `Confirm all ${opt.name} bookings with suppliers`, kind: "todo", priority: "high", eventId: p.eventId, dueDate: day, status: "todo" });
  }
  res.redirect(303, req.originalUrl);
});

// Templates: copy a past trip onto new dates. Bookings, refs, vouchers and payments are never copied.
app.post("/api/events/:id/duplicate", auth, (req, res) => {
  const src = store.get("events", req.params.id), start = String(req.body?.startDate || "");
  if (!src) return res.status(404).json({ error: "not found" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return res.status(400).json({ error: "Pick a start date" });
  const shift = src.startDate ? Math.round((new Date(start) - new Date(src.startDate)) / 864e5) : 0;
  const move = (d) => (d && shift ? new Date(new Date(d + "T12:00:00Z").getTime() + shift * 864e5).toISOString().slice(0, 10) : d);
  const { type, location, headcount, currency, faq, coverUrl } = src;
  const ev = store.create("events", { name: String(req.body.name || `${src.name} (copy)`).slice(0, 200), clientId: req.body.clientId || "", status: "planning", type, location, headcount, currency, faq, coverUrl, startDate: start, endDate: move(src.endDate), templateOf: src.id });
  for (const i of store.list("itinerary", { eventId: src.id })) {
    const { id, createdAt, updatedAt, confirmation, voucher, eventId, ...rest } = i;
    store.create("itinerary", { ...rest, eventId: ev.id, date: move(i.date) });
  }
  for (const c of store.list("costs", { eventId: src.id })) store.create("costs", { eventId: ev.id, supplierId: c.supplierId, item: c.item, quoted: c.contracted || c.quoted, sell: c.sell, commission: c.commission });
  users.audit(req.user, "events.duplicate", `${src.id} → ${ev.id}`);
  res.json(ev);
});
app.get("/api/growth", auth, (_, res) => res.json(growth()));

app.get("/a/:token", (req, res) => {
  const a = store.byToken("approvals", req.params.token);
  if (!a) return res.status(404).send(page("Not found", "<p>This link doesn't open any doors.</p>"));
  const body = a.choice ? `<div class="c">Thank you! You chose <b>${esc(a.choice)}</b>. We'll take it from here.</div>`
    : `<p>${esc(a.question)}</p><form method="post">${(a.options || []).map((o) => `<button name="choice" value="${esc(o)}">${esc(o)}</button>`).join("")}</form>`;
  res.send(page("Your choice", body));
});
app.post("/a/:token", express.urlencoded({ extended: false }), (req, res) => {
  const a = store.byToken("approvals", req.params.token);
  if (!a || a.choice || !(a.options || []).includes(req.body.choice)) return res.redirect(303, req.originalUrl);
  store.update("approvals", a.id, { choice: req.body.choice, decidedAt: new Date().toISOString() });
  res.redirect(303, req.originalUrl);
});

// ---- GDPR: consent report, subject access export, erasure ----
app.get("/api/privacy/report", auth, (_, res) => res.json(privacy.report()));
app.get("/api/clients/:id/export", auth, adminOnly, (req, res) => {
  const out = privacy.exportClient(req.params.id);
  if (!out) return res.status(404).json({ error: "not found" });
  users.audit(req.user, "privacy.export", `${out.client.name} (${req.params.id})`);
  res.attachment(`client-${req.params.id}-data.json`).json(out);
});
app.post("/api/clients/:id/erase", auth, adminOnly, (req, res) => {
  const c = store.get("clients", req.params.id);
  if (!c || c.erased) return res.status(404).json({ error: "not found" });
  if (String(req.body?.confirm || "").trim() !== c.name) return res.status(400).json({ error: "Type the client's exact name to confirm" });
  const r = privacy.eraseClient(c.id);
  users.audit(req.user, "privacy.erase", `client ${c.id}: ${r.messages} messages, ${r.drafts} drafts removed`); // no name: the log must not undo the erasure
  res.json({ ok: true, ...r });
});

app.post("/api/clients/:id/privacy-notice", auth, (req, res) => {
  const d = privacy.noticeDraft(req.params.id);
  if (!d) return res.status(404).json({ error: "not found" });
  if (d.error) return res.status(500).json(d);
  users.audit(req.user, "privacy.notice-drafted", req.params.id);
  res.json(d);
});
// Sending a privacy-notice draft records the date on the client.
function noticeSent(d) { if (d?.kind === "privacy-notice" && d.clientId) store.update("clients", d.clientId, { privacyNoticeAt: new Date().toISOString().slice(0, 10) }); }

// ---- Info / uploads / feedback / export ----
app.get("/api/info", auth, (_, res) => res.json({ encrypted: store.encrypted, provider: PROVIDER, briefTime: BRIEF_TIME, whatsapp: inbox.waEnabled(), triage: inbox.triageState(), autopilotMinutes: AUTOPILOT_MIN }));

const TYPES = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
app.post("/api/upload", auth, express.raw({ type: Object.keys(TYPES), limit: "10mb" }), (req, res) => {
  const ext = TYPES[req.get("content-type")];
  const sig = { pdf: "25504446", jpg: "ffd8ff", png: "89504e47", webp: "52494646", gif: "47494638" }[ext];
  if (!ext || !req.body?.length || !req.body.subarray(0, 4).toString("hex").startsWith(sig)) return res.status(400).json({ error: "Only PDF or images (JPG, PNG, WebP), up to 10 MB." });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const file = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, file), req.body);
  res.json({ file, type: req.get("content-type"), name: String(req.get("x-filename") || file).slice(0, 120) });
});

app.post("/api/feedback", auth, (req, res) => {
  const { helpful, question, answer, note } = req.body || {};
  res.json(store.create("feedback", { helpful: !!helpful, question: String(question || "").slice(0, 2000), answer: String(answer || "").slice(0, 4000), note: String(note || "").slice(0, 1000) }));
});

const csv = (rows) => {
  const keys = [...new Set(rows.flatMap(Object.keys))].filter((k) => k !== "token");
  const cell = (v) => `"${String(typeof v === "object" ? JSON.stringify(v) : v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((r) => keys.map((k) => cell(r[k])).join(","))].join("\n");
};
app.get("/api/export/:col", auth, (req, res) => {
  const col = req.params.col;
  if (["all", "clients", "messages", "drafts"].includes(col) && req.user.role !== "admin") return res.status(403).json({ error: "Admins only: this export contains client personal data" });
  users.audit(req.user, "privacy.bulk-export", col);
  if (col === "all") return res.attachment("blue-export.json").json({ ...store.snapshot(), push: undefined, users: undefined, sessions: undefined });
  if (!store.COLLECTIONS.includes(col) || ["push", "users", "sessions"].includes(col)) return res.status(404).end();
  res.attachment(`blue-${col}.csv`).type("text/csv").send(csv(store.list(col)));
});

// ---- Morning brief push notifications ----
const BRIEF_TIME = process.env.BRIEF_TIME || "08:00";
const VAPID_FILE = path.resolve("data/vapid.json");
fs.mkdirSync("data", { recursive: true });
if (!fs.existsSync(VAPID_FILE)) fs.writeFileSync(VAPID_FILE, JSON.stringify(webpush.generateVAPIDKeys()));
const vapid = JSON.parse(fs.readFileSync(VAPID_FILE, "utf8"));
webpush.setVapidDetails(process.env.PUSH_CONTACT || "mailto:team@littlebluedoor.co", vapid.publicKey, vapid.privateKey);

app.get("/api/push/key", auth, (_, res) => res.json({ key: vapid.publicKey }));
app.post("/api/push/subscribe", auth, (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint?.startsWith("https://")) return res.status(400).json({ error: "bad subscription" });
  if (!store.list("push").some((p) => p.endpoint === sub.endpoint)) store.create("push", sub);
  res.json({ ok: true });
});

function briefText() {
  const r = radar(), g = glance();
  const bits = [];
  if (g.arrivals.length) bits.push(`${g.arrivals.length} arriving`);
  if (g.passport.length) bits.push(`⚠️ ${g.passport.length} passport alerts`);
  if (g.unconfirmed.length) bits.push(`${g.unconfirmed.length} unconfirmed bookings`);
  if (g.draftsWaiting) bits.push(`${g.draftsWaiting} drafts to approve`);
  if (r.overdue.length) bits.push(`${r.overdue.length} overdue`);
  if (r.balancesDue.length) bits.push(`${r.balancesDue.length} balances due`);
  bits.push(`${r.next7days.length} due this week`);
  if (r.openChases.length) bits.push(`${r.openChases.length} suppliers to chase`);
  if (r.pendingApprovals.length) bits.push(`${r.pendingApprovals.length} client approvals pending`);
  const top = [...r.overdue, ...r.next7days][0];
  return bits.join(" · ") + (top ? `\nFirst up: ${top.title}` : "\nAll quiet. Go get a coffee ☕");
}
async function sendBrief() {
  const payload = JSON.stringify({ title: "Good morning from Blue 🚪", body: briefText(), url: "/" });
  for (const sub of store.list("push")) {
    try { await webpush.sendNotification(sub, payload); }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) store.remove("push", sub.id); } // expired device
  }
}
app.post("/api/push/test", auth, async (_, res) => { await sendBrief(); res.json({ ok: true, text: briefText() }); });

let lastBrief = "";
setInterval(() => {
  const now = new Date(), hhmm = now.toTimeString().slice(0, 5), day = now.toDateString();
  if (hhmm === BRIEF_TIME && lastBrief !== day) { lastBrief = day; sendBrief().catch(console.error); }
}, 30_000);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚪 Blue is at http://localhost:${port} (brain: ${PROVIDER}, morning brief ${BRIEF_TIME})`));
