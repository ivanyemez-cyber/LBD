// Tiny JSON-file store. Swap for Supabase/Postgres when going to production.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DIR = path.resolve("data");
// Encryption at rest: set DATA_KEY (any long secret) and db.json + backups are stored AES-256-GCM encrypted.
// An existing plain file is read as-is and encrypted on the next save. Lose the key and the data is gone.
const KEY = process.env.DATA_KEY ? crypto.scryptSync(process.env.DATA_KEY, "lbd-blue-v1", 32) : null;
export const encrypted = !!KEY;
function seal(json) {
  if (!KEY) return json;
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const data = Buffer.concat([c.update(json, "utf8"), c.final()]);
  return JSON.stringify({ enc: "aes-256-gcm", iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") });
}
function open(text) {
  const o = JSON.parse(text);
  if (o.enc !== "aes-256-gcm") return o;
  if (!KEY) throw new Error("data/db.json is encrypted: set DATA_KEY");
  const d = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(o.iv, "base64"));
  d.setAuthTag(Buffer.from(o.tag, "base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(o.data, "base64")), d.final()]).toString("utf8"));
}
const FILE = path.join(DIR, "db.json");
const EMPTY = { events: [], suppliers: [], clients: [], tasks: [], drafts: [], costs: [], itinerary: [], approvals: [], proposals: [], feedback: [], push: [], messages: [], users: [], sessions: [], audit: [] };

function load() {
  let text;
  try { text = fs.readFileSync(FILE, "utf8"); } catch { return structuredClone(EMPTY); }
  return { ...EMPTY, ...open(text) }; // a wrong key or corrupt file must stop the app, never silently start empty
}
let db = load();
function save() {
  fs.mkdirSync(DIR, { recursive: true });
  // Atomic write (never leaves a half-written file) + one backup per day, last 14 kept.
  fs.writeFileSync(FILE + ".tmp", seal(JSON.stringify(db, null, KEY ? 0 : 2)));
  fs.renameSync(FILE + ".tmp", FILE);
  const bdir = path.join(DIR, "backups"), today = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(bdir, { recursive: true });
  const bfile = path.join(bdir, `db-${today}.json`);
  if (!fs.existsSync(bfile)) {
    fs.copyFileSync(FILE, bfile);
    fs.readdirSync(bdir).sort().slice(0, -14).forEach((f) => fs.unlinkSync(path.join(bdir, f)));
  }
}

export const COLLECTIONS = Object.keys(EMPTY);

export function list(col, filter = {}) {
  return db[col].filter((r) =>
    Object.entries(filter).every(([k, v]) => v == null || String(r[k] ?? "").toLowerCase().includes(String(v).toLowerCase()))
  );
}
export function get(col, id) { return db[col].find((r) => r.id === id) ?? null; }
export function create(col, data) {
  if (col === "events" || col === "approvals" || col === "proposals") data = { ...data, token: crypto.randomBytes(16).toString("hex") }; // for public share links
  const rec = { ...data, id: crypto.randomUUID().slice(0, 8), createdAt: new Date().toISOString() };
  db[col].push(rec); save(); return rec;
}
export function update(col, id, patch) {
  const rec = get(col, id);
  if (!rec) return null;
  Object.assign(rec, patch, { id, token: rec.token, updatedAt: new Date().toISOString() });
  save(); return rec;
}
export function remove(col, id) {
  const before = db[col].length;
  db[col] = db[col].filter((r) => r.id !== id);
  save(); return db[col].length < before;
}
export function snapshot() { return db; }
export function byToken(col, token) { return token && db[col].find((r) => r.token === token) || null; }
export function relink(col, id) {
  const rec = get(col, id);
  if (!rec) return null;
  rec.token = crypto.randomBytes(16).toString("hex"); save(); return rec;
}
