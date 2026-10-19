# CampusDeck

A standalone React and TypeScript presentation marketplace with original templates, a structured slide editor, private workspaces, and real editable PowerPoint downloads. Built with Vite, not Next.js. No AI key, Canva, Google Slides, or other presentation service is required.

## Run locally

Install **Node.js 24 or newer** (the server uses Node's built-in SQLite).

```powershell
cd D:\project\campusdeck
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The SQLite database is created and seeded automatically at `.data/campusdeck.sqlite`. No database service or paid account is needed.

Register your own account through the interface. There are no default passwords. Guest users can browse, customise, edit, and export without registration; guest drafts are limited to the current browser tab. Registered users get database-backed workspaces.

To grant an existing local account administrator access:

```powershell
npm run admin -- your-registered-email@example.com
```

Then refresh the application and open `/admin`. Alternatively, configure `ADMIN_EMAILS` in `.env` before registration. Copy `.env.example` to `.env` to configure the port, database path, and account allowlist. Do not commit `.env`.

## What works

- Original, responsive marketplace with **18 real template families**, including **12 academic families**. Each has **16 slides**; no inflated catalogue counts.
- Text search across design name, sample project, description, category, department, and tags. Collection, academic need, department, style, light/dark, access filters, sorting, and pagination.
- Actual slide previews, thumbnail navigation, keyboard-controlled full-window presentation mode, and one-click original PPTX downloads.
- Guided college/project/team customisation, reusable academic profiles, and logo/image uploads.
- Structured editor: headings, subtitles, body points, tables, chart data, images, colours, fonts, layout changes, speaker notes, add/duplicate/reorder/delete, zoom, undo/redo, and debounced autosave with retry feedback.
- Native editable PowerPoint text, vector shapes, tables, charts with embedded Excel data, and embedded image assets. This is not a screenshot export. UTF-8 text, including Tamil, is preserved in PPTX; PowerPoint needs a font supporting the script.
- Real vector PDF export for Latin-script presentations. No LibreOffice or remote conversion service is required.
- Registration/login, HTTP-only sessions, private presentations, bookmark collections, export snapshots, rename/duplicate/delete, and download history.
- Template snapshots preserve the original design of a saved deck when catalogue metadata or colours change.
- Protected admin interface: create/duplicate/edit/publish/unpublish designs, colours and metadata, dynamic categories and renaming, member roles, real download totals, support messages, and audit logs.
- Dark mode, reduced-motion support, keyboard focus states, labelled form fields, dialog focus containment, responsive editor, lazy-loaded pages and export engines, locally bundled fonts, sitemap and public-page metadata.
- A functioning contact form stores messages in the administrator's support inbox. It does not send email or promise a response time.

## Template library

| Academic (12)         | Professional (6) |
| --------------------- | ---------------- |
| The Final Year        | Executive Navy   |
| Neural                | Pitch Perfect    |
| Engineering Blueprint | The Annual       |
| Research Notes        | Care & Clarity   |
| Thesis & Theory       | Perspective      |
| Clean Slate           | Gather           |
| Current               |                  |
| Vital                 |                  |
| Signal                |                  |
| Fieldwork             |                  |
| Launchpad             |                  |
| Foundation            |                  |

All samples are labelled. Missing student details, results, and references remain placeholders. Chart data is explicitly illustrative.

## Architecture

```text
src/lib/model.ts        Validated deck, profile, slide, template schemas
src/lib/templates.ts    Original seed catalogue and search
src/lib/scene.ts        Shared, deterministic layout and text fitting
src/components/SlideView.tsx   SVG preview of that same scene
src/lib/export.ts       Native PPTX and vector PDF renderers
src/pages/             Marketplace, editor, account, workspace, admin
server/api.ts          Validated API, identity, ownership and admin gates
server/sqlite.ts       Local SQLite adapter to the portable D1 interface
server/local.ts        Standalone Node HTTP server and Vite middleware
drizzle/               Schema migration and migration journal
scripts/build-worker.ts  React build packaging for a hosted D1 Worker
tests/                 API, isolation, template and export verification
e2e/                   Real browser journeys and download assertions
```

The browser preview and export use the same logical 1200 × 675 coordinate system. PowerPoint output is 13⅓ × 7½ inches (16:9), with one native PowerPoint object per scene element. Tables and charts use their native Office representations. Text is wrapped and fitted before either renderer runs. PowerPoint can apply slightly different font metrics; installed fonts affect appearance.

Local storage is SQLite; the hosted deployment uses Cloudflare D1 through the same parameterised query interface. Media is decoded, resized, and stored inside private deck/profile records. The bounded record format avoids a separate storage-service dependency in this release. Images are limited to PNG/JPEG, 10 MB before client resizing, about 500 KB after resizing; API request bodies are limited to 1.6 MB. Exported presentation sizes vary.

## Verification

```powershell
npm run check
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

The engine/API tests validate all 18 PPTX packages, slide counts, XML package entries, editable text, shapes, native tables, charts and embedded workbooks; custom text, colours, notes and Unicode; image embedding; PDF structure; text fitting; registration/login; save/reload; cross-account access denial; uploads; bookmarks; private download snapshots; admin publication; categories; disabled billing; and support messages.

Playwright starts an isolated in-memory test database on port 5174. It covers browse → preview → original download → personalise → edit → edited PPTX/PDF download → guest reload → register → save → reload → workspace → admin publication, plus mobile browsing/filtering/editor overflow. It extracts the downloaded PPTX and checks the user's edits. Screenshots, sample exports, and the HTML report are written under `artifacts/`, which is not published or committed. If needed, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can point to an already installed compatible Chromium binary.

PPTX contents are validated programmatically; desktop Microsoft PowerPoint is not installed in the build environment, so opening the generated files in that application remains a release check for the operator.

## Standalone production

### Vercel with MongoDB Atlas

The Vercel project is `vinothkumars-projects-d5644634/campusdeck`, connected to this GitHub repository. `vercel.json` deploys the React/Vite bundle from `dist/client` and one Node 24 API function in Mumbai. The MongoDB Atlas Marketplace integration supplies `MONGODB_URI`; `MONGODB_DATABASE` defaults to `campusdeck`. No credentials are embedded in the browser or committed to Git.

```powershell
npx vercel env pull .env.local --yes --scope vinothkumars-projects-d5644634
npm run dev:mongo
npm run test:mongo
npx vercel deploy --prod --scope vinothkumars-projects-d5644634
```

MongoDB stores slides and snapshots as embedded documents. Unique indexes protect identities and bookmarks; compound indexes support private workspace/history lookups; TTL indexes expire sessions and rate-limit counters. Category updates use a transaction. The same API also supports SQLite locally and D1 on Sites through `server/store.ts`. Database failures return an error rather than falling back to temporary storage. Each deployment provider has separate account data.

MongoDB integration tests use a randomly named test database and remove their documents afterward. Production browser checks can use `E2E_BASE_URL`, `E2E_EMAIL`, and `E2E_PASSWORD`; they verify a regular account and do not change the public catalogue.

To grant administrator access, register your real account first, then run this command with the correct server-side MongoDB environment:

```powershell
node --env-file=.env.local --import tsx scripts/admin.ts registered-email@example.com
```

The Vercel API does not grant administrator access based on an unverified signup email. The administrator command explicitly promotes an existing account.

### Persistent Node server

```powershell
npm ci
npm run build
npm start
```

Run behind an HTTPS reverse proxy, set `PUBLIC_ORIGIN` to the actual public HTTPS origin, set `SECURE_COOKIES=true`, and keep the SQLite file on persistent storage. `HOST=0.0.0.0` binds to all interfaces when required. Back up the database using SQLite's backup API or a consistent snapshot; do not copy only the database file while WAL writes are active.

Docker is also supported:

```sh
docker compose up --build -d
```

The compose file mounts a persistent database volume and serves port 5173. Configure HTTPS and environment variables for your actual deployment. Docker execution is not part of the automated browser test suite.

The `.openai/hosting.json` configuration targets a private Sites deployment with a `DB` D1 binding. `npm run build` emits the React client and an ESM Worker at `dist/server/index.js`. Hosted requests use the platform's authenticated identity headers, while the standalone server uses its own email/password sessions and ignores platform identity headers. Hosted administrator access is controlled by the server-only `ADMIN_EMAILS` environment value. Source deployments include the schema migration under `drizzle/`; the hosting service applies it before activating the Worker. Local and hosted databases are separate.

## Commercial and release boundaries

- Payments are **disabled**. Purchase, entitlement, and idempotent webhook-event tables are present, but there is no configured payment provider, fake successful checkout, or paid subscription. Premium metadata can be previewed; standard download requests require entitlement. All launch templates are free.
- Before enabling sales, implement server-side premium asset/export delivery plus a provider adapter with verified payment signatures, idempotent webhooks, refunds, and receipts. Client-side template definitions are intentionally inspectable for the free launch collection and are not DRM.
- Standalone account email verification, forgotten-password email delivery, and MFA are not included. Hosted identity inherits the hosting platform's sign-in protections.
- Browser PDF output supports Latin text. For Tamil or other scripts, download PPTX and use PowerPoint's PDF export; unsupported scripts produce a clear error rather than a corrupted PDF.
- This is a controlled layout editor, not a free-position canvas. It supports 1–40 slides per deck. Heavy media decks need a separate file store and larger export pipeline before scaling.
- New categories and variants can be managed in the database/admin UI. New structural design families are implemented in the shared layout engine. Sorting is curated, name, or catalogue order; there are no fabricated popularity metrics.
- Public pages are a React SPA with server-provided metadata for seed designs. Full server rendering, social-image rasterisation, dynamic SEO for administrator-created variants, and expanded university formatting rules are future enhancements.
- The included privacy and terms pages explain this implementation. The deployment operator must supply their legal entity/contact details and retention practices before a public commercial launch.

No external configuration is required for the local core workflow.
