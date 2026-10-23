// Per-person accounts with HttpOnly session cookies. The team passcode is only used once, to create the first admin.
import crypto from "node:crypto";
import * as store from "./store.js";

const DAY = 864e5, SESSION_DAYS = 14;
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString("hex");
export const publicUser = (u) => u && { id: u.id, name: u.name, email: u.email, role: u.role };

export const needsSetup = () => store.list("users").length === 0;

export function createUser({ name, email, password, role = "planner" }) {
  email = String(email || "").trim().toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Name and a valid email are required");
  if (String(password || "").length < 10) throw new Error("Password must be at least 10 characters");
  if (store.list("users").some((u) => u.email === email)) throw new Error("That email already has an account");
  const salt = crypto.randomBytes(16).toString("hex");
  return store.create("users", { name: String(name).slice(0, 80), email, role: role === "admin" ? "admin" : "planner", salt, passHash: hash(password, salt) });
}

const attempts = new Map(); // email -> [timestamps], slows down password guessing
export function login(email, password) {
  email = String(email || "").trim().toLowerCase();
  const recent = (attempts.get(email) || []).filter((t) => Date.now() - t < 15 * 60e3);
  if (recent.length >= 8) throw new Error("Too many tries — wait 15 minutes.");
  const u = store.list("users").find((x) => x.email === email && !x.disabled);
  const ok = u && crypto.timingSafeEqual(Buffer.from(hash(String(password || ""), u.salt), "hex"), Buffer.from(u.passHash, "hex"));
  if (!ok) { attempts.set(email, [...recent, Date.now()]); throw new Error("Email or password doesn't match."); }
  attempts.delete(email);
  const sid = crypto.randomBytes(32).toString("hex");
  store.create("sessions", { sidHash: crypto.createHash("sha256").update(sid).digest("hex"), userId: u.id, expires: Date.now() + SESSION_DAYS * DAY });
  return { sid, user: u };
}

export function userFromSid(sid) {
  if (!sid) return null;
  const h = crypto.createHash("sha256").update(sid).digest("hex");
  const s = store.list("sessions").find((x) => x.sidHash === h);
  if (!s || s.expires < Date.now()) return null;
  const u = store.get("users", s.userId);
  return u && !u.disabled ? u : null;
}
export function logout(sid) {
  const h = crypto.createHash("sha256").update(sid || "").digest("hex");
  const s = store.list("sessions").find((x) => x.sidHash === h);
  if (s) store.remove("sessions", s.id);
}
export const cookie = (sid, maxAgeDays = SESSION_DAYS) =>
  `sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.round(maxAgeDays * 86400)}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
export const sidFrom = (req) => (req.get("cookie") || "").match(/(?:^|;\s*)sid=([a-f0-9]{64})/)?.[1];

// Who did what — append-only.
export function audit(user, action, detail = "") {
  store.create("audit", { userId: user?.id || "system", who: user?.name || "Blue/system", action, detail: String(detail).slice(0, 300) });
}
