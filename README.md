# CampusDeck

A standalone React and TypeScript presentation marketplace with original templates, a structured slide editor, private workspaces, and real editable PowerPoint downloads. Built with Vite, not Next.js. No AI key, Canva, Google Slides, or other presentation service is required.

## Run locally

Install **Node.js 24** (the server uses Node's built-in SQLite).

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

- A responsive blue-and-navy marketplace with **41 working templates across 12 design families**, including **22 college templates**. New templates contain **12–17 complete slides**, depending on their content set; the interface reports the actual generated count.
- An interactive homepage preview lets visitors edit a title, try designs and colour themes, preview cover/problem/results slides, and carry their choices into the editor.
- Create a Presentation offers a genuine blank start: one empty widescreen slide, optional filename, no sample student details, and native PPTX/PDF export. Add text, images and slides, or apply a design without replacing your content.
- Search by template, topic, requirement or department. Category, academic requirement, department, style, colour, slide-length and access filters, sorting, grid density, and pagination. Header search opens with `/` or Ctrl/Command+K.
- Actual slide previews, thumbnail navigation, three coordinated colour themes per new design family, keyboard-controlled full-window presentation mode, and original PPTX downloads.
- Guided college/project/team customisation, reusable academic profiles, and logo/image uploads.
- Structured editor: headings, subtitles, body points, tables, chart data, images, colour themes, headline fonts, layout changes, speaker notes, add/duplicate/reorder/delete, zoom, undo/redo, and debounced autosave with retry feedback.
- Native editable PowerPoint text, vector shapes, tables, charts with embedded Excel data, and embedded image assets. This is not a screenshot export. UTF-8 text, including Tamil, is preserved in PPTX; PowerPoint needs a font supporting the script.
- Real vector PDF export for Latin-script presentations. No LibreOffice or remote conversion service is required.
- If an open tab references an outdated download module after deployment, **Reload and download** preserves the exact presentation, theme and format and retries once. Newer editor drafts are retained; blocked browser storage prevents an unsafe reload. Failed history updates do not discard generated downloads.
- Registration/login, HTTP-only sessions, private presentations, bookmark collections, export snapshots, rename/duplicate/delete, and download history.
- Template snapshots preserve the original design of a saved deck when catalogue metadata or colours change. Existing presentations and original template links remain supported alongside the new collection.
- Protected admin interface: create/duplicate/edit/publish/unpublish designs, colours and metadata, dynamic categories and renaming, member roles, real download totals, support messages, and audit logs.
- A consistent light interface, reduced-motion support, keyboard focus states, labelled form fields, dialog focus containment, responsive editor, lazy-loaded pages and export engines, locally bundled fonts, sitemap and public-page metadata. Dark slide designs remain available independently of the interface theme.
- A functioning contact form stores messages in the administrator's support inbox. It does not send email or promise a response time.

## Template library and routes

| Collection | Templates |
| ---------- | --------- |
| College    | 22        |
| Corporate  | 5         |
| Business   | 5         |
| Healthcare | 3         |
| Research   | 3         |
| Events     | 3         |

The 41 templates use 12 visual families: Meridian, Atlas, Kepler, Halcyon, Vertex, Ledger, Pulse, Gala, Swiss, Strata, Canopy and Mono. They use 14 complete content sets, including dedicated outlines for capstone proposals, literature reviews, lab reports, internships, portfolios, industrial visits, nonprofit impact and strategy workshops. Each family has three colour themes. Original designs remain available for existing projects and links. Legacy designs and the internal blank starter do not inflate the marketplace's 41-template count.

Browse `/templates` or the collection routes `/college`, `/corporate`, `/business`, `/healthcare`, `/research` and `/events`. Template detail pages use `/templates/:id`. `/create` offers a blank start or prepared templates; `/editor` redirects there. `/editor/blank` opens a new empty deck, while `/editor/:id` opens a selected design or saved deck. `/customise/:id` provides the guided academic form. `/how-it-works` explains the complete workflow. Real account access is available at `/sign-in` and `/sign-up`, with private work under `/workspace` and administration under `/admin`. Existing `/explore` and `/auth` links remain compatible.

The interface uses locally bundled Geist and Geist Mono. Slide designs use Sora, Space Grotesk, Instrument Serif, Newsreader and Archivo as well as Geist; the editor allows headline-font changes. Fonts are not fetched from a third-party service at runtime. The receiving PowerPoint application needs the chosen fonts installed for identical appearance.

Sample project text, charts, references and results are illustrative. Replace them with your own verified work before presenting. Counts are derived from the generated slides; prototype-only slide totals, sales claims and popularity statistics are not presented as measured product facts.

## Design handoff decision

The supplied visual handoff described a UI-only demo with mocked sign-in and unavailable downloads. The user explicitly chose to apply its design to the existing CampusDeck while retaining every working feature. The implementation therefore adopts its visual system, navigation, curated collection and page layouts while preserving real authentication, MongoDB persistence, academic profiles, saved presentations and editable PPTX/PDF exports. It does not replace those features with demo notices or fake success states. Payments and unsupported account features remain subject to the release boundaries below.

## Architecture

```text
src/lib/model.ts        Validated deck, profile, slide, template schemas
src/lib/templates.ts    Original seed catalogue and search
src/data/              Supplied design metadata, content sets and curation
src/lib/slides/        New family resolution, content and native scene construction
src/lib/marketplace.ts Category, requirement and filter helpers
src/lib/scene.ts        Shared, deterministic layout and text fitting
src/components/SlideView.tsx   SVG preview of that same scene
src/styles/refine.css   Interaction and finish rules, token-only (docs: artifacts/design-handoff/.../02-design-system.md)
src/lib/export.ts       Native PPTX and vector PDF renderers
src/pages/             Marketplace, editor, account, workspace, admin
server/api.ts          Validated API, identity, ownership and admin gates
server/store.ts        Shared logical storage operations
server/mongo.ts        MongoDB persistence and indexes
server/sqlite.ts       Local SQLite adapter to the portable D1 interface
server/local.ts        Standalone Node HTTP server and Vite middleware
drizzle/               Schema migration and migration journal
scripts/build-worker.ts  React build packaging for a hosted D1 Worker
tests/                 API, isolation, template and export verification
e2e/                   Real browser journeys and download assertions
```

The browser preview and export use the same logical 1200 × 675 coordinate system. PowerPoint output is 13⅓ × 7½ inches (16:9), with one native PowerPoint object per scene element. Tables and charts use their native Office representations. Text is wrapped and fitted before either renderer runs. PowerPoint can apply slightly different font metrics; installed fonts affect appearance.

Local development defaults to SQLite; the public Vercel deployment uses MongoDB Atlas. Both use the shared storage interface, with an optional D1 adapter retained for the earlier Sites deployment. Media is decoded, resized, and stored inside private deck/profile records. The bounded record format avoids a separate storage-service dependency in this release. Images are limited to PNG/JPEG, 10 MB before client resizing, about 500 KB after resizing; API request bodies are limited to 1.6 MB. Exported presentation sizes vary.

## Verification

```powershell
npm run check
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run test:recovery
npm run preview
```

The engine/API tests validate catalogue consistency, generated slide counts, PPTX package entries, editable text, shapes, native tables, charts and embedded workbooks; themes, custom text, colours, notes and Unicode; retained original-design snapshots; image embedding; PDF structure; text fitting; registration/login; save/reload; cross-account access denial; uploads; bookmarks; private download snapshots; admin publication; categories; disabled billing; and support messages.

Playwright starts an isolated in-memory test database on port 5174. Browser journeys cover catalogue downloads; browse, preview, personalisation, slide operations, PPTX/PDF export, and guest reload; profile/logo reuse, bookmarks, rename/duplicate/delete, download history, sign-out and fresh-browser sign-in; table/chart/image/notes editing and Tamil PPTX text; public deep links and static assets; admin publication; and mobile browsing/filtering/editor overflow. The redesigned homepage, search and menus, collection routes, themes, authentication and editor are checked through real interactions. Downloaded files are unpacked to verify native content. Screenshots, sample exports, and the HTML report are written under `artifacts/`, which is not published or committed. If needed, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can point to an already installed compatible Chromium binary.

PPTX contents are validated programmatically; desktop Microsoft PowerPoint is not installed in the build environment, so opening the generated files in that application remains a release check for the operator.

The separate recovery suite runs built assets on port 5181 and deliberately returns missing export, PDF and route modules. It checks draft preservation, a single resumed download, persistent-failure handling, recovery-dialog accessibility and downloads during a history-service outage. Build first with `npm run build`; the runner uses an isolated in-memory database. Set `E2E_BASE_URL` to run these browser-intercepted failures against a deployment without changing its assets.

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

MongoDB integration tests use a randomly named test database and remove their documents afterward. API tests include category rename propagation, unpublished-template history, role changes, concurrent writes, transaction rollback, and login rate limiting. Production browser checks can use `E2E_BASE_URL`, `E2E_EMAIL`, `E2E_FEATURE_EMAIL`, and `E2E_PASSWORD`; use unique temporary emails and remove those test accounts and their records afterward. These checks use regular accounts and do not change the public catalogue.

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

The optional legacy `.openai/hosting.json` configuration targets a private Sites deployment with a `DB` D1 binding. A non-Vercel build emits the React client and an ESM Worker at `dist/server/index.js`. Sites requests use the platform's authenticated identity headers, while the standalone and Vercel servers use their own email/password sessions and ignore platform identity headers. Sites administrator access is controlled by the server-only `ADMIN_EMAILS` environment value. Source deployments include the schema migration under `drizzle/`; the hosting service applies it before activating the Worker. SQLite, Vercel/MongoDB and optional Sites/D1 databases are separate.

## Commercial and release boundaries

- Payments are **disabled**. Purchase, entitlement, and idempotent webhook-event tables are present, but there is no configured payment provider, fake successful checkout, or paid subscription. Premium metadata can be previewed; standard download requests require entitlement. All launch templates are free.
- Before enabling sales, implement server-side premium asset/export delivery plus a provider adapter with verified payment signatures, idempotent webhooks, refunds, and receipts. Client-side template definitions are intentionally inspectable for the free launch collection and are not DRM.
- Standalone account email verification, forgotten-password email delivery, and MFA are not included. Hosted identity inherits the hosting platform's sign-in protections.
- Browser PDF output supports Latin text. For Tamil or other scripts, download PPTX and use PowerPoint's PDF export; unsupported scripts produce a clear error rather than a corrupted PDF.
- This is a controlled layout editor, not a free-position canvas. It supports 1–40 slides per deck. Heavy media decks need a separate file store and larger export pipeline before scaling.
- New categories and variants can be managed in the database/admin UI. New structural design families are implemented in the shared layout engine. Featured sorting follows editorial curation; name, slide count and newest-design ordering are also available. There are no fabricated user ratings or download statistics.
- Public pages are a React SPA. The local Node and optional D1 servers provide metadata for seed designs; Vercel currently serves the shared SPA document. Full server rendering, social-image rasterisation, dynamic SEO for administrator-created variants, and expanded university formatting rules are future enhancements.
- The included privacy and terms pages explain this implementation. The deployment operator must supply their legal entity/contact details and retention practices before a public commercial launch.

No external configuration is required for the local core workflow.
