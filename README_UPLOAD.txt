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

V6.0 PRODUCTION BUILD:
- Copyright/legal footer and About/Legal screen.
- Business Dashboard with KPIs and weekly graph.
- AI Operator for workflow automation.
- Photo Intelligence workflow.
- Schedule Command Center.
- Customer Portal preview.
- Technician Mode.
- Workflow automation hooks across customer/truck/work order/quote/invoice.
- Existing V5.2b settings fix retained.
NOTE: This is frontend/platform ready. Live AI/OCR/payment/customer portal public links still require backend/API deployment.

V6.1 CLOCK FIX: Rebuilt clock to use stored start timestamps, pause/stop base seconds, and live elapsed time. Start no longer resets/recalculates wrong.

V6.2 AUTH + DATABASE FOUNDATION: Supabase Auth sign-in/create/forgot hooks, Local Demo Mode, Account/Roles screen, role placeholders, protected route logic, logout.

V6.2a HOTFIX: Added missing ensureSettingsV48/applyUiSettings compatibility functions so Home loads correctly.

V6.2b STARTUP FIX: Added startup-home-fix.js to force Home render immediately on app open, bad hash fallback, and blank-screen recovery.

V6.3 CUSTOMER QUOTE APPROVAL: Send Quotes center, approval links, customer approval portal, approve/decline, signature, status tracking, approved quote creates Work Order, convert to Invoice.

V6.4 INVOICE PAYMENT + CUSTOMER PORTAL: Send Invoices center, invoice portal, sign invoice, paid/unpaid/partial status, payment method tracking, Square payment link placeholder, customer portal hub cleanup.

V6.5: Stability Center, route/button test, External Links center, Storage Prep for signatures/photos/files, Supabase link sync prep.

V6.6 REAL BACKEND CONNECTION:
- Added SUPABASE_SETUP.sql.
- Added Backend Center.
- Tests Supabase tables: shops, profiles, rwd_app_data, customer_links, file_records.
- Syncs core local data to rwd_app_data.
- Syncs customer quote/invoice links to customer_links.
- Prepares storage records for queued files/signatures.
- Added AI endpoint/OCR endpoint settings.
- Added SQL setup screen in app.
Next: create Storage bucket rwd-files and connect actual file upload endpoint/policies.

V6.7 CUSTOMER COMMUNICATION CENTER:
- Customer Messages screen.
- Build/send SMS for quote, invoice, payment link, GPS request, appointment reminder.
- Uses phone SMS app via sms: link.
- Communication timeline with sent/opened/approved/paid status.
- Message templates screen.
- Send Quote/Send Invoice centers now include Text buttons.
Next: Twilio/SMS API integration for automatic sent/opened delivery tracking.

V6.8 REAL FILE UPLOADS:
- File Uploads center.
- Camera/file picker for images, PDFs, docs, spreadsheets.
- Attach files/photos to Truck, Work Order, Quote, Invoice, Parts, Repair Memory.
- Image preview.
- Local file history.
- Storage queue integration.
- Supabase file_records sync prep.
- File History screen grouped by module.
NOTE: Browser local files are recorded/previewed. True cloud uploads require Supabase Storage bucket policies or an upload backend.

V6.9 OCR + VISION:
- OCR + Vision center.
- Scan VIN plates, part boxes/labels, invoices/receipts, fault screens, damage photos, repair photos, documents.
- Extracted field display.
- Save extracted results to Truck, Parts, Work Order, Quote, Invoice, Fault Doctor, Repair Memory.
- Vision history.
- Original file can be saved to File Uploads workflow.
- OCR/AI Vision endpoint settings.
NOTE: Local extraction is placeholder/smart workflow. Real OCR/vision requires backend endpoint with AI/OCR service.

V6.9.1 PRODUCTION CLEANUP:
- Repair Memory Library.
- Search/filter repair memory.
- New/Edit/Delete/Archive/Mark Test repair memories.
- Convert repair memory to Work Order or Invoice.
- Data Cleanup center.
- Delete test/demo records such as Jay/Bb/Test/Demo/Sample.
- Cleanup log.
- AI Summary helper for repair memory keywords/title.

V7.0 ROLLING WRENCH AI BRAIN:
- New RW AI Brain command center.
- One command box routes to quotes, invoices, work orders, repair memory, diagnostics, parts, OCR/vision, customer, truck, schedule, communications.
- Quick command buttons.
- AI context from active customer/truck/VIN/engine/rates.
- Local smart workflow fallback.
- Backend AI endpoint support through existing backend settings.
- AI action log.
- Brain settings screen.
- Auto-route / use-backend toggles.
NOTE: Real diagnostic intelligence and image understanding require live AI backend endpoint.

V7.1 REAL AI BRAIN UPGRADE:
- Replaced AI Brain with cleaner full-screen ChatGPT-style interface.
- Fixed raw \n display by rendering real line breaks.
- Stronger quote drafts with labor/service call/disclaimer.
- Stronger invoice drafts with professional wording.
- Stronger diagnostic workflow drafts.
- Warns when no active truck/customer is loaded.
- Simplified action buttons.
- Still supports backend AI endpoint if configured.

V7.1a AI SCREEN + QUOTE FIX:
- Forces every AI route/Ask AI entry point to open the ChatGPT-style full-screen AI.
- Old AI screen with Save buttons is bypassed.
- Fixes raw \n display in AI messages.
- Build a clutch quote for a 2014 Peterbilt with an ISX now creates an exact clutch quote draft:
  11.5 hrs, $135/hr, $250 service call, clutch parts list, disclaimer.
- AI creates quote record automatically.

V7.2 AI CHAT LAYOUT FIX:
- Chat input stays fixed and visible at the bottom like ChatGPT.
- Plus button and input are together like ChatGPT.
- Message area scrolls independently.
- Quote no longer dumps full quote into chat.
- AI creates compact quote card with action buttons.
- Follow-up command "Send to Quotes" opens Quotes instead of creating a new quote.
- Bottom nav hidden while AI chat is open.

V7.2a AI CLEAR + SEND-TO-QUOTES FIX:
- Added Clear button in AI chat header.
- "Clear", "clear chat", "new chat" clears AI conversation.
- "Send to quotes", "save quote", "open quotes" opens the saved quote draft instead of creating a new generic quote.
- Added hard guard so "send to quotes" cannot be interpreted as a new job.

V8.0 RW AI BRAIN: ChatGPT/Gemini-style assistant, clean cards, persistent truck/engine context, quote/invoice/memory/diagnostic routing, clear chat, fixed bottom input.

V8.1 AI CHAT BOX FIX:
- Fixed iPhone chat box cutoff.
- Send button no longer clips off right side.
- Removed always-on pause/voice button from normal chat layout.
- Input bar uses safe-area width and minmax sizing.
- Keyboard focus auto-scrolls newest messages/input.
- Added fallback CSS for older V7.2 AI bar if browser cache still shows it.

V8.5 STABLE BASE:
- Built from the V8.1 AI Chat Box Fix base.
- Removed/avoided V8.3 startup/login/router recovery patches.
- No forced login gate.
- No Startup Recovery loop.
- No forced route override loop.
- Keeps V8.1 AI/chat layout fixes.
- Adds only safe state normalization so old phone data does not crash modules.
TEST ORDER:
1. Home loads.
2. Bottom nav Home/Truck/Repair/Business/Schedule.
3. Settings opens.
4. Ask Rolling Wrench AI opens.
5. Quotes/Invoicing still open.

V8.6 SAFE FEATURE LAYER:
- Built on V8.5 Stable.
- NO login gate.
- NO startup recovery.
- NO forced home redirect.
- Adds Smart Quotes with signature pad.
- Adds saved quote/customer link tracking.
- Adds Repair Memory save/search/delete.
- Adds persistent Time Clock.
- Adds Schedule Board.
- Adds Earnings Graph.
- Adds active truck/customer memory helper.

V8.7 AI PREVIEW WORKFLOW:
- AI builds invoice/quote preview inside chat first.
- User can review on screen before saving.
- "Send to invoices" saves preview to Invoices.
- "Send to quotes" saves preview to Quotes.
- Preview has action buttons: Send to Invoices, Send to Quotes, Signature, Payment, Edit, Discard.
- Built on V8.6 stable. No login/startup/router recovery patches.

V8.8 REAL AI BACKEND CONNECTIONS:
- Adds Backend Connections page.
- AI Endpoint / Key.
- Web Search Endpoint / Key.
- Vision Endpoint / Key.
- OCR Endpoint / Key.
- Parts Search Endpoint / Key.
- RW AI chat calls backend AI when connected.
- Web/parts questions route to web/parts endpoints when configured.
- Quote/invoice preview workflow still works before saving to modules.
NOTE: This frontend cannot answer literally anything by itself. Connect a real backend AI/search/vision service to unlock ChatGPT/Gemini/Google-like behavior.

V8.9 AI ATTACHMENTS + SEND BUTTON FIX:
- Fixes AI send button off-screen on iPhone.
- Adds + button file/photo attachment in AI chat.
- Supports images, PDF, text/CSV/JSON file selection.
- Shows attached file chips and image preview in chat.
- Sends attachments to Vision backend if configured.

V9.0 REAL AI BRAIN:
- Replaces canned fallback with local diesel answers and backend-first AI.
- Adds X15/ISX water pump procedure fallback.
- Adds provider settings: OpenAI, Gemini, Claude, OpenRouter.
- AI endpoint test screen.
- Vision/photo endpoint retained.
- Quote/invoice preview workflow retained.
- No startup recovery/login/router hacks.

V9.0a FORCE AI BRAIN:
- Forces every AI route/renderer to the fixed V9 brain.
- Removes old canned 'I'm following...' fallback text.
- Adds local X15 water pump procedure answer.
- Adds hard click override for [data-route=ai]/brain.

V9.1 AI READABLE ANSWER FORMATTER: headings, bullets, ordered steps, callouts, and cards for repair answers.

V9.2 LIVE BACKEND CONNECTION:
- Frontend wired to https://rolling-wrench-ai-backend.onrender.com
- AI Endpoint: /api/ai
- Vision Endpoint: /api/vision
- Search Endpoint: /api/search
- Parts Endpoint: /api/parts
- AI screen shows AI Online instead of Local.
- Preserves V9.1 readable formatter.

V9.2a PARTS ROUTER FIX:
- Part numbers like 3101874 route to /api/parts.
- "cross reference", "part number", "OEM", "P/N", "xref" route to /api/parts.
- Weather words route to /api/search.
- Keeps V9.2 live backend connection.
