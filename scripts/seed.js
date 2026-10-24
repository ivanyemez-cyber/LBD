// Demo data for trying Blue. Stop the server first (it keeps data in memory), then: npm run seed
import "../env.js";
import fs from "node:fs";
const iso = (d) => new Date(Date.now() + d * 864e5).toISOString();
const day = (d) => iso(d).slice(0, 10);
if (fs.existsSync("data/db.json") && !process.argv.includes("--force")) {
  const db = JSON.parse(fs.readFileSync("data/db.json", "utf8"));
  if ((db.events || []).length > 1) { console.log("Data already exists. Use `npm run seed -- --force` to add demo data anyway."); process.exit(0); }
}
const s = await import("../store.js");

s.create("settings", { key: "fx", source: "demo rates — fetch real ones under People → Exchange rates", rates: { USD: 0.92, GBP: 1.17, CHF: 1.05 } });
const sara = s.create("clients", { name: "Sara Costa", phone: "+351912345678", email: "sara@example.com", preferences: "Loves natural wine. Mum is gluten free." });
const james = s.create("clients", { name: "James Whitfield", phone: "+447700900123", email: "james@whitfield.example", company: "Whitfield Capital", preferences: "Team of 24, prefers boutique hotels, no early starts." });
const ana = s.create("clients", { name: "Ana & Leo", phone: "+34600111222", email: "ana.leo@example.com", preferences: "Honeymoon. Diving, sunsets, privacy." });
const vic = s.create("clients", { name: "Victoria Hale", phone: "+447700900456", email: "victoria@hale.example", preferences: "Quiet luxury, no big resorts.", dietary: "Shellfish allergy (severe).", drinks: "Ruinart Blanc de Blancs", roomPrefs: "High floor, sea view, feather-free pillows.", birthday: "1984-" + day(9).slice(5), nationality: "British", passportExpiry: day(120), loyalty: "BA Executive Club Gold · Four Seasons Preferred", assistant: "Priya (EA) · priya@hale.example · +447700900457", emergency: "Tom Hale (husband) +447700900458", consentHealth: "yes", consentDate: day(-30), privacyNoticeAt: day(-30) });

const quinta = s.create("suppliers", { name: "Quinta da Serra", category: "venue", contactName: "Rui", email: "events@quinta.example", phone: "+351210000111", location: "Sintra", rating: 5, responsiveness: "fast" });
const sabor = s.create("suppliers", { name: "Sabor Catering", category: "catering", contactName: "Marta", email: "marta@sabor.example", phone: "+351210000222", location: "Lisbon", rating: 4, responsiveness: "slow", notes: "Great food, always needs chasing." });
const vela = s.create("suppliers", { name: "Vela Yachts", category: "boats", contactName: "Nuno", phone: "+351210000333", location: "Cascais", rating: 5, responsiveness: "ok" });
const atlas = s.create("suppliers", { name: "Atlas Transfers", category: "transport", email: "ops@atlas.example", location: "Lisbon", rating: 3, responsiveness: "ok" });

const wedding = s.create("events", { name: "Sara & Tom · Sintra wedding", type: "wedding", status: "confirmed", clientId: sara.id, startDate: day(40), endDate: day(42), location: "Quinta da Serra, Sintra", headcount: 86, budget: 65000, currency: "EUR", faq: "Dress code: summer formal.\nShuttles leave Hotel Lumiares at 15:30." });
const offsite = s.create("events", { name: "Whitfield leadership offsite", type: "corporate", status: "quoted", clientId: james.id, startDate: day(25), endDate: day(28), location: "Comporta", headcount: 24, currency: "EUR" }); // no budget → autopilot flags it
const honeymoon = s.create("events", { name: "Ana & Leo · Maldives honeymoon", type: "honeymoon", status: "enquiry", clientId: ana.id, currency: "USD" }); // missing basics

for (const [t, time, title, loc] of [[40, "18:00", "Welcome drinks", "Park rooftop, Lisbon"], [41, "16:00", "Ceremony", "Quinta da Serra gardens"], [41, "19:30", "Dinner & dancing", "Quinta da Serra"], [42, "11:00", "Recovery brunch", "Hotel Lumiares"]])
  s.create("itinerary", { eventId: wedding.id, date: day(t), time, title, location: loc });

const amalfi = s.create("events", { name: "Victoria · Amalfi long weekend", type: "trip", status: "confirmed", clientId: vic.id, startDate: day(1), endDate: day(4), location: "Positano", headcount: 2, budget: 18000, currency: "EUR" });
const villa = s.create("suppliers", { name: "Villa Treville", category: "villa", contactName: "Marco", contactRole: "Estate manager", phone: "+39089000111", location: "Amalfi", commission: 10, paymentTerms: "30% deposit, balance 14 days before, bank transfer", rating: 5, responsiveness: "fast" });
const tom = s.create("clients", { name: "Tom Hale", email: "tom@hale.example", passportExpiry: day(150), nationality: "British" });
s.update("events", amalfi.id, { guestIds: [tom.id], headcount: 2 });
for (const [t, kind, time, title, loc, conf] of [[1, "flight", "09:40", "BA 2606 London → Naples", "Heathrow T5", "XK7P2Q"], [1, "transfer", "14:00", "Private driver to Positano", "Naples airport arrivals", ""], [1, "hotel", "15:30", "Check in · Villa Treville", "Positano", "VT-2291"], [2, "activity", "10:00", "Private boat to Capri", "Positano pier", ""], [2, "dining", "20:30", "Dinner at La Sponda", "Le Sirenuse", "LS-88"], [4, "flight", "18:10", "BA 2607 Naples → London", "Naples airport", "XK7P2Q"]])
  s.create("itinerary", { eventId: amalfi.id, date: day(t), kind, time, title, location: loc, confirmation: conf, supplierId: kind === "transfer" ? atlas.id : kind === "hotel" ? villa.id : undefined });
s.create("costs", { eventId: amalfi.id, item: "Business class flights (booked in USD)", currency: "USD", quoted: 3400, contracted: 3400, sell: 3900, paid: 3400 });
s.create("costs", { eventId: amalfi.id, supplierId: villa.id, item: "Villa Treville, 3 nights", quoted: 9600, contracted: 9600, sell: 11200, paid: 2880, dueDate: day(-2) });

// Growth: a proposal waiting, last year's trip to rebook, a happy client to ask for referrals
s.create("proposals", { eventId: offsite.id, title: "Whitfield offsite — three ways", intro: "Three ways to do Comporta, all with boutique stays and no early starts.", validUntil: day(2),
  options: ["Essential | 38000 | Boutique hotel, 2 group dinners, one beach day", "Signature | 52000 | Private estate buy-out, chef, sunset sail", "Ultimate | 74000 | Estate + yacht day, wine masterclass, wellness programme"] });
const lastYear = (n) => { const d = new Date(Date.now() + n * 864e5); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); };
s.create("events", { name: "Sara · Douro harvest weekend", type: "trip", status: "completed", clientId: sara.id, startDate: lastYear(20), endDate: lastYear(23), location: "Douro Valley", currency: "EUR",
  feedback: { rating: 5, highlight: "The quinta lunch among the vines", improve: "", testimonial: true, at: iso(-340) } });
s.update("clients", vic.id, { anniversary: "2012-" + day(45).slice(5) });

// A trip that just ended: feedback to ask for, commission to collect
const paris = s.create("events", { name: "James · Paris weekend", type: "trip", status: "completed", clientId: james.id, startDate: day(-6), endDate: day(-3), location: "Paris", headcount: 2, currency: "EUR" });
const ritz = s.create("suppliers", { name: "Hôtel Lumière Paris", category: "hotel", contactName: "Claire", contactRole: "Head concierge", location: "Paris", commission: 10, paymentTerms: "Commission paid monthly on checked-out stays" });
s.create("costs", { eventId: paris.id, supplierId: ritz.id, item: "Suite, 3 nights", contracted: 7200, sell: 7900, paid: 7200 });

s.create("costs", { eventId: wedding.id, supplierId: quinta.id, item: "Venue hire", quoted: 18000, contracted: 18000, paid: 9000, dueDate: day(5) });
s.create("costs", { eventId: wedding.id, supplierId: sabor.id, item: "Dinner for 86", quoted: 14000, contracted: 15500, paid: 4000, dueDate: day(12) });
s.create("costs", { eventId: wedding.id, supplierId: atlas.id, item: "Guest shuttles", quoted: 2400, contracted: 2400, paid: 0, dueDate: day(30) });

// Client payments: the wedding balance lands after supplier balances (a cash gap), Amalfi still owes part of its payment
s.create("payments", { eventId: wedding.id, kind: "deposit", label: "Deposit (25%)", amount: 16250, received: 16250, receivedOn: day(-60), dueDate: day(-60) });
s.create("payments", { eventId: wedding.id, kind: "balance", label: "Balance", amount: 48750, received: 0, dueDate: day(14) });
s.create("payments", { eventId: amalfi.id, kind: "full", label: "Payment in full", amount: 15100, received: 10000, receivedOn: day(-20), dueDate: day(-20) });

s.create("tasks", { title: "Confirm final menu with Sabor", kind: "chase", supplierId: sabor.id, eventId: wedding.id, dueDate: day(-1), status: "todo", priority: "high" });
s.create("tasks", { title: "Venue balance due", kind: "deadline", eventId: wedding.id, dueDate: day(5), status: "todo", priority: "high" });
s.create("tasks", { title: "Hold sunset boat for offsite day 2", kind: "todo", supplierId: vela.id, eventId: offsite.id, dueDate: day(3), status: "todo" });

s.create("approvals", { eventId: wedding.id, question: "Which welcome cocktail?", options: ["Ginjinha spritz", "White port tonic", "Both!"] });

// Conversations: one client waiting 6h, one supplier silent for 3 days
s.create("messages", { direction: "in", channel: "whatsapp", from: "+351912345678", fromName: "Sara", threadKey: "351912345678", body: "Hi! Can we add 6 more guests to the dinner? And what time do the shuttles leave?", status: "triaged", at: iso(-0.25), clientId: sara.id, eventId: wedding.id, party: "client", triage: "Asks: +6 guests (86→92, check Sabor capacity & price), shuttle time (15:30 from Hotel Lumiares)." });
s.create("messages", { direction: "out", channel: "email", to: "marta@sabor.example", threadKey: "marta@sabor.example", body: "Hi Marta, could you confirm the final menu and gluten-free options for the Sintra wedding by Friday?", status: "sent", at: iso(-3), supplierId: sabor.id, eventId: wedding.id, party: "supplier" });
s.create("messages", { direction: "in", channel: "email", from: "james@whitfield.example", fromName: "James Whitfield", threadKey: "james@whitfield.example", subject: "Offsite quote", body: "Thanks for the proposal. Budget-wise we're flexible but finance will ask — what would a mid-range version look like?", status: "triaged", at: iso(-1), clientId: james.id, eventId: offsite.id, party: "client", triage: "Budget unclear ('flexible'). Wants a mid-range option. Suggest 3 tiers." });

console.log("🌱 Demo data added: 4 clients, 5 suppliers, 4 events, conversations, tasks, costs and client payments. Start the server and tap Inbox → Run now.");
