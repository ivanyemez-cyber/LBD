// Management pages: events, trips, clients, suppliers, tasks — usable without the AI.
// Relies on globals from index.html: $, esc, api, data, refresh, share, ask, empty, done.

document.head.insertAdjacentHTML("beforeend", `<style>
.sheet{position:fixed;inset:0;background:var(--bg);z-index:8;display:flex;flex-direction:column;animation:up .18s ease-out}
@keyframes up{from{transform:translateY(24px);opacity:0}}
.sheet>header{gap:10px}.sheet>header button{background:none;border:0;color:#fff;font-size:22px;padding:0 6px}
.sheet .body{flex:1;overflow:auto;padding:14px 16px 40px}
.tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--line);margin:4px -16px 10px;padding:0 16px}
.tabs button{flex:none;background:none;border:0;border-bottom:2px solid transparent;padding:10px 8px;color:var(--muted);font:500 10px Montserrat,sans-serif;letter-spacing:.18em;text-transform:uppercase}
.tabs button.on{color:var(--ink);border-color:var(--gold)}
.bar{display:flex;gap:8px;align-items:center;margin-bottom:6px}
.bar input{flex:1;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:10px 12px;font:inherit;border-radius:2px}
.add{border:0;background:var(--slate);color:#fff;padding:10px 14px;font:500 11px Montserrat,sans-serif;letter-spacing:.14em;text-transform:uppercase;border-radius:2px;white-space:nowrap}
.filters{display:flex;gap:6px;overflow-x:auto;padding:4px 0 6px}
.filters button{flex:none;border:1px solid var(--line);background:var(--card);color:var(--muted);padding:5px 10px;font:500 10px Montserrat,sans-serif;letter-spacing:.12em;text-transform:uppercase;border-radius:2px}
.filters button.on{background:var(--slate);color:#fff;border-color:var(--slate)}
.card.click{cursor:pointer}.card.click:active{transform:scale(.99)}
.f{display:block;margin:0 0 12px}.f span{display:block;font:500 10px Montserrat,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.f input,.f select,.f textarea{width:100%;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:10px 12px;font:inherit;border-radius:2px}
.f textarea{min-height:90px;resize:vertical}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:8px 0}
.stat{background:var(--card);border:1px solid var(--line);padding:10px}.stat b{display:block;font:600 22px "Cormorant Garamond",Georgia,serif}
.bar-track{height:6px;background:var(--line);margin:6px 0}.bar-fill{height:100%;background:var(--accent)}
.danger{color:#b3413b!important;border-color:#b3413b!important}
.tl{border-left:1px solid var(--line);margin-left:6px;padding-left:14px}
.tl h5{font:500 10px Montserrat,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin:14px 0 4px}
</style>`);

// ---------- Schemas ----------
const STATUS_EVENT = ["enquiry", "planning", "quoted", "confirmed", "in progress", "completed", "cancelled"];
const SCHEMA = {
  events: { title: "Event / trip", fields: [
    ["name", "Name"], ["type", "Type", ["trip", "wedding", "retreat", "corporate", "party", "honeymoon", "other"]],
    ["status", "Status", STATUS_EVENT], ["clientId", "Lead client", "ref:clients"], ["guestIds", "Other travellers / guests", "multi:clients"], ["supplierIds", "Suppliers on this trip", "multi:suppliers"],
    ["startDate", "Start", "date"], ["endDate", "End", "date"], ["location", "Destination / venue"],
    ["headcount", "Guests", "number"], ["budget", "Budget", "number"], ["currency", "Currency", ["EUR", "USD", "GBP"]],
    ["coverUrl", "Cover photo URL (https://…, optional)", "url"], ["faq", "Good to know (shown on client trip page)", "textarea"], ["notes", "Internal notes", "textarea"]] },
  clients: { title: "Client", fields: [
    ["name", "Name"], ["email", "Email", "email"], ["phone", "Phone", "tel"], ["company", "Company"],
    ["preferences", "Preferences & style", "textarea"], ["dietary", "Dietary & allergies", "textarea"], ["drinks", "Favourite drinks (wine, champagne…)"],
    ["roomPrefs", "Room preferences (pillows, floor, bed…)", "textarea"], ["birthday", "Birthday", "date"], ["anniversary", "Anniversary", "date"],
    ["nationality", "Nationality"], ["passportExpiry", "Passport expiry (date only — never store the number)", "date"],
    ["loyalty", "Frequent flyer & hotel loyalty IDs", "textarea"], ["assistant", "PA / EA contact", "textarea"], ["emergency", "Emergency contact", "textarea"],
    ["consentHealth", "Explicit consent to keep dietary / allergy (health) data", ["yes", "no"]], ["consentDate", "Consent given on", "date"],
    ["privacyNoticeAt", "Privacy notice sent on", "date"], ["notes", "Internal notes", "textarea"]] },
  suppliers: { title: "Supplier", fields: [
    ["name", "Name"], ["category", "Category", ["venue", "hotel", "villa", "yacht", "DMC", "concierge", "chauffeur", "security", "catering", "transport", "flights", "boats", "photography", "music", "florist", "activities", "other"]],
    ["contactName", "Direct contact (name)"], ["contactRole", "Their role (GM, head concierge…)"], ["email", "Email", "email"], ["phone", "Phone", "tel"], ["location", "Destination (Ibiza, Amalfi, Paris…)"],
    ["commission", "Commission %", "number"], ["paymentTerms", "Payment terms & method"],
    ["rating", "Rating", ["1", "2", "3", "4", "5"]], ["responsiveness", "Responsiveness", ["fast", "ok", "slow"]], ["notes", "Notes", "textarea"]] },
  tasks: { title: "Task", fields: [
    ["title", "Task"], ["kind", "Type", ["todo", "chase", "deadline", "followup"]], ["status", "Status", ["todo", "waiting", "done"]],
    ["priority", "Priority", ["low", "med", "high"]], ["dueDate", "Due", "date"], ["eventId", "Event", "ref:events"], ["supplierId", "Supplier", "ref:suppliers"]] },
  itinerary: { title: "Itinerary item", fields: [
    ["date", "Date", "date"], ["kind", "Type", ["flight", "transfer", "hotel", "dining", "activity", "other"]], ["time", "Start", "time"], ["endTime", "End", "time"],
    ["title", "What"], ["location", "Where"], ["supplierId", "Supplier (hotel, driver, restaurant…)", "ref:suppliers"], ["guestIds", "Only for these travellers (leave empty = everyone)", "multi:clients"], ["confirmation", "Confirmation / booking ref"], ["voucher", "Voucher or ticket (PDF / image — the client can open it)", "upload"],
    ["notes", "Notes (client can see this)", "textarea"], ["eventId", "Event", "ref:events"]] },
  costs: { title: "Cost line", fields: [
    ["item", "Item"], ["supplierId", "Supplier", "ref:suppliers"], ["quoted", "Quoted", "number"], ["contracted", "Contracted (our net cost)", "number"], ["sell", "Price to client", "number"],
    ["commission", "Commission % (blank = supplier's agreed %)", "number"], ["commissionReceived", "Commission received", "number"],
    ["paid", "Paid", "number"], ["dueDate", "Balance due", "date"], ["eventId", "Event", "ref:events"]] },
  proposals: { title: "Proposal", fields: [["title", "Title (e.g. Amalfi anniversary — three ways)"], ["intro", "Intro note to the client", "textarea"],
    ["options", "Options, one per line: Name | price | what's included", "lines"], ["validUntil", "Held until", "date"], ["eventId", "Event", "ref:events"]] },
  approvals: { title: "Client approval", fields: [["question", "Question for the client"], ["options", "Options (one per line)", "lines"], ["eventId", "Event", "ref:events"]] },
};
const nameOf = (col, id) => (data[col] || []).find((r) => r.id === id)?.name || "";
const money = (n, cur = "EUR") => new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(Number(n || 0));
const today = () => new Date().toISOString().slice(0, 10);

// ---------- Sheet (full-screen page) stack ----------
const stack = [];
function openSheet(render) { stack.push(render); drawSheet(); }
function closeSheet() { stack.pop(); pendingLink = null; drawSheet(); }
function drawSheet() {
  document.querySelector(".sheet")?.remove();
  const render = stack.at(-1); if (!render) return;
  const { title, body } = render();
  document.body.insertAdjacentHTML("beforeend", `<div class="sheet"><header><button onclick="closeSheet()" aria-label="Back">‹</button><div><small class="label">Little Blue Door</small><b>${esc(title)}</b></div></header><div class="body">${body}</div></div>`);
}
async function reloadAll() { await refresh(); drawSheet(); }

// ---------- Generic form ----------
function field([k, label, type], val) {
  const v = val ?? "";
  if (Array.isArray(type)) return `<label class="f"><span>${label}</span><select name="${k}"><option value=""></option>${type.map((o) => `<option ${String(v) === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>`;
  if (type?.startsWith("multi:")) {
    const col = type.slice(6), on = new Set(Array.isArray(v) ? v : []);
    const opts = data[col].filter((r) => !r.erased).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return `<div class="f"><span>${label}</span><div style="max-height:180px;overflow:auto;border:1px solid var(--line);background:var(--card);padding:6px 10px">${opts.map((r) => `<label style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" name="${k}" value="${r.id}" ${on.has(r.id) ? "checked" : ""} style="width:auto">${esc(r.name)}${r.category ? ` <span class="meta">· ${esc(r.category)}</span>` : ""}</label>`).join("") || '<span class="meta">None yet</span>'}</div></div>`;
  }
  if (type?.startsWith("ref:")) {
    const col = type.slice(4);
    return `<label class="f"><span>${label}</span><select name="${k}"><option value="">—</option>${data[col].map((r) => `<option value="${r.id}" ${v === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>`;
  }
  if (type === "upload") return `<label class="f"><span>${label}</span><input type="hidden" name="${k}" value="${esc(v)}"><input type="file" accept="application/pdf,image/*" onchange="attach(this)">${v ? `<a href="/api/file/${esc(v)}" target="_blank">Current file</a> · <a href="#" onclick="this.parentNode.querySelector('[type=hidden]').value='';this.parentNode.querySelector('a').remove();this.remove();return false">remove</a>` : ""}</label>`;
  if (type === "textarea" || type === "lines") return `<label class="f"><span>${label}</span><textarea name="${k}">${esc(Array.isArray(v) ? v.join("\n") : v)}</textarea></label>`;
  return `<label class="f"><span>${label}</span><input name="${k}" type="${type || "text"}" value="${esc(v)}"></label>`;
}
function openForm(col, id, preset = {}) {
  const rec = id ? data[col].find((r) => r.id === id) : preset;
  openSheet(() => ({
    title: (id ? "Edit " : "New ") + SCHEMA[col].title.toLowerCase(),
    body: `<form onsubmit="saveForm(event,'${col}','${id || ""}')">${SCHEMA[col].fields.map((f) => field(f, rec?.[f[0]])).join("")}
      <div class="row"><button class="add" style="flex:1">Save</button>${id ? `<button type="button" class="danger" onclick="delRec('${col}','${id}')">Delete</button>` : ""}</div></form>`,
  }));
}
async function attach(input) {
  const f = input.files[0]; if (!f) return;
  const r = await fetch("/api/upload", { method: "POST", headers: { "content-type": f.type, "x-filename": encodeURIComponent(f.name) }, body: f });
  const j = await r.json();
  if (!r.ok) { input.value = ""; return alert(j.error || "Upload failed"); }
  input.previousElementSibling.value = j.file;
}
// Gentle guardrails: Today at a glance only works when bookings are typed and confirmed.
const checks = {
  itinerary: (b) => !b.kind ? "No type set. Flights, transfers and hotels need a type, or Today at a glance can't track them."
    : ["flight", "transfer", "hotel"].includes(b.kind) && !b.confirmation ? "No confirmation ref. This booking will show as UNCONFIRMED until one is added." : "",
  clients: (b) => b.dietary && b.consentHealth !== "yes" ? "Dietary / allergy details are health data under GDPR. Only keep them once the client has given explicit consent (set the consent field to yes, with the date)." : "",
};
async function saveForm(e, col, id) {
  e.preventDefault();
  const body = {};
  for (const [k, , type] of SCHEMA[col].fields) {
    if (typeof type === "string" && type.startsWith("multi:")) { body[k] = [...e.target.querySelectorAll(`[name="${k}"]:checked`)].map((x) => x.value); continue; }
    let v = e.target.querySelector(`[name="${k}"]`).value.trim(); // not elements[k]: "item" clashes with elements.item()
    if (type === "number" && v !== "") v = Number(v);
    if (type === "lines") v = v.split("\n").map((s) => s.trim()).filter(Boolean);
    body[k] = v;
  }
  const warn = checks[col]?.(body);
  if (warn && !confirm(warn + "\n\nSave anyway?")) return;
  if (!body[SCHEMA[col].fields[0][0]] || (Array.isArray(body[SCHEMA[col].fields[0][0]]) && !body[SCHEMA[col].fields[0][0]].length)) return alert(SCHEMA[col].fields[0][1] + " is required");
  const r = await fetch(id ? `/api/rec/${col}/${id}` : `/api/rec/${col}`, { method: id ? "PATCH" : "POST", headers: { "content-type": "application/json", "x-passcode": pass }, body: JSON.stringify(body) });
  const link = pendingLink; pendingLink = null;
  if (!id && link?.col === col && r.ok) {
    const rec = await r.json(), ev = data.events.find((x) => x.id === link.eventId);
    if (ev) await fetch(`/api/rec/events/${ev.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ [link.field]: [...new Set([...(ev[link.field] || []), rec.id])] }) });
  }
  stack.pop(); await reloadAll();
}
async function delRec(col, id) {
  if (!confirm("Delete this for good? (Daily backups are kept for 14 days.)")) return;
  await fetch(`/api/rec/${col}/${id}`, { method: "DELETE", headers: { "x-passcode": pass } });
  stack.pop(); if (["events", "clients", "suppliers"].includes(col) && stack.length) stack.pop();
  await reloadAll();
}
async function relink(col, id) {
  if (!confirm("Create a new link? The old link will stop working.")) return;
  await fetch(`/api/rec/${col}/${id}/relink`, { method: "POST", headers: { "x-passcode": pass } });
  await reloadAll();
}

// ---------- Card helpers ----------
const eventCard = (e) => `<div class="card click" onclick="openEvent('${e.id}')">${cover(e)}<h4>${esc(e.name)}</h4>
  <div class="meta">${esc(e.location || "TBC")} · ${esc(e.startDate || "dates TBC")}${e.endDate ? " → " + esc(e.endDate) : ""} · ${esc(e.headcount || "?")} guests${e.clientId ? " · " + esc(nameOf("clients", e.clientId)) : ""}</div>
  ${e.status ? `<span class="pill">${esc(e.status)}</span>` : ""} ${e.type ? `<span class="pill">${esc(e.type)}</span>` : ""}</div>`;
const taskCard = (t) => `<div class="card" style="${t.status === "done" ? "opacity:.5" : ""}">
  <h4 class="click" onclick="openForm('tasks','${t.id}')">${t.priority === "high" ? "● " : ""}${esc(t.title)}</h4>
  <div class="meta"><span class="k">${esc(t.kind || "todo")}</span>${esc(nameOf("events", t.eventId))}${t.supplierId ? " · " + esc(nameOf("suppliers", t.supplierId)) : ""}${t.dueDate ? ` · <span style="${t.status !== "done" && t.dueDate < today() ? "color:#b3413b;font-weight:600" : ""}">due ${esc(t.dueDate)}</span>` : ""}</div>
  ${t.status === "done" ? "" : `<div class="row"><button onclick="done('${t.id}')">✓ Done</button>${t.kind === "chase" ? `<button onclick="ask('Draft a nudge for task ${t.id}')">Nudge</button>` : ""}</div>`}</div>`;
const personCard = (col, p) => `<div class="card click" onclick="openPerson('${col}','${p.id}')"><h4>${esc(p.name)}${p.rating ? ` <span class="meta">${"★".repeat(p.rating)}</span>` : ""}</h4>
  <div class="meta">${col === "suppliers" ? `${esc(p.category || "")}${p.location ? " · " + esc(p.location) : ""}${p.contactName ? " · " + esc(p.contactName) + (p.contactRole ? ` (${esc(p.contactRole)})` : "") : ""}${p.commission ? " · " + esc(p.commission) + "% comm." : ""}${p.responsiveness ? " · replies " + esc(p.responsiveness) : ""}` : `${esc(p.email || "")} ${esc(p.phone || "")}${passportWarn(p) ? ` · <b style="color:#b3413b">passport ⚠️</b>` : ""}`}</div></div>`;
const passportWarn = (c) => (data.glance?.passport || []).some((x) => x.clientId === c.id);
const contactRow = (p) => `<div class="row">${p.phone ? `<button onclick="location.href='tel:${esc(p.phone)}'">Call</button><button onclick="window.open('https://wa.me/${esc(String(p.phone).replace(/\D/g, ""))}','_blank','noopener')">WhatsApp</button>` : ""}${p.email ? `<button onclick="location.href='mailto:${esc(p.email)}'">Email</button>` : ""}</div>`;

// ---------- List pages ----------
const ui = { evQ: "", evF: "active", taskF: "open", pplTab: "clients", pplQ: "", supCat: "all", supLoc: "all" };
function filterBar(key, opts) { return `<div class="filters">${opts.map((o) => `<button class="${ui[key] === o ? "on" : ""}" onclick="ui.${key}='${o}';refreshLists()">${o}</button>`).join("")}</div>`; }
function refreshLists() { renderEvents(); renderTasks(); renderPeople(); }

function renderEvents() {
  const q = ui.evQ.toLowerCase();
  const list = data.events.filter((e) => {
    const past = e.endDate ? e.endDate < today() : e.startDate && e.startDate < today();
    const f = ui.evF === "all" || (ui.evF === "active" && !past && e.status !== "cancelled") || (ui.evF === "past" && past) || e.status === ui.evF;
    return f && (!q || JSON.stringify([e.name, e.location, nameOf("clients", e.clientId)]).toLowerCase().includes(q));
  }).sort((a, b) => (a.startDate || "9").localeCompare(b.startDate || "9"));
  const box = $("#v-events");
  if (!box.querySelector("#evList")) box.innerHTML = `<div class="bar"><input placeholder="Search events, clients, places" oninput="ui.evQ=this.value;renderEvents()"><button class="add" onclick="openForm('events')">+ New</button><button class="add" style="background:var(--gold)" onclick="openGrowth()">Growth</button></div><div id="evF"></div><div id="evList"></div>`;
  $("#evF").innerHTML = filterBar("evF", ["active", "enquiry", "planning", "quoted", "confirmed", "past", "all"]);
  $("#evList").innerHTML = list.map(eventCard).join("") || empty("No events here. Tap + New, or tell Blue about one 🎉");
}

function renderTasks() {
  const m = { open: (t) => t.status !== "done", chase: (t) => t.kind === "chase" && t.status !== "done", deadline: (t) => t.kind === "deadline" && t.status !== "done", followup: (t) => t.kind === "followup" && t.status !== "done", overdue: (t) => t.status !== "done" && t.dueDate && t.dueDate < today(), done: (t) => t.status === "done" };
  const list = data.tasks.filter(m[ui.taskF]).sort((a, b) => (a.dueDate || "9").localeCompare(b.dueDate || "9"));
  $("#v-tasks").innerHTML = `<div class="bar"><b class="serif" style="flex:1;font-size:22px">Tasks</b><button class="add" onclick="openForm('tasks')">+ New</button></div>`
    + filterBar("taskF", ["open", "overdue", "chase", "deadline", "followup", "done"]) + (list.map(taskCard).join("") || empty("Nothing here. Suspiciously calm… 🧘"));
}

function renderPeople() {
  const col = ui.pplTab, q = ui.pplQ.toLowerCase();
  const sup = col === "suppliers", uniq = (k) => ["all", ...new Set(data.suppliers.map((p) => p[k]).filter(Boolean).sort())];
  const list = data[col].filter((p) => !p.erased && (!q || JSON.stringify(p).toLowerCase().includes(q)) && (!sup || ((ui.supCat === "all" || p.category === ui.supCat) && (ui.supLoc === "all" || p.location === ui.supLoc))))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const box = $("#v-people");
  if (!box.querySelector("#pplList")) box.innerHTML = `<div id="pplTabs"></div><div class="bar"><input placeholder="Search" oninput="ui.pplQ=this.value;renderPeople()"><button class="add" onclick="openForm(ui.pplTab)">+ New</button></div><div id="pplList"></div><div id="settings"></div>`;
  $("#pplTabs").innerHTML = `<div class="tabs">${["clients", "suppliers"].map((t) => `<button class="${t === col ? "on" : ""}" onclick="ui.pplTab='${t}';renderPeople()">${t}</button>`).join("")}</div>`;
  const chips = (key, opts) => `<div class="filters">${opts.map((o) => `<button class="${ui[key] === o ? "on" : ""}" onclick="ui.${key}=this.dataset.o;renderPeople()" data-o="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
  $("#pplList").innerHTML = (sup ? chips("supLoc", uniq("location")) + chips("supCat", uniq("category")) : "") + (list.map((p) => personCard(col, p)).join("") || empty(`No ${col} yet`));
  const fbYes = data.feedback.filter((f) => f.helpful).length;
  $("#settings").innerHTML = `<h3>Settings & insights</h3><div class="card"><div class="meta">Signed in as <b>${esc(data.me?.name)}</b> (${esc(data.me?.role)})</div>
    <div class="row"><button onclick="logout()">Sign out</button>${data.me?.role === "admin" ? `<button onclick="openTeam()">Team & activity</button>` : ""}<button onclick="openPrivacy()">Privacy & GDPR</button></div></div><div class="card"><div class="meta">Feedback: <b>${fbYes}</b> helped · <b>${data.feedback.length - fbYes}</b> not quite</div>
    <div class="row"><button onclick="enablePush()">Morning brief on</button><button onclick="exportData('feedback')">Export feedback CSV</button><button onclick="exportData('all')">Export all data</button></div></div>`;
}

// ---------- Event detail ----------
let evTab = "overview";
function openEvent(id) { evTab = "overview"; openSheet(() => eventPage(id)); }
function setEvTab(t) { evTab = t; drawSheet(); }
function eventPage(id) {
  const e = data.events.find((x) => x.id === id);
  if (!e) return { title: "Not found", body: empty("This event was deleted.") };
  const by = (col) => data[col].filter((r) => r.eventId === id);
  const tabs = ["overview", "itinerary", "tasks", "budget", "suppliers", "messages"];
  const addBtn = (col, label) => `<button class="add" onclick="openForm('${col}',null,{eventId:'${id}'})">+ ${label}</button>`;
  let body = "";
  if (evTab === "overview") {
    const open = by("tasks").filter((t) => t.status !== "done");
    const days = e.startDate ? Math.ceil((new Date(e.startDate) - new Date(today())) / 864e5) : null;
    body = `<div class="stats"><div class="stat"><b>${days == null ? "—" : days > 0 ? days : days === 0 ? "Today" : "Done"}</b><span class="meta">${days > 0 ? "days to go" : "status"}</span></div>
      <div class="stat"><b>${open.length}</b><span class="meta">open tasks</span></div></div>
      <div class="card"><div class="meta">${esc(e.type || "")} · ${esc(e.status || "")}</div>
      <p style="margin:6px 0">${esc(e.location || "Location TBC")}<br>${esc(e.startDate || "?")}${e.endDate ? " → " + esc(e.endDate) : ""} · ${esc(e.headcount || "?")} guests</p>
      ${e.clientId ? `<p class="click" style="margin:0" onclick="openPerson('clients','${e.clientId}')">Client: <b>${esc(nameOf("clients", e.clientId))}</b> ›</p>` : ""}
      ${e.notes ? `<p class="meta" style="white-space:pre-wrap">${esc(e.notes)}</p>` : ""}</div>
      <div class="row"><button onclick="openForm('events','${id}')">Edit</button><button onclick="share('/t/${e.token}')">Share trip page</button><button onclick="window.open('/t/${e.token}','_blank')">Preview</button><button onclick="relink('events','${id}')">New link</button><button onclick="duplicateTrip('${id}')">Use as template</button><button onclick="stack.length=0;drawSheet();ask('Give me a status check on event ${id}: risks, what is missing, next steps')">Ask Blue</button></div>
      ${travellersBlock(e)}
      ${feedbackBlock(e)}
      <div class="wave"></div><h3>Proposals</h3>${by("proposals").map((p) => `<div class="card"><h4>${esc(p.title)}</h4>
        <span class="pill">${p.choice ? "chose " + esc(p.choice) : p.validUntil && p.validUntil < today() ? "expired" : "waiting" + (p.validUntil ? " · until " + esc(p.validUntil) : "")}</span>
        <div class="meta">${(p.options || []).map((o) => esc(String(o).split("|").slice(0, 2).join(" · "))).join("<br>")}</div>
        ${p.choice ? "" : `<div class="row"><button onclick="share('/p/${p.token}')">Share link</button><button onclick="window.open('/p/${p.token}','_blank')">Preview</button><button onclick="openForm('proposals','${p.id}')">Edit</button></div>`}</div>`).join("") || empty("No proposals yet")}
      <button class="add" onclick="openForm('proposals',null,{eventId:'${id}',title:'${esc(e.name).replace(/'/g, "")} — your options',validUntil:new Date(Date.now()+7*864e5).toISOString().slice(0,10),options:['Essential | 0 | ','Signature | 0 | ','Ultimate | 0 | ']})">+ Proposal with options</button>
      <div class="wave"></div><h3>Client approvals</h3>${by("approvals").map((a) => `<div class="card"><h4>${esc(a.question)}</h4><span class="pill">${esc(a.choice || "waiting")}</span>${a.choice ? "" : `<div class="row"><button onclick="share('/a/${a.token}')">Share link</button><button onclick="openForm('approvals','${a.id}')">Edit</button></div>`}</div>`).join("") || empty("None")}
      ${addBtn("approvals", "Ask client to choose")}`;
  }
  if (evTab === "itinerary") {
    let day = "";
    body = `<div class="bar"><span style="flex:1" class="meta">Everything here is visible on the client trip page.</span>${addBtn("itinerary", "Add")}</div><div class="tl">`
      + (by("itinerary").sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map((i) => (i.date !== day ? `<h5>${esc((day = i.date) || "No date")}</h5>` : "")
        + `<div class="card click" onclick="openForm('itinerary','${i.id}')"><b>${KIND[i.kind] || ""} ${esc(i.time || "")}${i.endTime ? "–" + esc(i.endTime) : ""} ${esc(i.title)}</b><div class="meta">${esc(i.location || "")}${i.confirmation ? " · ref " + esc(i.confirmation) : ["flight", "transfer", "hotel"].includes(i.kind) ? ' · <b style="color:#b3413b">not confirmed</b>' : ""}${i.voucher ? " · 📎 voucher" : ""}${i.supplierId ? " · " + esc(nameOf("suppliers", i.supplierId)) : ""}${i.guestIds?.length ? " · for " + i.guestIds.map((g) => esc(String(nameOf("clients", g)).split(" ")[0])).join(", ") : ""}</div></div>`).join("") || empty("No itinerary yet")) + "</div>";
  }
  if (evTab === "tasks") body = `<div class="bar"><span style="flex:1"></span>${addBtn("tasks", "Task")}</div>` + (by("tasks").sort((a, b) => (a.status === "done") - (b.status === "done") || (a.dueDate || "9").localeCompare(b.dueDate || "9")).map(taskCard).join("") || empty("No tasks"));
  if (evTab === "budget") {
    const c = by("costs"), sum = (k) => c.reduce((a, x) => a + Number(x[k] || 0), 0), cur = e.currency || "EUR";
    const budget = Number(e.budget || 0), contracted = sum("contracted"), paid = sum("paid");
    const pct = budget ? Math.min(100, Math.round((contracted / budget) * 100)) : 0;
    body = `<div class="stats"><div class="stat"><b>${money(budget, cur)}</b><span class="meta">budget</span></div><div class="stat"><b style="${budget && contracted > budget ? "color:#b3413b" : ""}">${money(contracted, cur)}</b><span class="meta">contracted</span></div>
      <div class="stat"><b>${money(paid, cur)}</b><span class="meta">paid</span></div><div class="stat"><b>${money(contracted - paid, cur)}</b><span class="meta">outstanding</span></div></div>
      ${budget ? `<div class="bar-track"><div class="bar-fill" style="width:${pct}%;${contracted > budget ? "background:#b3413b" : ""}"></div></div><p class="meta">${pct}% of budget committed${contracted > budget ? " — over budget!" : ""}</p>` : `<p class="meta">Set a budget on the event to track it.</p>`}
      ${(() => { const pct = (x) => Number(x.commission ?? data.suppliers.find((s) => s.id === x.supplierId)?.commission ?? 0);
        const exp = c.reduce((a, x) => a + Number(x.contracted || x.quoted || 0) * pct(x) / 100, 0), rec = sum("commissionReceived");
        return exp ? `<div class="stats"><div class="stat"><b>${money(exp, cur)}</b><span class="meta">commission expected</span></div><div class="stat"><b style="${rec < exp ? "color:#b3413b" : ""}">${money(rec, cur)}</b><span class="meta">commission received</span></div></div>` : ""; })()}
      <div class="row"><button onclick="window.open('/api/events/${id}/sheet?view=client','_blank')">Client cost sheet</button><button onclick="window.open('/api/events/${id}/sheet','_blank')">Internal sheet (margin)</button></div>
      <div class="bar"><span class="meta" style="flex:1">Internal only — never shown to clients.</span>${addBtn("costs", "Cost")}</div>`
      + (c.map((x) => `<div class="card click" onclick="openForm('costs','${x.id}')"><h4>${esc(x.item)}</h4><div class="meta">${x.supplierId ? esc(nameOf("suppliers", x.supplierId)) + " · " : ""}quoted ${money(x.quoted, cur)} · contracted ${money(x.contracted, cur)} · paid ${money(x.paid, cur)}${x.dueDate ? " · due " + esc(x.dueDate) : ""}</div></div>`).join("") || empty("No costs logged"));
  }
  if (evTab === "suppliers") {
    const ids = eventSupplierIds(e), explicit = new Set(e.supplierIds || []);
    body = pickRow("suppliers", id, "supplierIds", ids) + (ids.map((sid) => data.suppliers.find((s) => s.id === sid)).filter(Boolean).map((s) => {
      const uses = [...data.itinerary.filter((i) => i.eventId === id && i.supplierId === s.id).map((i) => `${KIND[i.kind] || "•"} ${esc(i.date || "")} ${esc(i.title)}`), ...data.costs.filter((c) => c.eventId === id && c.supplierId === s.id).map((c) => `💶 ${esc(c.item)}`)];
      return `<div style="position:relative">${personCard("suppliers", s)}${uses.length ? `<div class="meta" style="margin:-6px 0 10px 12px">${uses.join("<br>")}</div>` : ""}${explicit.has(s.id) ? `<button class="danger" style="position:absolute;top:6px;right:6px;border:0;background:none" onclick="linkTo('${id}','supplierIds','${s.id}')" aria-label="Remove">✕</button>` : ""}</div>`;
    }).join("") || empty("No suppliers yet. Add one above, or set a supplier on an itinerary item or cost."))
      + `<div class="row"><button onclick="stack.length=0;drawSheet();ask('Suggest suppliers for event ${id} from our list, and what is still missing')">Ask Blue for suggestions</button></div>`;
  }
  if (evTab === "messages") body = (by("drafts").slice().reverse().map((d) => `<div class="card"><h4>${esc(d.subject || "Message")} <span class="pill">${esc(d.status)}</span></h4><div class="meta">To ${esc(d.to || "?")} · ${esc(d.channel || "email")}</div><p style="white-space:pre-wrap">${esc(d.body)}</p><div class="row"><button onclick="copyDraft('${d.id}')">Copy</button><button onclick="openDraft('${d.id}')">Open in app</button><button onclick="mark('${d.id}','sent').then(drawSheet)">I sent it</button></div></div>`).join("") || empty("No messages yet"))
    + `<div class="row"><button onclick="stack.length=0;drawSheet();ask('Draft an update to the client for event ${id}')">Draft client update</button></div>`;
  return { title: e.name, body: `${evTab === "overview" ? `<div style="margin-top:14px">${cover(e, true)}</div>` : ""}<div class="tabs">${tabs.map((t) => `<button class="${t === evTab ? "on" : ""}" onclick="setEvTab('${t}')">${t}</button>`).join("")}</div>${body}` };
}

const KIND = { flight: "✈︎", transfer: "🚘", hotel: "🛏", dining: "🍽", activity: "✦", other: "•" };

async function duplicateTrip(id) {
  const e = data.events.find((x) => x.id === id);
  const startDate = prompt(`New start date for a copy of "${e.name}" (YYYY-MM-DD).\nItinerary and costs are copied and shifted; booking refs, vouchers and payments are not.`, today());
  if (!startDate) return;
  const name = prompt("Name for the new trip", e.name.replace(/·.*$/, "").trim() + " · new");
  if (name == null) return;
  try { const ev = await api(`/api/events/${id}/duplicate`, { startDate, name }); await refresh(); stack.length = 0; openEvent(ev.id); } catch (err) { alert(err.message); }
}
async function openGrowth() {
  const g = await api("/api/growth"), m = (n) => money(n, "EUR");
  const act = (o) => o.kind === "referral"
    ? `<button onclick="stack.length=0;drawSheet();ask('Draft a warm thank-you to client ${o.clientId} for their 5-star feedback on event ${o.eventId}, asking if they know anyone who would love a trip like theirs')">Draft ask</button><button onclick="referralAsked('${o.eventId}')">Asked ✓</button>`
    : `<button onclick="stack.length=0;drawSheet();ask('Draft a personal note to client ${o.clientId} pitching ${o.kind === "rebook" ? "this year\\'s version of event " + o.eventId : "a celebration trip for their anniversary"}, using their dossier preferences. 2-3 tailored ideas, no prices.')">Draft pitch</button>`;
  openSheet(() => ({ title: "Growth", body: `<div class="stats">
      <div class="stat"><b>${m(g.pipeline.value)}</b><span class="meta">pipeline · ${g.pipeline.count} open</span></div>
      <div class="stat"><b>${g.winRate == null ? "—" : g.winRate + "%"}</b><span class="meta">win rate · 12 months</span></div>
      <div class="stat"><b>${m(g.earnings.margin + g.earnings.commission)}</b><span class="meta">earned ${esc(g.year)} · margin + commission</span></div>
      <div class="stat"><b>${g.bookedThisYear}</b><span class="meta">trips booked ${esc(g.year)}</span></div>
      <div class="stat"><b>${g.avgRating ?? "—"}${g.avgRating ? "★" : ""}</b><span class="meta">avg client rating</span></div>
      <div class="stat"><b>${g.repeatClients}</b><span class="meta">repeat clients</span></div></div>
    <p class="meta">Commission received this year: ${m(g.earnings.received)} of ${m(g.earnings.commission)} expected. Amounts shown in EUR without conversion.</p>
    <h3>Revenue opportunities · ${g.opportunities.length}</h3>${g.opportunities.map((o) => `<div class="card"><div>${o.kind === "rebook" ? "🔁" : o.kind === "anniversary" ? "💍" : "🤝"} ${esc(o.text)}</div><div class="row">${act(o)}</div></div>`).join("") || empty("No opportunities right now. Keep the dossiers full and they'll appear here.")}` }));
}
async function referralAsked(id) { await fetch(`/api/rec/events/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ referralAskedAt: new Date().toISOString() }) }); stack.pop(); await refresh(); openGrowth(); }
let pendingLink = null; // a record created from a trip page gets linked to that trip on save
// Linking people to a trip: lead client + guests, and suppliers (explicit, or via itinerary/costs/tasks).
const travellerIds = (e) => [...new Set([e.clientId, ...(e.guestIds || [])].filter(Boolean))];
const eventSupplierIds = (e) => [...new Set([...(e.supplierIds || []), ...[...data.itinerary, ...data.costs, ...data.tasks].filter((r) => r.eventId === e.id).map((r) => r.supplierId)].filter(Boolean))];
const eventsForClient = (id) => data.events.filter((e) => travellerIds(e).includes(id));
const eventsForSupplier = (id) => data.events.filter((e) => eventSupplierIds(e).includes(id));
function pickRow(col, eventId, field, exclude) {
  const opts = data[col].filter((r) => !r.erased && !exclude.includes(r.id)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return `<div class="bar"><select id="pick-${field}" style="flex:1;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:10px"><option value="">Add existing ${col === "clients" ? "client" : "supplier"}…</option>${opts.map((r) => `<option value="${r.id}">${esc(r.name)}${r.category ? " · " + esc(r.category) : ""}</option>`).join("")}</select><button class="add" onclick="linkTo('${eventId}','${field}')">Add</button><button class="add" onclick="pendingLink={col:'${col}',eventId:'${eventId}',field:'${field}'};openForm('${col}')">+ New</button></div>`;
}
async function linkTo(eventId, field, removeId) {
  const e = data.events.find((x) => x.id === eventId), cur = new Set(e[field] || []);
  if (removeId) cur.delete(removeId); else { const v = document.getElementById("pick-" + field)?.value; if (!v) return; cur.add(v); }
  await fetch(`/api/rec/events/${eventId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ [field]: [...cur] }) });
  await reloadAll();
}
function travellersBlock(e) {
  const rows = travellerIds(e).map((cid) => { const c = data.clients.find((x) => x.id === cid); if (!c || c.erased) return "";
    return `<div class="card" style="display:flex;align-items:center;gap:8px"><span class="click" style="flex:1" onclick="openPerson('clients','${cid}')"><b>${esc(c.name)}</b> ${cid === e.clientId ? '<span class="pill">lead</span>' : ""}${passportWarn(c) ? ' <b style="color:#b3413b">passport ⚠️</b>' : ""}</span>${cid === e.clientId ? "" : `<button class="danger" style="border:0;background:none" onclick="linkTo('${e.id}','guestIds','${cid}')" aria-label="Remove">✕</button>`}</div>`; }).join("");
  return `<h3>Travellers · ${travellerIds(e).length}</h3>${rows || empty("No client linked yet")}${pickRow("clients", e.id, "guestIds", travellerIds(e))}`;
}
function feedbackBlock(e) {
  const f = e.feedback, ended = e.endDate && e.endDate < today();
  if (f) return `<div class="card" style="border-left:2px solid var(--gold)"><span class="label">Client feedback · ${"★".repeat(f.rating)}${"☆".repeat(5 - f.rating)}</span>
    ${f.highlight ? `<p style="margin:6px 0"><b>Highlight:</b> ${esc(f.highlight)}</p>` : ""}${f.improve ? `<p style="margin:6px 0"><b>Could be better:</b> ${esc(f.improve)}</p>` : ""}<div class="meta">${f.testimonial ? "✓ OK to quote as a testimonial" : "Not for publication"}</div></div>`;
  if (!ended) return "";
  return `<div class="row"><button onclick="feedbackRequest('${e.id}')">${e.feedbackRequestedAt ? "Ask for feedback again" : "Ask client for feedback"}</button><button onclick="share('/f/${e.token}')">Share feedback link</button></div>`;
}
async function feedbackRequest(id) {
  try { await api(`/api/events/${id}/feedback-request`, {}); alert("Feedback request drafted. Find it in Inbox → Drafts to approve."); await reloadAll(); } catch (e) { alert(e.message); }
}

// ---------- Today at a glance (top of the chat tab) ----------
function glanceCard(r, g) {
  if (!g) return "";
  const ev = (id) => `onclick="openEvent('${id}')"`;
  const sec = (title, rows) => rows.length ? `<div style="margin-top:10px"><span class="label">${title}</span>${rows.join("")}</div>` : "";
  const line = (html, click = "") => `<div class="meta ${click ? "click" : ""}" style="padding:4px 0;color:var(--ink)" ${click}>${html}</div>`;
  const body = [
    sec("Arriving · next 48h", g.arrivals.map((e) => line(`🛬 <b>${esc(e.name)}</b> · ${esc(e.startDate)} · ${esc(e.location || "")}`, ev(e.id)))),
    sec("Departing · next 48h", g.departures.map((e) => line(`🛫 <b>${esc(e.name)}</b> · ${esc(e.endDate)}`, ev(e.id)))),
    sec("Today & tomorrow", g.agenda.map((i) => line(`${KIND[i.kind] || "•"} ${i.date === g.today ? "" : "Tmrw "}${esc(i.time || "")} ${esc(i.title)} <span class="meta">· ${esc(i.event)}</span>`, ev(i.eventId)))),
    sec("⚠️ Passport alerts (6-month rule)", g.passport.map((p) => line(`<b>${esc(p.client)}</b> expires ${esc(p.expires)} · ${esc(p.event)}`, `onclick="openPerson('clients','${p.clientId}')"`))),
    sec("Unconfirmed bookings · next 14 days", g.unconfirmed.map((i) => line(`${KIND[i.kind]} ${esc(i.date)} ${esc(i.title)} · ${esc(i.event)}`, `onclick="openForm('itinerary','${i.id}')"`))),
    sec("Pre-arrival notes to hotels", g.preArrival.map((e) => `<div class="row" style="align-items:center"><span class="meta" style="flex:1;color:var(--ink)">${esc(e.name)} · arrives ${esc(e.startDate)}</span><button onclick="ask('Draft the pre-arrival welcome note and amenity request to the hotel for event ${e.id}, using the client dossier (dietary, drinks, room preferences, celebrations)')">Draft</button><button onclick="prearrivalSent('${e.id}')">Sent ✓</button></div>`)),
    sec("Missing details", g.gaps.map((x) => line(`✎ <b>${esc(x.event)}</b> · ${esc(x.text)}`, x.fix === "client" ? `onclick="openPerson('clients','${x.clientId}')"` : ev(x.eventId)))),
    sec("Privacy", (() => { const n = data.clients.filter((c) => !c.erased && c.dietary && c.consentHealth !== "yes").length; return n ? [line(`🔒 ${n} client(s) have dietary / allergy data without recorded consent`, `onclick="openPrivacy()"`)] : []; })()),
    sec("Trips just ended · ask how it went", g.feedbackDue.map((e) => `<div class="row" style="align-items:center"><span class="meta" style="flex:1;color:var(--ink)">${esc(e.name)} · back ${esc(e.endDate)}</span><button onclick="feedbackRequest('${e.id}')">Draft request</button></div>`)),
    sec("Proposals expiring", g.proposals.map((p) => line(`⏳ <b>${esc(p.title)}</b> · ${p.validUntil < g.today ? "expired" : "until " + esc(p.validUntil)} · no choice yet`, ev(p.eventId)))),
    sec("Commission to collect", g.commissionDue.map((x) => line(`💶 <b>${esc(x.name)}</b> · ${money(x.outstanding, x.currency || "EUR")} outstanding`, ev(x.id)))),
    sec("Celebrations · next 2 weeks", g.celebrations.map((c) => line(`🎉 <b>${esc(c.client)}</b> ${esc(c.what)} · ${esc(c.date)}`, `onclick="openPerson('clients','${c.clientId}')"`))),
  ].join("");
  const counts = `${r.overdue.length ? `<b>${r.overdue.length} overdue</b> · ` : ""}${r.next7days.length} due this week · ${r.openChases.length} chases · ${r.quotesAwaiting.length} quotes awaiting${r.pendingApprovals.length ? ` · ${r.pendingApprovals.length} approvals` : ""}${r.balancesDue.length ? ` · <b>${r.balancesDue.length} balances due</b>` : ""}`;
  return `<div class="card" style="border-left:2px solid var(--gold)"><span class="label">Today at a glance · ${new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</span>
    <div style="margin-top:4px">${counts}</div>${body || `<div class="meta" style="margin-top:6px">No arrivals, departures or alerts. A calm day. ☕</div>`}
    <div class="row"><button onclick="ask('Give me my daily brief')">Brief me</button>${g.draftsWaiting ? `<button onclick="document.querySelector('nav button[data-v=drafts]').click()">${g.draftsWaiting} drafts to approve</button>` : ""}</div></div>`;
}
async function prearrivalSent(id) { await fetch(`/api/rec/events/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ prearrivalSent: true }) }); refresh(); }

// ---------- Client / supplier detail ----------
function openPerson(col, id) { openSheet(() => personPage(col, id)); }
function personPage(col, id) {
  const p = data[col].find((x) => x.id === id);
  if (!p) return { title: "Not found", body: empty("Deleted.") };
  const fields = SCHEMA[col].fields.filter(([k]) => k !== "name" && p[k]).map(([k, label]) => `<div class="meta" style="margin-top:6px"><span class="k">${label}</span></div><div style="white-space:pre-wrap">${esc(p[k])}</div>`).join("");
  let related = "";
  if (col === "clients") related = `<h3>Events & trips</h3>` + (eventsForClient(id).map(eventCard).join("") || empty("None yet")) + `<button class="add" onclick="openForm('events',null,{clientId:'${id}'})">+ New event for ${esc(p.name)}</button>`;
  else {
    related = `<h3>Open tasks</h3>` + (data.tasks.filter((t) => t.supplierId === id && t.status !== "done").map(taskCard).join("") || empty("None"))
      + `<h3>Used on</h3>` + (eventsForSupplier(id).map(eventCard).join("") || empty("Not used on any event yet"));
  }
  const warn = col === "clients" ? (data.glance?.passport || []).filter((x) => x.clientId === id).map((x) => `<div class="card" style="border-left:2px solid #b3413b"><b>⚠️ Passport expires ${esc(x.expires)}</b><div class="meta">Less than 6 months after ${esc(x.event)}. Many destinations will refuse entry — ask the client to renew (and confirm the destination's rule).</div></div>`).join("") : "";
  const gdpr = col !== "clients" ? "" : `<h3>Privacy (GDPR)</h3><div class="meta">Privacy notice: ${p.privacyNoticeAt ? "sent " + esc(p.privacyNoticeAt) : "<b>not sent yet</b>"}</div><div class="row"><button onclick="noticeDraft('${id}')">Draft privacy notice</button>` + (data.me?.role !== "admin" ? "</div>" : `<button onclick="location.href='/api/clients/${id}/export'">Export their data</button><button class="danger" onclick="eraseClient('${id}')">Erase client</button></div>`);
  return { title: p.name, body: `${warn}<div class="card">${fields || '<span class="meta">No details yet</span>'}</div>${contactRow(p)}<div class="row"><button onclick="openForm('${col}','${id}')">Edit</button><button onclick="stack.length=0;drawSheet();ask('Draft a message to ${col === "clients" ? "client" : "supplier"} ${id}: ')">Draft message with Blue</button></div>${related}${gdpr}` };
}
async function noticeDraft(id) {
  try { await api(`/api/clients/${id}/privacy-notice`, {}); alert("Draft ready in Inbox → Drafts to approve. When you mark it sent, the date is recorded on the client."); await reloadAll(); }
  catch (e) { alert(e.message); }
}
async function eraseClient(id) {
  const c = data.clients.find((x) => x.id === id);
  const typed = prompt(`Erase ${c.name}? This removes their personal details, messages and drafts. Events and costs are kept without their name for accounting.\n\nExport their data first if they asked for a copy.\n\nType their exact name to confirm:`);
  if (typed == null) return;
  try { const r = await api(`/api/clients/${id}/erase`, { confirm: typed }); alert(`Erased. Removed ${r.messages} messages and ${r.drafts} drafts. Daily backups roll off within 14 days.`); stack.length = 0; await reloadAll(); }
  catch (e) { alert(e.message); }
}
async function openPrivacy() {
  const r = await api("/api/privacy/report");
  const row = (c, extra = "") => `<div class="card click" onclick="openPerson('clients','${c.id}')"><h4>${esc(c.name)}</h4>${extra ? `<div class="meta">${extra}</div>` : ""}</div>`;
  const info = await api("/api/info").catch(() => ({}));
  openSheet(() => ({ title: "Privacy & GDPR", body: `${info.encrypted ? "" : `<div class="card" style="border-left:2px solid #b3413b"><b>Data is not encrypted at rest.</b><div class="meta">Set DATA_KEY in .env (a long random secret, kept somewhere safe) and restart.</div></div>`}<p class="meta">Tooling to help you comply. It is not legal advice: see GDPR.md in the code for what still needs a human decision.</p>
    <h3>Health data without consent · ${r.healthNoConsent.length}</h3>${r.healthNoConsent.map((c) => row(c, "Has dietary / allergy details but no explicit consent recorded")).join("") || empty("All good")}
    <h3>Past the ${r.retentionMonths}-month retention period · ${r.retentionDue.length}</h3>${r.retentionDue.map((c) => row(c, `Last activity ${esc(c.last)}. Erase, or note why you still need it.`)).join("") || empty("Nothing to review")}
    <h3>Privacy notice not sent · ${r.noPrivacyNotice.length}</h3>${r.noPrivacyNotice.map((c) => row(c)).join("") || empty("All sent")}
    <h3>Privacy log</h3>${r.log.map((a) => `<div class="meta" style="padding:6px 0;border-bottom:1px solid var(--line)"><b>${esc(a.who)}</b> ${esc(a.action)} ${esc(a.detail)} · ${new Date(a.createdAt).toLocaleString()}</div>`).join("") || empty("No exports or erasures yet")}` }));
}

// ---------- Inbox: WhatsApp + email threads, drafts to approve, autopilot ----------
let info = {};
const ago = (iso) => { const h = (Date.now() - new Date(iso)) / 36e5; return h < 1 ? `${Math.max(1, Math.round(h * 60))}m` : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`; };
const who = (m) => nameOf("clients", m.clientId) || nameOf("suppliers", m.supplierId) || m.fromName || m.from || m.to;
const chan = (c) => (c === "whatsapp" ? "WhatsApp" : c === "email" ? "Email" : c || "");

function threads() {
  const by = {};
  for (const m of data.messages) (by[m.threadKey] ||= []).push(m);
  return Object.values(by).map((t) => ({ key: t[0].threadKey, msgs: t, last: t.at(-1) })).sort((a, b) => b.last.at.localeCompare(a.last.at));
}
function draftCard(d) {
  const wa = d.channel === "whatsapp" && info.whatsapp;
  return `<div class="card"><h4>${esc(d.subject || "Message")} ${d.auto ? '<span class="pill">autopilot</span>' : ""}</h4><div class="meta">To ${esc(d.to || "?")} · ${esc(chan(d.channel))} · ${esc(nameOf("events", d.eventId))}</div>
    <p style="white-space:pre-wrap">${esc(d.body)}</p>
    <div class="row">${wa ? `<button class="add" onclick="sendDraft('${d.id}')">Send via WhatsApp</button>` : ""}<button onclick="copyDraft('${d.id}')">Copy</button><button onclick="openDraft('${d.id}')">Open in app</button><button onclick="mark('${d.id}','sent')">I sent it</button><button onclick="mark('${d.id}','discarded')">Discard</button></div></div>`;
}
function threadCard(t) {
  const m = t.last, waiting = m.direction === "in" && m.status !== "replied" && m.status !== "ignored";
  return `<div class="card click" onclick="openThread('${t.key}')"><h4>${esc(who(m))} ${waiting ? `<span class="pill" style="color:#b3413b;border-color:#b3413b">waiting ${ago(m.at)}</span>` : ""}</h4>
    <div class="meta">${esc(chan(m.channel))} · ${m.direction === "in" ? "" : "You: "}${esc(String(m.body).slice(0, 90))}</div>
    ${m.status === "new" ? `<div class="meta"><i>${m.triageError ? "Blue couldn't read this yet: " + esc(m.triageError) : "Blue is reading this…"}</i></div>` : ""}</div>`;
}
async function renderInbox() {
  info = await api("/api/info").catch(() => info);
  const ts = threads();
  const needs = ts.filter((t) => t.last.direction === "in" && !["replied", "ignored"].includes(t.last.status));
  const waitingOn = ts.filter((t) => t.last.direction === "out");
  const drafts = data.drafts.filter((d) => d.status === "draft").reverse();
  $("#v-drafts").innerHTML = `<div class="card" style="border-left:2px solid var(--gold)"><span class="label">Autopilot</span>
      <div class="meta" style="margin-top:4px">Checks every ${info.autopilotMinutes || 30} min for unanswered messages, quiet suppliers, unclear budgets and pending approvals.
      WhatsApp: <b>${info.whatsapp ? "connected" : "not connected"}</b>${info.triage?.queued || info.triage?.busy ? ` · Blue is triaging ${(info.triage.queued || 0) + (info.triage.busy ? 1 : 0)} message(s)` : ""}</div>
      <div class="row"><button onclick="runAutopilot()">Run now</button><button onclick="simulate()">Simulate incoming</button></div></div>
    <h3>Needs a reply · ${needs.length}</h3>${needs.map(threadCard).join("") || empty("Inbox zero. Treat yourself 🍸")}
    <h3>Drafts to approve · ${drafts.length}</h3>${drafts.map(draftCard).join("") || empty("No drafts waiting")}
    <h3>Waiting on them · ${waitingOn.length}</h3>${waitingOn.map(threadCard).join("") || empty("Nobody owes you a reply")}`;
}
async function runAutopilot() {
  const r = await api("/api/autopilot/run", {});
  alert(r.created.length ? `Autopilot added ${r.created.length}:\n\n• ` + r.created.join("\n• ") : "All caught up — nothing slipping. 🚪");
  refresh();
}
function simulate() {
  openSheet(() => ({ title: "Simulate a message", body: `<p class="meta">Test the inbox without WhatsApp: pretend a client or supplier just wrote in. Blue will triage it.</p>
    <form onsubmit="doSimulate(event)">${field(["channel", "Channel", ["whatsapp", "email"]], "whatsapp")}${field(["from", "From (phone or email)"], data.clients[0]?.phone || "+351912345678")}
    ${field(["name", "Name"], data.clients[0]?.name || "Sara Costa")}${field(["body", "Message", "textarea"], "Hi! Quick ones: can we add 6 more guests to the dinner? And my mum is gluten free. Also what's the deadline to pay the deposit?")}
    <button class="add" style="width:100%">Send to Blue</button></form>` }));
}
async function doSimulate(e) {
  e.preventDefault();
  const q = (n) => e.target.querySelector(`[name=${n}]`).value;
  await api("/api/inbox/simulate", { channel: q("channel"), from: q("from"), name: q("name"), body: q("body") });
  stack.pop(); await reloadAll(); pollTriage();
}
let polling;
function pollTriage() { clearInterval(polling); polling = setInterval(async () => { await refresh(); drawSheet(); if (!data.messages.some((m) => m.status === "new")) clearInterval(polling); }, 4000); }
async function sendDraft(id) {
  if (!confirm("Send this on WhatsApp now?")) return;
  try { await api(`/api/drafts/${id}/send`, {}); await reloadAll(); } catch (e) { alert(e.message); }
}
function openThread(key) { openSheet(() => threadPage(key)); }
function threadPage(key) {
  const t = threads().find((x) => x.key === key);
  if (!t) return { title: "Thread", body: empty("Gone") };
  const msgIds = new Set(t.msgs.map((m) => m.id));
  const drafts = data.drafts.filter((d) => d.status === "draft" && (msgIds.has(d.messageId) || (d.to && d.to.replace(/\D/g, "") === key.replace(/\D/g, "")) || d.to?.toLowerCase() === key));
  const last = t.last;
  const bubbles = t.msgs.map((m) => `<div class="msg ${m.direction === "in" ? "bot" : "me"}">${esc(m.body)}<div class="meta" style="font-size:10px;margin-top:4px;${m.direction === "out" ? "color:#fff;opacity:.7" : ""}">${esc(chan(m.channel))} · ${new Date(m.at).toLocaleString()}${m.delivery ? " · " + esc(m.delivery) : ""}</div></div>
    ${m.triage ? `<div class="card" style="font-size:13px"><span class="label">Blue's triage</span><div style="white-space:pre-wrap;margin-top:4px">${md(m.triage)}</div></div>` : m.status === "new" && m.direction === "in" ? `<div class="meta"><i>Blue is reading this…${m.triageError ? " (retrying: " + esc(m.triageError) + ")" : ""}</i></div>` : ""}`).join("");
  return { title: who(last), body: `<div class="meta">${esc(chan(last.channel))} · ${esc(key)}${last.eventId ? ` · <a href="#" onclick="openEvent('${last.eventId}');return false">${esc(nameOf("events", last.eventId))}</a>` : ""}${last.clientId ? ` · <a href="#" onclick="openPerson('clients','${last.clientId}');return false">client</a>` : ""}${last.supplierId ? ` · <a href="#" onclick="openPerson('suppliers','${last.supplierId}');return false">supplier</a>` : ""}</div>
    ${bubbles}<h3>Reply drafts</h3>${drafts.map(draftCard).join("") || empty("No draft yet")}
    <div class="row"><button onclick="stack.length=0;drawSheet();ask('Draft a reply to the latest message from ${esc(key)} (message ${last.id})')">Ask Blue to draft</button>${last.direction === "in" && last.status !== "ignored" ? `<button onclick="setMsg('${last.id}','ignored')">No reply needed</button>` : ""}<button onclick="setMsg('${last.id}','new')">Re-triage</button></div>` };
}
async function setMsg(id, status) { await api(`/api/inbox/${id}/status`, { status }); await reloadAll(); if (status === "new") pollTriage(); }

// ---------- Team (admin) ----------
async function openTeam() {
  const [list, log] = await Promise.all([api("/api/users"), api("/api/audit")]);
  openSheet(() => ({ title: "Team & activity", body: `<h3>Team</h3>${list.map((u) => `<div class="card"><h4>${esc(u.name)} <span class="pill">${esc(u.role)}</span></h4><div class="meta">${esc(u.email)}</div>${u.id === data.me.id ? "" : `<div class="row"><button class="danger" onclick="disableUser('${u.id}')">Remove access</button></div>`}</div>`).join("")}
    <h3>Add a teammate</h3><form onsubmit="addUser(event)">${field(["name", "Name"])}${field(["email", "Email", "email"])}${field(["password", "Temporary password (10+ chars)", "text"])}${field(["role", "Role", ["planner", "admin"]], "planner")}<button class="add" style="width:100%">Add</button></form>
    <h3>Recent activity</h3>${log.slice(0, 60).map((a) => `<div class="meta" style="padding:6px 0;border-bottom:1px solid var(--line)"><b>${esc(a.who)}</b> ${esc(a.action)} ${esc(a.detail)} · ${new Date(a.createdAt).toLocaleString()}</div>`).join("") || empty("Nothing yet")}` }));
}
async function addUser(e) {
  e.preventDefault();
  const q = (n) => e.target.querySelector(`[name=${n}]`).value;
  try { await api("/api/users", { name: q("name"), email: q("email"), password: q("password"), role: q("role") }); stack.pop(); openTeam(); }
  catch (err) { alert(err.message); }
}
async function disableUser(id) { if (confirm("Remove this person's access? They'll be signed out everywhere.")) { await api(`/api/users/${id}/disable`, {}); stack.pop(); openTeam(); } }
