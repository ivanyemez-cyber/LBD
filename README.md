# Blue 🚪 — the Little Blue Door assistant

A mobile-first PWA where travel agents and event planners chat with **Blue**, an AI sidekick that organizes events, suppliers, clients, tasks, and message drafts.

## Run
1. Fill in `.env`: `ANTHROPIC_API_KEY` and a real `APP_PASSCODE`
2. `npm install && npm start` → open http://localhost:3000 (on a phone: "Add to Home Screen")

## How it works
- `agent.js`: Blue's personality, safety rules, tools, and the tool-use loop (Claude API)
- `store.js`: JSON-file storage in `data/db.json` (swap for Supabase/Postgres in production)
- `server.js`: Express API with a passcode, rate limiting, and security headers
- `public/`: chat plus Events / Tasks / Drafts / People tabs, voice dictation, installable PWA

## Safety by design
- **Blue never sends anything.** It only creates drafts. A human copies the draft or opens it in mail/WhatsApp, then marks it sent.
- Card numbers and IBANs are removed before they reach the model or storage.
- Pasted emails are treated as data, not instructions, and Blue flags things like changed bank details as possible fraud.
- Blue asks for confirmation before deleting anything, and the app never caches client data on the device.

## Before real use
Give each person their own login instead of a shared passcode, move to a real database, run it over HTTPS, and get a GDPR review of what client data is stored.

## Planner features
- **Today at a glance** (top of Chat, and in the morning push): arrivals and departures in the next 48h, today and tomorrow's itinerary, passport alerts under the 6-month rule, unconfirmed flights, transfers and hotels in the next 14 days, pre-arrival hotel notes to send, client birthdays and anniversaries, and drafts waiting for approval.
- **VIP dossier** on each client: dietary needs and allergies, drinks, room preferences, celebrations, loyalty IDs, PA/EA and emergency contacts, and passport *expiry date* (never the number).
- **Itinerary builder:** each item has a type (flight/transfer/hotel/dining/activity), start and end times, a confirmation ref, and an optional voucher (PDF/image). The client opens vouchers from their `/t/` link; each file is only reachable through the trip it's attached to. The client page can be printed or saved as a PDF.
- **Supplier directory:** filter by destination and category, with the direct contact and their role, commission %, and payment terms.
- **Add to calendar:** the client trip page offers the whole itinerary as a calendar file (`/t/<token>/trip.ics`), so it's in their phone offline.
- **Commission tracker:** expected commission per cost line (the supplier's agreed %, or a % on the line) against what's been received. Shown on the budget tab, the internal sheet, and *Commission to collect* on Today at a glance.
- **Post-trip feedback:** trips that ended in the last two weeks show on Today at a glance with a ready request draft. The client rates the trip at `/f/<token>`, can opt in to being quoted as a testimonial, and a rating of 3★ or below creates a high-priority "call the client" task.
- **People on trips:** each trip has a lead client plus other travellers, and a list of suppliers. Add existing ones from the trip page, or create new ones there and they're linked automatically. Itinerary items can name their supplier and which travellers they're for. Passport checks cover every traveller, and client and supplier pages list every trip they're on.
- **Proposals:** send tiered options (*Name | price | what's included*, one per line) on a private link at `/p/<token>`, held until a date you set. When the client chooses, the trip is confirmed, its budget is set, and contract/deposit and supplier-confirmation tasks are created. Proposals close to expiring show on Today at a glance.
- **Trip templates:** *Use as template* on any trip copies its itinerary and costs onto new dates. Booking refs, vouchers and payments are not copied.
- **Growth** (Events tab): pipeline value, win rate, this year's earnings (margin + commission), average rating and repeat clients, plus revenue opportunities (rebook last year's trip, an upcoming anniversary, referrals from 5★ clients), each with a pitch Blue can draft.
- **One currency per total:** each cost line can be in its own currency (USD flights on a EUR trip). Trip totals, cost sheets and commission are converted into the trip's currency, and Growth into `BASE_CURRENCY` (default EUR). Admins set rates under People → Exchange rates, or fetch the latest ECB rates. If a rate is missing, the amount is left out and flagged, never added at face value.
- **Deposit & payment schedule** (Event → Payments): what the client pays and when, next to supplier due dates. *Create deposit + balance* sets a deposit now and the balance before departure (`DEPOSIT_PCT`, default 30, and `BALANCE_DAYS_BEFORE`, default 60), priced from the client prices on cost lines, else the accepted proposal, else the budget. If the balance date has already passed, it's one payment in full. Accepting a proposal creates the schedule automatically. Each payment can be in its own currency; totals, overdue amounts and the **cash gap** (suppliers due more than the client will have paid by then) are converted into the trip's currency through the same exchange rates. Overdue and due-this-week payments show on Today at a glance with a reminder draft, and the schedule prints on both cost sheets.
- **Cost sheets:** Event → Budget gives you a client sheet (sell prices only) or an internal sheet (net, sell, margin), ready to print as a PDF.

## Privacy & data quality
- **GDPR tooling** (People → Privacy & GDPR): health-data consent tracking, a client data export for access requests, client erasure, a retention review (`RETENTION_MONTHS`, default 24), and a privacy log. Blue never sees emergency contacts, loyalty IDs or passport dates, and only sees allergies once consent is recorded. Set `DATA_KEY` to encrypt the database at rest. On each client, *Draft privacy notice* sends `privacy-notice.md` for approval. Read [GDPR.md](GDPR.md) for the decisions that are still yours to make.
- **Data-quality guardrails:** saving a booking without a type or confirmation ref shows a warning first. Today at a glance lists missing details (untyped items, trips with no flight/hotel/transfer, no passport expiry date). Paste or forward a booking confirmation and Blue turns it into a typed, referenced itinerary item.

## Inbox, autopilot & WhatsApp
- **Inbox tab:** WhatsApp and email threads. Each section shows what needs a reply, drafts to approve, and threads where you're waiting on the other side.
- **Triage:** every inbound message goes to Blue, which matches the sender to a client or supplier, links it to the event, creates a task for each question, updates records, flags possible scams, and writes **one reply draft** for a person to approve.
- **Autopilot** runs every `AUTOPILOT_MINUTES`. It creates tasks and nudge drafts for clients who've waited longer than `SLA_CLIENT_HOURS`, suppliers who've been quiet longer than `SLA_SUPPLIER_HOURS`, missing or exceeded budgets, enquiries missing basic details, and approvals waiting more than 3 days. It never creates the same task twice, and after two unanswered nudges it suggests a phone call instead.
- **To test without WhatsApp:** Inbox → *Simulate incoming*.

### Connect WhatsApp Business (Meta Cloud API)
1. In developers.facebook.com, create an app, add the **WhatsApp** product, and add your business phone number.
2. Put these in `.env`: `WHATSAPP_TOKEN` (a permanent system-user token), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, and a `WHATSAPP_VERIFY_TOKEN` of your choice.
3. Set the webhook URL to `https://<your-host>/webhooks/whatsapp`, using the same verify token, and subscribe to **messages**. Meta needs a public HTTPS address; for local testing, use a tunnel such as `cloudflared tunnel --url http://localhost:3000`.
4. Replies can be sent from Blue (**Send via WhatsApp**) only within 24 hours of the customer's last message, because that's WhatsApp's rule. Outside that window, use an approved template or send it from the WhatsApp app.

### Inbound email
Point any inbound-parse service (Postmark, Mailgun, SendGrid, Zapier) to `POST /webhooks/email?key=<INBOUND_EMAIL_KEY>`.

## Accounts, demo data, tests, deploy
- **First run:** the app asks you to create an admin account; you'll need `APP_PASSCODE` from `.env`. After that, everyone signs in with their own email and password. Admins can add or remove teammates and see the activity log, including what Blue did, under People → Team & activity.
- **Demo data:** stop the server, run `npm run seed`, then start it again.
- **Pitch demo:** `npm run demo` loads a fictional luxury-travel dataset and prints a sign-in. After that, People → Demo has a step-by-step demo guide and a *Reset demo data* button. Walkthrough: [DEMO.md](DEMO.md).
- **Tests:** `npm test` (also runs on every PR via GitHub Actions)
- **Deploy:** `docker build -t blue . && docker run -p 3000:3000 -v blue-data:/app/data --env-file .env blue`. Put it behind HTTPS (Fly.io, Render and Railway all handle this) and set `NODE_ENV=production`.
