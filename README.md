# Landing Agent

An internal tool for the PPC team. It generates high-converting D2C landing pages for Indian
e-commerce brands from a campaign brief, then lets non-technical marketers edit them in a
drag-and-drop canvas — without a developer in the loop and without the AI ever touching markup.

Mobile-first (67%+ of Indian traffic is mobile). Prices in INR. Checkout routes to Shopify,
WhatsApp order, or a lead form. COD and UPI are first-class.

## Architecture

1. **The AI does not generate HTML, JSX, CSS or Tailwind classes.** It generates a JSON document.
2. That document conforms to `PageSchema` (`src/lib/schema/page.ts`) — the single source of truth.
3. Pages are composed only from a **locked registry** of 12 pre-built React blocks plus 3 page
   fixtures (`src/components/blocks/index.ts`). A type outside the registry does not exist.
4. The Zod schema is compiled into the Anthropic tool definition, so the model is *constrained* at
   sample time rather than corrected afterwards (`src/lib/generate/tools.ts`).
5. Every generated document is validated through Zod before it is written; invalid output is fed
   back to the model with the exact issue paths for one repair pass.
6. **The Puck editor reads and writes that same JSON** (`src/lib/puck/adapter.ts`). There is no
   import step, no export step, and no intermediate representation.
7. That is what makes the round-trip **lossless**: AI generates → human edits visually → AI edits
   again → human edits again, and nothing is dropped along the way.
8. Every block instance carries a **stable string `id`**. All AI edits and all editor operations
   address blocks by id — never by array index, never by type — so references survive reordering.
9. The renderer (`src/components/PageRenderer.tsx`) and the editor canvas render the *same*
   components from the *same* registry, so preview is not an approximation of production — it is
   production, minus the publish flag.
10. Because the contract is data rather than code, an AI edit pass is a JSON patch against a
    validated document, not a diff against generated source that may no longer parse.

```
brief ──▶ Anthropic (constrained tool call) ──▶ Zod validate ──▶ page.json
                                                     ▲              │
                                                     │              ▼
                                          AI edit pass  ◀──── Puck editor
                                                                    │
                                                                    ▼
                                                              PageRenderer
```

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS v4 (CSS-first `@theme`, no
`tailwind.config.js`) · Zod v4 · Puck (`@measured/puck`) · `@anthropic-ai/sdk` · JSON files on disk
for storage (no database in this prototype).

## Setup

```bash
npm install
cp .env.example .env.local   # optional — see "Environment variables"
npm run dev
```

Open http://localhost:3000.

On first server start an example page is seeded automatically to
`src/data/pages/page_mock_kaarva.json` (`src/instrumentation.ts` → `src/lib/seed.ts`), so the app
opens on a real, fully-populated landing page immediately:

- Preview: http://localhost:3000/preview/page_mock_kaarva
- Editor: http://localhost:3000/editor/page_mock_kaarva

Seeding is idempotent and never overwrites an existing file — edits you save survive a restart.
Delete the JSON file to restore the pristine copy.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (seeds the example page on boot) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `node scripts/generate-placeholder-images.mjs` | Regenerate the placeholder assets under `public/img/kaarva/` |

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Only for generation | Used by `POST /api/generate` and `POST /api/edit`. |

**The whole UI works without a key.** The seeded example page can be previewed, edited in Puck, and
saved with no credentials. Only the two AI routes need one.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Dashboard — lists saved pages |
| `/new` | Campaign brief form → generate |
| `/editor/[pageId]` | Puck drag-and-drop canvas |
| `/preview/[pageId]` | Clean production render (noindex) |
| `GET/POST /api/pages` | List / save (full document) |
| `GET/DELETE /api/pages/[pageId]` | Load / delete one page |
| `POST /api/generate` | Brief → page (send `{"mock": true}` to skip the API key) |
| `POST /api/edit` | Natural-language edit pass over an existing page |

## Current status

Working end to end. `npx tsc --noEmit` and `npm run build` both pass clean, and every route returns
200 against a running server. The seeded page renders all 12 block types, and the JSON round-trip is
verified lossless in both directions (Puck adapter and the save API) with all block ids preserved.

Known prototype limitations:

- **Storage is JSON files on disk.** No concurrency control — two editors saving the same page will
  clobber each other. Fine for a prototype; a database is Phase 2.
- **No auth.** Every route is open to anyone who can reach the server.
- **`next.config.ts` allows remote images from any https host.** Deliberate for a prototype where the
  brand CDN is unknown at build time — narrow it to approved CDNs before this is public.
- **The images under `public/img/kaarva/` are generated placeholders**, not product photography.
- The CRO validator described in the schema header (`cro/*` rule ids — price integrity,
  exactly-one `mostPopular`, comparison cell arity, message match) is specified but not implemented.

## What Phase 2 would add

- **The CRO validator.** The cross-field business rules the schema deliberately does not encode,
  with `error`/`warn` severities and the human acknowledgement flow already modelled in `PageMeta`.
- **A database** with optimistic locking and page version history, replacing the JSON file store.
- **Auth and per-campaign permissions**, so a marketer can only reach their own brands' pages.
- **Publish + hosting**: a real deploy target, custom domains, and the `published` status actually
  meaning something.
- **A/B variant generation** — fork a page, have the model vary one hypothesis (hero claim, offer
  framing, urgency treatment), and split traffic.
- **Live data bindings.** `DataSource` is already in the schema for urgency signals and review
  summaries; Phase 2 resolves them against Shopify inventory and Judge.me/Loox at request time.
- **Analytics loop**: feed conversion rate per block ordering back into the generator's prompt so
  the recommended block order is learned rather than hand-authored.
- **Image ingest**: upload brand assets, auto-generate `blurDataURL` and `dominant` colour (both
  already in `ImageRefSchema`), and drop the open remote-image allowlist.
