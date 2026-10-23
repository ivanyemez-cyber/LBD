// Tiny JSON-file store. Swap for Supabase/Postgres when going to production.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DIR = path.resolve("data");
const FILE = path.join(DIR, "db.json");
const EMPTY = { events: [], suppliers: [], clients: [], tasks: [], drafts: [], costs: [], itinerary: [], approvals: [], feedback: [], push: [], messages: [], users: [], sessions: [], audit: [] };

function load() {
  try { return { ...EMPTY, ...JSON.parse(fs.readFileSync(FILE, "utf8")) }; }
  catch { return structuredClone(EMPTY); }
}
let db = load();
function save() {
  fs.mkdirSync(DIR, { recursive: true });
  // Atomic write (never leaves a half-written file) + one backup per day, last 14 kept.
  fs.writeFileSync(FILE + ".tmp", JSON.stringify(db, null, 2));
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
  if (col === "events" || col === "approvals") data = { ...data, token: crypto.randomBytes(16).toString("hex") }; // for public share links
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
