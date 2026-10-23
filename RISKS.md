# What can go wrong, and how Blue handles it

| Risk | What happens | Built in | Still to do |
|---|---|---|---|
| **AI is down or busy** | Chat fails | Friendly retry message; your message stays in the box | Queue and auto-retry |
| **AI gets a fact wrong** (date, price, visa rule) | Wrong info goes to a client | Blue only *drafts*; a human sends. Told never to invent prices or rules | "Check before sending" highlights on dates and amounts |
| **Prompt injection or scam email** ("new bank details, pay today") | Fraud | Pasted text treated as data; changed bank details flagged; card numbers and IBANs removed | Domain lookalike check |
| **Wrong client gets a link** | Itinerary exposed | Links can't be guessed, are hidden from search, and show no costs | Revoke or regenerate link, expiry dates |
| **Data loss** | Bookings gone | Atomic writes plus a daily backup (14 days kept) in `data/backups` | Move to Supabase with point-in-time restore |
| **Bad uploads** (huge file, disguised file) | Crash or abuse | 10 MB limit; PDF and images only; the file's actual contents are checked | Virus scan when hosted |
| **Personal data / GDPR** | Fines, trust | Minimal fields; no passports or cards; client data not cached on phones | Per-user logins, data-deletion request flow, data processing agreements with suppliers |
| **Shared passcode leaks** | Anyone can get in | Rate limit; passcode compared safely | Individual logins (Supabase Auth) |
| **Duplicate or messy records** | Confusion | Blue checks for existing records first | Merge tool |
| **Push notification not received** (iPhone) | Brief missed | Expired devices are cleaned up; in-app brief card | iPhone requires "Add to Home Screen" first |
| **Wrong timezone for the brief** | Brief arrives at the wrong time | Uses the server's clock (`BRIEF_TIME`) | Per-user timezone |
| **Supplier or client never replies** | Things slip | Chase and follow-up tasks with due dates, shown on the radar | Auto-escalation after 2 nudges |
| **No signal on a site visit** | Can't use the app | Offline banner; app shell is cached | Offline drafts, synced later |
