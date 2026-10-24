# Demo: "We can build this for you"

A 10-minute walkthrough of Blue for the Little Blue Door team. It follows one day in a planner's life: the morning check, a new enquiry turned into a proposal, the client's side of things, and the business view.

Everyone in the demo data is fictional (clients, suppliers, phone numbers, booking refs). Dates are relative to the day you run `npm run demo`, and the trips are chosen to look right for a demo between November and January (Maldives now, Courchevel in December, Japan for the blossom, Botswana in June). Run it again on the morning of the demo so "tomorrow" is really tomorrow.

## Before the meeting

1. `.env` needs a working `ANTHROPIC_API_KEY` and an `APP_PASSCODE`. Steps 2 and 3 below are live AI calls.
2. Stop the server, then reset the data:
   ```
   DEMO_PASSWORD='pick-something-long' npm run demo
   npm start
   ```
   Without `DEMO_PASSWORD` a random one is printed. Your previous `data/db.json` is moved aside, not deleted.
3. Sign in as `demo@littlebluedoor.example` on a phone (Add to Home Screen) and on a laptop. Show the phone; keep the laptop for the client-side pages.
4. Rehearse twice, end to end. Reset with `npm run demo` between runs.
5. Have the paste-ins below in your phone's notes so you aren't typing live.

## The flow

### 1. The morning check (1 min): Chat tab
Open the app. **Today at a glance** is the first thing a planner sees:
- The Hartleys fly to the Maldives tomorrow night, and their seaplane has no confirmation number yet.
- Theo Hartley's passport fails the 6-month rule for the December ski trip.
- Charlotte's birthday is in 3 days, and her coeliac note is already in the hotel pre-arrival draft.
- Helena's safari proposal expires in 2 days.
- Olivia is back from Marrakech: ask for feedback, collect the riad's commission.

**Line to land:** "Before you've had a coffee, Blue has read every trip and told you the five things that matter today."

### 2. A new enquiry (2 min): Inbox → Simulate incoming
Channel WhatsApp, from `+447700900601`, name `Priya Nair`, and paste:

> Hi! Charlotte Hartley gave me your number, she says you're magic. My husband and I want to do Japan for our 10th anniversary next April, around 10 days. We love food, design hotels and one really special ryokan. Budget roughly €35k. Could you help?

Blue triages it: it should see this is a new client, note the referral from Charlotte, create the enquiry and tasks, and write one reply draft. Check what it does in rehearsal; it's a live AI call. Open the draft and show that **Blue never sends anything**: a person approves it.

**Fallback if the AI is slow:** open the existing WhatsApp from Helena in the Inbox. It's already triaged.

### 3. Enquiry to proposal (2 min): Chat tab
Type:

> Make Priya Nair's Japan anniversary trip a three-tier proposal, valid for 7 days. Use Ryokan Hanami and Tokyo Insider Guides.

Blue creates the proposal using the suppliers already in the directory. Open the trip → Overview → Proposals → **Preview**.

**Fallback:** Events → *Helena · Okavango safari* → Proposals → Preview. It's ready-made.

### 4. The client's side (2 min): laptop
- On the proposal page, click **Choose Private**. Back in the app, the trip is confirmed, the budget is set, and contract/deposit and supplier tasks have appeared.
- Events → *Hartley family · Maldives escape* → **Preview** the trip page: day-by-day itinerary, booking refs, *Add to my calendar*, *Print / save as PDF*. No prices are ever shown to the client.

**Line to land:** "This is what your clients see. Your branding, no app to download, and it works offline once it's in their calendar."

### 5. Paste a supplier confirmation (1 min): Chat tab
Paste:

> Booking confirmed. Seaplane transfer for HARTLEY x4, Malé to Coral Lagoon, day after tomorrow 13:30, ref BAS-77120. Luggage 20kg soft bags. Blue Atoll Seaplanes

Blue turns it into a typed, referenced itinerary item. In rehearsal, check whether it updates the existing seaplane line (the "unconfirmed" warning goes away) or adds a new one; if it adds one, say "update the existing seaplane item" in your paste.

### 6. The money (1 min): Events → Maldives → Budget
- Costs in EUR, GBP and USD, all converted into one total.
- **Client cost sheet** (sell prices only) vs **Internal sheet** (net, sell, margin).
- Commission expected vs received.

### 7. The business (1 min): Events → Growth
Pipeline value, win rate, this year's margin and commission, average rating, and the next revenue to go after: rebook Olivia's Lake Como trip, Helena's anniversary, referrals from 5★ clients. Tap one and Blue drafts the pitch.

### 8. Trust (30 sec): People → Charlotte Hartley
The VIP dossier: allergies, drinks, rooms, PA, passport *expiry only*. Blue doesn't see emergency contacts, loyalty numbers or passport dates, and only sees health details with recorded consent.

## What not to claim

It's a working prototype, not production software. Say "pilot", and name the next phase honestly: per-agency hosting, a real database, connecting your WhatsApp Business number and inbox, and a privacy review before real client data goes in.
