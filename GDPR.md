# GDPR: what Blue does, and what you still have to decide

This is a working draft to bring to a privacy lawyer or DPO. It is not legal advice.

## What the app now does for you
| Obligation | How Blue helps | Where |
|---|---|---|
| **Special-category (health) data, Art. 9** | Dietary and allergy details count as health data. The client record has an explicit-consent field and date. Saving dietary data without consent shows a warning, and those details are hidden from the AI until consent is recorded. | Client form · Today at a glance · Privacy & GDPR |
| **Data minimisation, Art. 5(1)(c)** | Blue (and so the AI provider) never receives emergency contacts, PA details, loyalty IDs, passport dates, nationality or birthdays. The app stores a passport *expiry date* only, never the number. Card numbers and IBANs are redacted. | `privacy.js` → `forAgent` |
| **Transparency, Art. 13** | A "privacy notice sent on" date for each client, plus a list of clients who haven't had one. | Privacy & GDPR |
| **Right of access / portability, Arts. 15 and 20** | Admins can export one client's full record as JSON: details, events, itinerary, approvals, messages and drafts. Each export is logged. | Client → Export their data |
| **Right to erasure, Art. 17** | Removes the client's personal details, WhatsApp/email messages and drafts, and their name from the activity log. Events, itinerary and costs stay, anonymised, for accounting. You must type the client's name to confirm, and each erasure is logged. | Client → Erase client |
| **Storage limitation, Art. 5(1)(e)** | Lists clients with no activity for `RETENTION_MONTHS` (default 24) so you can review them. Nothing is deleted automatically. | Privacy & GDPR |
| **Accountability, Art. 5(2)** | Activity log of logins, record changes, exports and erasures. | Team & activity, Privacy log |
| **Security, Art. 32** | Per-user logins, password lockout, unguessable share links that can be revoked, no client data cached on phones, and vouchers reachable only through their own trip link. | — |

## Decisions only you can make
1. **Lawful basis for each kind of data.** Contract (Art. 6(1)(b)) covers booking the trip. Allergies need explicit consent (Art. 9(2)(a)). Marketing needs separate consent. Write these down in a record of processing.
2. **Retention periods.** Pick a period for client records (24 months is the app default) and for accounting records (usually 6–10 years under local tax law). Then set `RETENTION_MONTHS`.
3. **Processors and international transfers.** Each one needs a signed data processing agreement (DPA). Check how each covers transfers out of the EU (SCCs or the EU–US Data Privacy Framework):
   - **Anthropic:** the AI. Messages and records are sent to it for processing.
   - **Meta:** WhatsApp Business Cloud API.
   - **Your inbound email provider:** Postmark, Mailgun, SendGrid, Zapier or similar.
   - **Your hosting provider:** Fly.io, Render, Railway or similar.
   - **Push services:** Apple, Google and Mozilla, which carry morning-brief notification text only.
4. **Suppliers you share data with** (hotels, villas, drivers). They are usually independent controllers. Share only what each one needs; Blue is told to send a restaurant the allergy itself, not the whole dossier.
5. **Breach procedure.** Decide who notifies the regulator within 72 hours and who tells affected clients. Record where the breach log is kept.
6. **DPIA.** A data protection impact assessment is likely needed, because the app holds health data and uses an AI to process it.

## Known gaps in the software
- **Backups:** daily backups in `data/backups` keep erased data for up to 14 days before they roll off. Say so in your privacy notice.
- **Uploads:** vouchers and attachments in `data/uploads` are not deleted on erasure, because they're tied to bookings. Remove them by hand if a client asks.
- **Encryption at rest:** the JSON file store is not encrypted. Use an encrypted disk or volume, or move to Postgres/Supabase with encryption at rest.
- **Free text:** erasure clears the client record, but event names and notes ("Sara & Tom · Sintra wedding") and allergy details typed into general *Preferences* are not detected. Rename such events by hand, and keep allergies in the *Dietary & allergies* field so consent checks apply.
- **Exports:** the "Export all data" and CSV exports include every client. Limit who can use them.
- **Privacy notice text:** the app records *when* a notice was sent. You still need to write the notice itself.
