// Demo dataset for the Little Blue Door pitch. Starts from a clean slate so every rehearsal looks the same.
// Stop the server first (it keeps data in memory), then: npm run demo. Walkthrough: DEMO.md.
// Every client, supplier, phone number and booking ref below is fictional. Phones use the UK 07700 900xxx drama range.
import "../env.js";
import fs from "node:fs";
import crypto from "node:crypto";

// Your current data is moved aside, never deleted: rename it back to data/db.json to return to it.
// A previous demo run (marked by data/.demo) goes to db.last-demo.json, so rehearsals don't pile up copies.
if (fs.existsSync("data/db.json")) {
  const aside = fs.existsSync("data/.demo") ? "data/db.last-demo.json" : `data/db.before-demo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  fs.renameSync("data/db.json", aside);
  console.log(`Your previous data is saved as ${aside}`);
}
const s = await import("../store.js");
const { createUser } = await import("../auth.js");

fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/.demo", "This data was created by npm run demo.\n");
const iso = (d) => new Date(Date.now() + d * 864e5).toISOString();
const day = (d) => iso(d).slice(0, 10);
const lastYear = (n) => { const d = new Date(Date.now() + n * 864e5); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); };
const mmdd = (d) => day(d).slice(5);
const items = (eventId, rows) => rows.forEach(([d, kind, time, title, location, confirmation, supplierId, notes]) =>
  s.create("itinerary", { eventId, date: day(d), kind, time, title, location, confirmation, supplierId, notes }));

const email = (process.env.DEMO_EMAIL || "demo@littlebluedoor.example").toLowerCase();
const password = process.env.DEMO_PASSWORD || crypto.randomBytes(9).toString("base64url");
createUser({ name: process.env.DEMO_NAME || "Demo Planner", email, password, role: "admin" });

s.create("settings", { key: "fx", source: "demo rates (fetch real ones under People → Exchange rates)", rates: { USD: 0.92, GBP: 1.17, CHF: 1.05, JPY: 0.0061, MAD: 0.092, AED: 0.25 } });

// ---- Clients: a VIP family, a couple, a repeat corporate client, and past happy clients ----
const charlotte = s.create("clients", { name: "Charlotte Hartley", phone: "+447700900101", email: "charlotte@hartley.example", preferences: "Quiet luxury, small hotels, never big resorts. Travels with the children in school holidays.", dietary: "Coeliac (strict gluten free).", drinks: "Dom Pérignon; kids love fresh lemonade", roomPrefs: "Connecting rooms, high floor, sea view, blackout blinds", birthday: "1983-" + mmdd(3), anniversary: "2010-" + mmdd(60), nationality: "British", passportExpiry: day(900), loyalty: "BA Executive Club Gold · Aman Junkie", assistant: "Sophie (PA) · sophie@hartley.example · +447700900102", emergency: "Edward Hartley (husband) +447700900103", consentHealth: "yes", consentDate: day(-200), privacyNoticeAt: day(-200) });
const edward = s.create("clients", { name: "Edward Hartley", email: "edward@hartley.example", nationality: "British", passportExpiry: day(1200) });
const isla = s.create("clients", { name: "Isla Hartley (11)", nationality: "British", passportExpiry: day(700) });
const theo = s.create("clients", { name: "Theo Hartley (8)", nationality: "British", passportExpiry: day(200) }); // fine for the Maldives, but < 6 months after the ski trip → passport alert

const amara = s.create("clients", { name: "Amara Okafor", phone: "+447700900201", email: "amara@okafor.example", preferences: "Design hotels, natural wine, long lunches. Hates early flights.", dietary: "Pescatarian", drinks: "Orange wine, Negroni", roomPrefs: "King bed, bath tub, quiet side", birthday: "1990-" + mmdd(40), nationality: "British", passportExpiry: day(1500), loyalty: "Virgin Flying Club Gold", consentHealth: "yes", consentDate: day(-90), privacyNoticeAt: day(-90) });
const julian = s.create("clients", { name: "Julian Reyes", email: "julian@reyes.example", nationality: "Spanish", passportExpiry: day(2000) });

const marcus = s.create("clients", { name: "Marcus Vane", phone: "+447700900301", email: "marcus@vanepartners.example", company: "Vane Partners", preferences: "Partners' retreat every year. Wants one wow moment, no forced team building.", nationality: "British", passportExpiry: day(800) });
const helena = s.create("clients", { name: "Helena Brandt", phone: "+447700900401", email: "helena@brandt.example", preferences: "Safari obsessive. Photography, small camps, no crowds.", nationality: "German", passportExpiry: day(1000), anniversary: "2005-" + mmdd(50) });
const olivia = s.create("clients", { name: "Olivia Marsh", phone: "+447700900501", email: "olivia@marsh.example", preferences: "Riads, hammams, shopping with a guide.", nationality: "British", passportExpiry: day(1100) });

// ---- Suppliers: the little black book (all fictional) ----
const sup = (o) => s.create("suppliers", o);
const resort = sup({ name: "Coral Lagoon Island Resort", category: "hotel", contactName: "Aisha", contactRole: "Guest relations manager", phone: "+9603000111", email: "aisha@corallagoon.example", location: "Maldives", commission: 12, paymentTerms: "30% deposit, balance 30 days before arrival", rating: 5, responsiveness: "fast" });
const seaplane = sup({ name: "Blue Atoll Seaplanes", category: "transport", contactName: "Ibrahim", phone: "+9603000222", email: "ops@blueatoll.example", location: "Maldives", commission: 0, paymentTerms: "Billed by the resort", rating: 4, responsiveness: "ok" });
const chalet = sup({ name: "Chalet Les Étoiles", category: "villa", contactName: "Camille", contactRole: "Chalet manager", phone: "+33479000333", email: "camille@chalet-etoiles.example", location: "Courchevel", commission: 12, paymentTerms: "50% deposit, balance 60 days out", rating: 5, responsiveness: "slow", notes: "Wonderful, but always needs a nudge." });
const skiSchool = sup({ name: "Alpine Private Ski School", category: "guide", contactName: "Luc", email: "luc@alpineski.example", location: "Courchevel", commission: 10, rating: 5, responsiveness: "fast" });
const kyotoRyokan = sup({ name: "Ryokan Hanami", category: "hotel", contactName: "Sato-san", contactRole: "Okami", email: "stay@hanami.example", location: "Kyoto", commission: 8, paymentTerms: "Card guarantee, pay on departure", rating: 5, responsiveness: "ok" });
const tokyoGuide = sup({ name: "Tokyo Insider Guides", category: "guide", contactName: "Kenji", email: "kenji@tokyoinsider.example", location: "Tokyo", commission: 10, rating: 5, responsiveness: "fast" });
const safariCamp = sup({ name: "Delta Horizon Camps", category: "lodge", contactName: "Thabo", contactRole: "Sales", email: "thabo@deltahorizon.example", location: "Botswana", commission: 15, paymentTerms: "40% deposit, balance 90 days out", rating: 5, responsiveness: "ok" });
const riad = sup({ name: "Riad Dar Lune", category: "hotel", contactName: "Yasmine", contactRole: "GM", email: "yasmine@riaddarlune.example", location: "Marrakech", commission: 10, paymentTerms: "Commission paid monthly on checked-out stays", rating: 5, responsiveness: "fast" });
const comporta = sup({ name: "Comporta Pine Estate", category: "venue", contactName: "Rita", email: "rita@comporta.example", location: "Comporta", commission: 10, rating: 4, responsiveness: "ok" });

// ---- 1. Arriving tomorrow: the Hartleys in the Maldives (fills Today at a glance) ----
const bday = new Date(Date.now() + 3 * 864e5).toLocaleDateString("en-GB", { weekday: "long" });
const maldives = s.create("events", { name: "Hartley family · Maldives escape", type: "trip", status: "confirmed", clientId: charlotte.id, guestIds: [edward.id, isla.id, theo.id], supplierIds: [resort.id, seaplane.id], startDate: day(1), endDate: day(8), location: "Coral Lagoon, Noonu Atoll, Maldives", headcount: 4, budget: 52000, currency: "EUR",
  faq: "Seaplane luggage limit: 20 kg each in soft bags.\nAisha meets you on the jetty.\nThe resort kitchen knows about Charlotte's coeliac needs." });
items(maldives.id, [
  [1, "flight", "21:40", "BA 61 London Heathrow → Malé (overnight)", "Heathrow T5", "HX4R7T"],
  [2, "transfer", "13:30", "Seaplane to Coral Lagoon (45 min)", "Malé seaplane terminal", "", seaplane.id], // no ref yet → "unconfirmed" on the glance
  [2, "hotel", "14:30", "Check in · two-bedroom ocean villa with pool (6 nights)", "Coral Lagoon", "CL-58821", resort.id],
  [3, "activity", "09:00", "Private dhoni to the house reef, snorkelling with turtles", "Resort jetty", "CL-ACT-11", resort.id, "Snorkels and rash vests for Isla and Theo are ready at the jetty."],
  [3, "dining", "19:30", "Birthday dinner on a private sandbank, gluten-free menu", "Sandbank", "CL-DIN-07", resort.id],
  [6, "activity", "10:00", "Kids' marine biology morning", "Resort marine centre", "", resort.id],
  [8, "transfer", "11:00", "Seaplane back to Malé", "Coral Lagoon", "", seaplane.id],
  [8, "flight", "15:40", "BA 60 Malé → London Heathrow", "Malé airport", "HX4R7T"],
]);
s.create("costs", { eventId: maldives.id, supplierId: resort.id, item: "Two-bedroom ocean pool villa, 6 nights, half board", quoted: 38400, contracted: 38400, sell: 44200, paid: 38400 });
s.create("costs", { eventId: maldives.id, item: "BA Club World flights ×4 (booked in GBP)", currency: "GBP", quoted: 4800, contracted: 4800, sell: 5400, paid: 4800 });
s.create("costs", { eventId: maldives.id, supplierId: seaplane.id, item: "Seaplane transfers, both ways ×4", currency: "USD", quoted: 3200, contracted: 3200, sell: 3800, paid: 0, dueDate: day(2) });
s.create("costs", { eventId: maldives.id, supplierId: resort.id, item: "Sandbank birthday dinner", quoted: 1600, contracted: 1600, sell: 2000, paid: 0, dueDate: day(4) });
s.create("approvals", { eventId: maldives.id, question: "Which evening would you like the spa for two?", options: ["Day 3", "Day 5", "Surprise us"] });
s.create("drafts", { to: "aisha@corallagoon.example", channel: "email", subject: "Hartley family arriving the day after tomorrow", recipientType: "supplier", eventId: maldives.id, status: "draft",
  body: `Dear Aisha,\n\nThe Hartleys fly out of London tomorrow night and take the 13:30 seaplane the next day, so they should reach you around 14:30.\n\nA few notes for the team:\n· Charlotte is strictly coeliac, so please keep everything she is served fully gluten free.\n· Isla (11) and Theo (8) would love the kids' marine programme.\n· A bottle of Dom Pérignon on ice and fresh lemonade for the children on arrival.\n· ${bday} is Charlotte's birthday. The sandbank dinner is booked; could the chef add a small gluten-free cake?\n\nThank you, as always.\n\nWarm regards,\nLittle Blue Door` });

// ---- 2. Ski week in December (passport alert for Theo, slow supplier to chase) ----
const ski = s.create("events", { name: "Hartley family · Courchevel ski week", type: "trip", status: "confirmed", clientId: charlotte.id, guestIds: [edward.id, isla.id, theo.id], supplierIds: [chalet.id, skiSchool.id], startDate: day(45), endDate: day(52), location: "Courchevel 1850", headcount: 4, budget: 64000, currency: "EUR" });
items(ski.id, [[45, "flight", "08:10", "BA 2734 London → Geneva", "Heathrow T5", "GV2J9P"], [45, "transfer", "11:30", "Private transfer to Courchevel", "Geneva arrivals", "ALP-447"], [45, "hotel", "15:00", "Check in · Chalet Les Étoiles, fully staffed", "Courchevel 1850", "", chalet.id]]);
s.create("costs", { eventId: ski.id, supplierId: chalet.id, item: "Chalet Les Étoiles, 7 nights, chef and host", quoted: 48000, contracted: 48000, sell: 55000, paid: 24000, dueDate: day(6) });
s.create("costs", { eventId: ski.id, supplierId: skiSchool.id, item: "Private instructor for the children, 5 mornings", quoted: 3400, contracted: 3400, sell: 4000, paid: 0, dueDate: day(40) });
s.create("tasks", { title: "Get the chalet booking confirmation from Camille", kind: "chase", supplierId: chalet.id, eventId: ski.id, dueDate: day(-2), status: "todo", priority: "high" });
s.create("tasks", { title: "Chalet balance due (non-refundable after this)", kind: "deadline", eventId: ski.id, dueDate: day(6), status: "todo", priority: "high" });
s.create("messages", { direction: "out", channel: "email", to: "camille@chalet-etoiles.example", threadKey: "camille@chalet-etoiles.example", body: "Hi Camille, could you send the booking confirmation for the Hartley week in December? Many thanks.", status: "sent", at: iso(-3.2), supplierId: chalet.id, eventId: ski.id, party: "supplier" });

// ---- 3. Japan in the spring: multi-currency (JPY hotels, USD flights) on a EUR trip ----
const japan = s.create("events", { name: "Amara & Julian · Japan in blossom", type: "trip", status: "confirmed", clientId: amara.id, guestIds: [julian.id], supplierIds: [kyotoRyokan.id, tokyoGuide.id], startDate: day(160), endDate: day(171), location: "Tokyo & Kyoto", headcount: 2, budget: 32000, currency: "EUR" });
items(japan.id, [
  [160, "flight", "11:05", "JAL 42 London → Tokyo Haneda", "Heathrow T3", "JL8QW2"],
  [161, "activity", "10:00", "Private food walk through Tokyo's backstreets with Kenji", "Shibuya", "TIG-311", tokyoGuide.id],
  [165, "transfer", "09:00", "Shinkansen Green Car to Kyoto, luggage sent ahead", "Tokyo station", "JR-77810"],
  [165, "hotel", "15:00", "Check in · Ryokan Hanami (4 nights, kaiseki dinners)", "Kyoto", "RH-2044", kyotoRyokan.id],
]);
s.create("costs", { eventId: japan.id, item: "JAL business class ×2 (booked in USD)", currency: "USD", quoted: 11800, contracted: 11800, sell: 13200, paid: 11800 });
s.create("costs", { eventId: japan.id, supplierId: kyotoRyokan.id, item: "Ryokan Hanami, 4 nights half board", currency: "JPY", quoted: 1480000, contracted: 1480000, sell: 1700000, paid: 0, dueDate: day(171) });
s.create("costs", { eventId: japan.id, supplierId: tokyoGuide.id, item: "Private guiding, 2 days", currency: "JPY", quoted: 260000, contracted: 260000, sell: 320000, paid: 0, dueDate: day(130) });

// ---- 4. A proposal waiting: Helena's Botswana safari, three tiers, expires in 2 days ----
const safari = s.create("events", { name: "Helena · Okavango safari", type: "trip", status: "quoted", clientId: helena.id, supplierIds: [safariCamp.id], startDate: day(225), endDate: day(235), location: "Okavango Delta, Botswana", headcount: 2, currency: "USD" });
s.create("proposals", { eventId: safari.id, title: "Okavango, three ways", intro: "Small camps, private guiding and no crowds, so you can photograph the Delta properly.", validUntil: day(2),
  options: ["Classic | 24000 | 8 nights across two tented camps, shared game drives, scenic flight", "Private | 36000 | 9 nights, private vehicle and guide throughout, mokoro day, helicopter flight", "Ultimate | 52000 | 10 nights, exclusive-use camp, photographic hide, private plane between camps"] });
s.create("messages", { direction: "in", channel: "whatsapp", from: "+447700900401", fromName: "Helena", threadKey: "447700900401", body: "Loved the proposal! Torn between Private and Ultimate. Is the photographic hide really worth it in June?", status: "triaged", at: iso(-0.3), clientId: helena.id, eventId: safari.id, party: "client", triage: "Deciding between Private and Ultimate. Asks whether the photographic hide is worth it in June (dry season, so yes: animals concentrate at water)." });

// ---- 5. A corporate retreat in planning (no budget yet → Blue flags it) ----
const retreat = s.create("events", { name: "Vane Partners · Comporta retreat", type: "retreat", status: "planning", clientId: marcus.id, supplierIds: [comporta.id], startDate: day(180), endDate: day(183), location: "Comporta, Portugal", headcount: 14, currency: "EUR" });
s.create("tasks", { title: "Hold the estate for 14 guests", kind: "todo", supplierId: comporta.id, eventId: retreat.id, dueDate: day(4), status: "todo" });

// ---- 6. Just back from Marrakech: ask for feedback, collect commission ----
const marrakech = s.create("events", { name: "Olivia · Marrakech riad weekend", type: "trip", status: "completed", clientId: olivia.id, supplierIds: [riad.id], startDate: day(-8), endDate: day(-4), location: "Marrakech", headcount: 2, currency: "EUR" });
s.create("costs", { eventId: marrakech.id, supplierId: riad.id, item: "Riad Dar Lune, 4 nights, whole riad", contracted: 6400, sell: 7400, paid: 6400 });

// ---- History: last year's trips with 5★ feedback (Growth: rebook, referral, repeat clients, earnings) ----
s.create("events", { name: "Hartley family · Maldives (last year)", type: "trip", status: "completed", clientId: charlotte.id, startDate: lastYear(40), endDate: lastYear(47), location: "Maldives", currency: "EUR",
  feedback: { rating: 5, highlight: "Snorkelling with turtles. The children still talk about it.", improve: "", testimonial: true, at: iso(-350) } });
s.create("events", { name: "Helena · Namibia desert & dunes", type: "trip", status: "completed", clientId: helena.id, startDate: lastYear(30), endDate: lastYear(40), location: "Sossusvlei, Namibia", currency: "EUR",
  feedback: { rating: 5, highlight: "Dawn at Deadvlei with nobody else there", improve: "One long drive day could be a flight", testimonial: true, at: iso(-320) } });
s.create("events", { name: "Olivia · Lake Como long weekend", type: "trip", status: "completed", clientId: olivia.id, startDate: lastYear(25), endDate: lastYear(28), location: "Lake Como", currency: "EUR",
  feedback: { rating: 4, highlight: "The boat to Bellagio", improve: "Wanted one more free afternoon", testimonial: false, at: iso(-330) } }); // no trip booked this year → "rebook" on Growth
const vaneLast = s.create("events", { name: "Vane Partners · Douro retreat", type: "retreat", status: "completed", clientId: marcus.id, startDate: day(-150), endDate: day(-147), location: "Douro Valley", headcount: 12, currency: "EUR",
  feedback: { rating: 5, highlight: "Harvest lunch at the quinta", improve: "", testimonial: false, at: iso(-140) } });
s.create("costs", { eventId: vaneLast.id, item: "Quinta buy-out, 3 nights, all meals", contracted: 28000, sell: 34500, paid: 28000 });
s.create("costs", { eventId: vaneLast.id, item: "Private river boat and wine masterclass", contracted: 4200, sell: 5600, paid: 4200 });

// ---- Conversations: a client waiting on a reply, so the Inbox has something to show ----
s.create("messages", { direction: "in", channel: "whatsapp", from: "+447700900101", fromName: "Charlotte", threadKey: "447700900101", body: "So excited! Can the children do the seaplane in the same row as us? And is there anywhere gluten free for lunch on the snorkel day?", status: "triaged", at: iso(-0.2), clientId: charlotte.id, eventId: maldives.id, party: "client", triage: "Asks: family seated together on the seaplane (ask Blue Atoll), gluten-free lunch on the dhoni day (ask the resort)." });
s.create("tasks", { title: "Ask Blue Atoll to seat the Hartleys together", kind: "todo", supplierId: seaplane.id, eventId: maldives.id, dueDate: day(0), status: "todo", priority: "high" });

console.log(`\n🚪 Demo ready: 6 trips live, a proposal waiting, last year's 5★ trips, an inbox to work through.
   Sign in as ${email} / ${password}
   Then follow DEMO.md. Run \`npm run demo\` again before each rehearsal to reset.\n`);
