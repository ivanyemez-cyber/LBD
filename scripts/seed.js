// Demo data for trying Blue. Stop the server first (it keeps data in memory), then: npm run seed
import fs from "node:fs";
const iso = (d) => new Date(Date.now() + d * 864e5).toISOString();
const day = (d) => iso(d).slice(0, 10);
if (fs.existsSync("data/db.json") && !process.argv.includes("--force")) {
  const db = JSON.parse(fs.readFileSync("data/db.json", "utf8"));
  if ((db.events || []).length > 1) { console.log("Data already exists. Use `npm run seed -- --force` to add demo data anyway."); process.exit(0); }
}
const s = await import("../store.js");

const sara = s.create("clients", { name: "Sara Costa", phone: "+351912345678", email: "sara@example.com", preferences: "Loves natural wine. Mum is gluten free." });
const james = s.create("clients", { name: "James Whitfield", phone: "+447700900123", email: "james@whitfield.example", company: "Whitfield Capital", preferences: "Team of 24, prefers boutique hotels, no early starts." });
const ana = s.create("clients", { name: "Ana & Leo", phone: "+34600111222", email: "ana.leo@example.com", preferences: "Honeymoon. Diving, sunsets, privacy." });

const quinta = s.create("suppliers", { name: "Quinta da Serra", category: "venue", contactName: "Rui", email: "events@quinta.example", phone: "+351210000111", location: "Sintra", rating: 5, responsiveness: "fast" });
const sabor = s.create("suppliers", { name: "Sabor Catering", category: "catering", contactName: "Marta", email: "marta@sabor.example", phone: "+351210000222", location: "Lisbon", rating: 4, responsiveness: "slow", notes: "Great food, always needs chasing." });
const vela = s.create("suppliers", { name: "Vela Yachts", category: "boats", contactName: "Nuno", phone: "+351210000333", location: "Cascais", rating: 5, responsiveness: "ok" });
const atlas = s.create("suppliers", { name: "Atlas Transfers", category: "transport", email: "ops@atlas.example", location: "Lisbon", rating: 3, responsiveness: "ok" });

const wedding = s.create("events", { name: "Sara & Tom · Sintra wedding", type: "wedding", status: "confirmed", clientId: sara.id, startDate: day(40), endDate: day(42), location: "Quinta da Serra, Sintra", headcount: 86, budget: 65000, currency: "EUR", faq: "Dress code: summer formal.\nShuttles leave Hotel Lumiares at 15:30." });
const offsite = s.create("events", { name: "Whitfield leadership offsite", type: "corporate", status: "quoted", clientId: james.id, startDate: day(25), endDate: day(28), location: "Comporta", headcount: 24, currency: "EUR" }); // no budget → autopilot flags it
const honeymoon = s.create("events", { name: "Ana & Leo · Maldives honeymoon", type: "honeymoon", status: "enquiry", clientId: ana.id, currency: "USD" }); // missing basics

for (const [t, time, title, loc] of [[40, "18:00", "Welcome drinks", "Park rooftop, Lisbon"], [41, "16:00", "Ceremony", "Quinta da Serra gardens"], [41, "19:30", "Dinner & dancing", "Quinta da Serra"], [42, "11:00", "Recovery brunch", "Hotel Lumiares"]])
  s.create("itinerary", { eventId: wedding.id, date: day(t), time, title, location: loc });

s.create("costs", { eventId: wedding.id, supplierId: quinta.id, item: "Venue hire", quoted: 18000, contracted: 18000, paid: 9000, dueDate: day(5) });
s.create("costs", { eventId: wedding.id, supplierId: sabor.id, item: "Dinner for 86", quoted: 14000, contracted: 15500, paid: 4000, dueDate: day(12) });
s.create("costs", { eventId: wedding.id, supplierId: atlas.id, item: "Guest shuttles", quoted: 2400, contracted: 2400, paid: 0, dueDate: day(30) });

s.create("tasks", { title: "Confirm final menu with Sabor", kind: "chase", supplierId: sabor.id, eventId: wedding.id, dueDate: day(-1), status: "todo", priority: "high" });
s.create("tasks", { title: "Venue balance due", kind: "deadline", eventId: wedding.id, dueDate: day(5), status: "todo", priority: "high" });
s.create("tasks", { title: "Hold sunset boat for offsite day 2", kind: "todo", supplierId: vela.id, eventId: offsite.id, dueDate: day(3), status: "todo" });

s.create("approvals", { eventId: wedding.id, question: "Which welcome cocktail?", options: ["Ginjinha spritz", "White port tonic", "Both!"] });

// Conversations: one client waiting 6h, one supplier silent for 3 days
s.create("messages", { direction: "in", channel: "whatsapp", from: "+351912345678", fromName: "Sara", threadKey: "351912345678", body: "Hi! Can we add 6 more guests to the dinner? And what time do the shuttles leave?", status: "triaged", at: iso(-0.25), clientId: sara.id, eventId: wedding.id, party: "client", triage: "Asks: +6 guests (86→92, check Sabor capacity & price), shuttle time (15:30 from Hotel Lumiares)." });
s.create("messages", { direction: "out", channel: "email", to: "marta@sabor.example", threadKey: "marta@sabor.example", body: "Hi Marta, could you confirm the final menu and gluten-free options for the Sintra wedding by Friday?", status: "sent", at: iso(-3), supplierId: sabor.id, eventId: wedding.id, party: "supplier" });
s.create("messages", { direction: "in", channel: "email", from: "james@whitfield.example", fromName: "James Whitfield", threadKey: "james@whitfield.example", subject: "Offsite quote", body: "Thanks for the proposal. Budget-wise we're flexible but finance will ask — what would a mid-range version look like?", status: "triaged", at: iso(-1), clientId: james.id, eventId: offsite.id, party: "client", triage: "Budget unclear ('flexible'). Wants a mid-range option. Suggest 3 tiers." });

console.log("🌱 Demo data added: 3 clients, 4 suppliers, 3 events, conversations, tasks and costs. Start the server and tap Inbox → Run now.");
