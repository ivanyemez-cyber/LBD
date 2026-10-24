// Loads the demo dataset from the command line. Stop the server first (it keeps data in memory), then: npm run demo.
// Accounts are kept; if there's no demo login yet, one is created and printed. Walkthrough: DEMO.md.
import "../env.js";
import crypto from "node:crypto";
const demo = await import("../demo.js");
const store = await import("../store.js");
const { createUser } = await import("../auth.js");

const { aside } = demo.load();
if (aside) console.log(`Your previous data is copied to ${aside}`);
const email = (process.env.DEMO_EMAIL || "demo@littlebluedoor.example").toLowerCase();
let login = "your existing login";
if (!store.list("users").some((u) => u.email === email)) {
  const password = process.env.DEMO_PASSWORD || crypto.randomBytes(9).toString("base64url");
  createUser({ name: process.env.DEMO_NAME || "Demo Planner", email, password, role: "admin" });
  login = `${email} / ${password}`;
}
console.log(`\n🚪 Demo ready. Sign in with ${login}.
   The demo guide is under People → Demo. Reset there (or run \`npm run demo\` again) before each rehearsal.\n`);
