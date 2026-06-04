Rolling Wrench AI Command Center V4.1 Professional

This build uses the V3 visual direction:
- V3-style home dashboard, module tiles, AI bar, status panels
- More professional graphite / steel / orange / blue color system
- No duplicate AI Assistant tile
- No duplicate Time Clock tile on home
- OEM Parts renamed to Parts Lookup
- Top Faults Today replaced by Today's Schedule
- Pin Drop kept
- Bottom nav: Home | Truck | Repair | Business | Schedule

Working screens:
- 3 Job Time Clock with Start / Pause / Stop / Save / Clear on each job
- Truck Profile with Back / Clear / Save
- Parts Lookup with Back / Clear / Save
- Fault Doctor with Back / Clear / Save
- Repair HUD with Back / Clear / Save
- Quotes, Invoices, Work Orders, Schedule, Customers, Pin Drop, PM Due, Settings
- LocalStorage save so data stays on the device

Upload all files to the root of your GitHub Pages repo and commit.


V4.2 UPDATE:
- Sign-in intentionally left for last.
- Rolling Wrench AI screen now works like a ChatGPT/Gemini style command center:
  + add photo/file/document
  take picture
  scan document
  scan invoice
  scan part box/label
  scan VIN plate
  voice input support when browser allows it
  save AI result to Truck, Parts, Work Orders, Quotes, Invoices, or Repair Memory
- Added Alerts screen.
- Home AI bar now shows + / voice / camera intent.


V4.3 UPDATE:
- Home AI bar is now clean: "Ask anything..." with no long example list.
- Tapping the AI bar opens a ChatGPT-style Rolling Wrench AI chat screen.
- AI conversations are saved in local storage and shown in a conversation list.
- + menu supports photo/file/document/invoice/part/VIN/camera workflow.
- Send button creates saved conversation messages.

V4.4: upgraded Professional Invoice and Smart Quote screens with AI Fill, pro preview, line items, totals, print/PDF, convert quote to invoice, and price-variance disclaimer.

V4.5: added speak-to-fill voice panels for Quotes, Invoices, Parts Lookup, Work Orders, and Schedule. Voice text can auto-fill labor, parts, and professional wording.

V4.6 UPDATE:
1. 3-job clock improved with send-to-work-order and send-to-invoice.
2. AI chat kept and local AI routing helpers added.
3. Customers upgraded into a linked customer database.
4. Truck profiles upgraded into fleet truck list and active truck history.
5. Supabase-ready settings added: URL, anon key, local sync test, status.
6. OCR scanner workflow added for VIN, invoice/receipt, part labels, documents/fault screens.
7. AI backend settings added for future endpoint/model connection.
Sign-in remains last.

V4.7: Added customer/driver signature pads for Quotes and Invoices. Works with touch, finger, stylus, mouse on iPhone, Android, tablet, and desktop. Signatures save into preview and records.

V4.8 UPDATE:
- Full Settings Control Center added.
- Theme Manager, Employee Manager, Pricing Manager, Alert Manager, Sound Manager, Display Manager, AI Settings, OCR Settings, Cloud/Backup, and Security placeholders.
- Export customers/trucks/quotes/invoices/all data as JSON.
- Restore database from JSON.
- Theme and display options apply immediately.

V5 CORE PLATFORM:
- Workflow Hub: Customer -> Truck -> Work Order -> Quote -> Invoice -> Reports
- AI command routing can create work orders, quotes, invoices, PM reminders
- OCR/camera workflow retained
- GPS/Pin Drop retained
- PM Manager added
- Inventory added
- Supplier Pricing notes added
- Notifications screen added
- Sign-in preview added, still last before real roles/cloud
- Settings V4.8 retained
NOTE: Real AI, real OCR, real supplier pricing, real GPS sharing, push notifications, and Supabase cloud sync require API/service connections after frontend approval.

V5.1 SUPABASE:
- Supabase URL and anon public key wired into frontend settings.
- Added Supabase Sync screen.
- Sync scaffold uses a generic rwd_app_data table.
Required SQL:
create table if not exists public.rwd_app_data (
  id uuid primary key default gen_random_uuid(),
  app_kind text,
  local_id text,
  payload jsonb,
  created_at timestamptz default now()
);
For testing before sign-in, RLS must allow anon insert/select/update or be disabled on this table.

V5.1a STABILITY PATCH: Settings button routes to safe settings screen, render function wrapped with fallback to prevent blank screens.

V5.2 REAL FUNCTIONALITY LAYER:
- AI Engine screen with backend endpoint/key placeholders and local workflow fallback.
- AI chat can call v52AskAi, route commands, and create workflow items.
- OCR Engine screen for VIN, invoice, part labels, fault screens, documents.
- Files / Storage screen for photos, files, signatures, invoices.
- GPS Manager for live geolocation, maps, and roadside work order creation.
- V5.2 dashboard added.
- Supplier pricing, Supabase, Workflow Hub retained.
NOTE: Real AI/OCR/supplier APIs require external service keys and server-side endpoints.

V5.2b SETTINGS HARD FIX:
- Added settings-fix.js loaded after app.js.
- Captures every Settings button/gear click before the main router.
- Opens a standalone Settings control center.
- Keeps Shop, Themes, Pricing, Employees, Alerts, Sounds, Display, AI, OCR, Cloud, Security.
- Prevents Settings from being blocked by router/module errors.
