# CLAUDE.md — cv-public-react

Public CV site for cv-project: **Next.js 14 (App Router) + React 18 + TypeScript**,
Node 20. It consumes the **cv-bff-node aggregate** `GET /api/v1/people/:id/cv`,
renders via **ISR** (statically generated, background-revalidated every 60s), and
deliberately **does NOT talk to cv-domain-service directly** at runtime — the BFF
is the only upstream. Sibling to cv-public-vanilla (the zero-framework take);
React escapes interpolated text for free, so there is no manual HTML escaping
here. Cross-repo context: meta repo CLAUDE.md one directory up.

## Commands

```bash
npm install
npm run dev                # :4300 (cp .env.example .env first)
npm test                   # Jest + React Testing Library (jsdom)
npm run test:watch         # watch mode
npm run typecheck          # tsc --noEmit (strict; separate gate from build)
npm run lint               # next lint (next/core-web-vitals)
npm run build              # production build (static + ISR); npm start to serve
```

Ports across the demo: this site :4300, admin :5173, public-vanilla :4173, BFF :3000.

## Architecture & conventions

All source is TypeScript; `tsconfig.json` has `strict: true`. **Hexagonal
layering**, one directory per layer, dependency rule
`domain ← application ← composition → infrastructure`. Server Components by
default — keep the client bundle minimal (no `'use client'` unless a component
genuinely needs browser interactivity).

- `src/domain/` — entities and ports; imports nothing from other layers.
  - `cv.ts`: `Person` (`name`, optional `headline`/`location`/`summary`) and the
    full `Cv` aggregate = person head + `experiences`, `education`, `skills`,
    `projects` arrays, each typed per meta-repo `docs/api-contract.md`. No `id`
    or `email` — the BFF strips those from public payloads.
  - `ports.ts`: `CvRepository` with `getCv(personId): Promise<Cv>`.
- `src/application/` — `loadCv(repository, personId)`: framework-free use case
  (no Next, no fetch, no env). Thin but real — the seam for future cross-section
  logic (ordering, filtering empty sections) without touching other layers.
- `src/infrastructure/` — `BffCvRepository implements CvRepository`: server-side
  `fetch` of `${BFF_URL}/api/v1/people/:id/cv` with `next: { revalidate }`, maps
  the payload to the domain `Cv`, throws a typed `CvFetchError` on non-2xx.
- `src/composition/container.ts` — the **composition root**: the ONLY module that
  reads env vars and wires `BffCvRepository` into the use case. Nothing above it
  sees `process.env`.
- `src/presentation/components/` — pure presentational components (`PersonHeader`),
  testable with React Testing Library.
- `app/` — App Router. `app/layout.tsx` + `app/page.tsx` (a Server Component)
  calls the composition root + use case and renders `PersonHeader`; load failure
  renders a graceful `role="alert"` message. `app/globals.css` holds styles.

**Adding a section** (experiences, education, skills, projects — shapes already
typed in `domain/cv.ts`): render it in a new presentational component, compose it
in `app/page.tsx`, and add ordering/filtering in the `loadCv` use case if needed.
Each layer gets its own test.

## ISR / data flow

- `app/page.tsx` sets `export const revalidate = 60` (route-segment config; must
  be a literal for Next's static analysis). It must match `REVALIDATE_SECONDS` in
  the composition root, which the repository passes to the fetch cache.
- The fetch runs **server-side** at build time and during background
  revalidation — pages are served static, NOT rendered per request, and the
  browser never fetches. If the BFF is down at build time the page still
  prerenders (the caught error renders the alert), and later revalidations
  recover automatically.

## Environment

Server-side only — **never** `NEXT_PUBLIC_*` (these must not reach the client),
read only in `src/composition/container.ts`. Provide via `.env` (see
`.env.example`):

- `BFF_URL` (default `http://localhost:3000`) — cv-bff-node base URL.
- `PERSON_ID` (default `1`) — which person's CV to render.

## Testing conventions

TDD everywhere; a PR without tests for its code path is incomplete. RTL with
`@testing-library/jest-dom` (jsdom via `next/jest`). Query by role/text, not
test-ids.

- Application: `loadCv` against a **fake** `CvRepository` through the port —
  never hits fetch.
- Infrastructure: `BffCvRepository` with mocked `global.fetch` (restored in
  `afterEach`) — asserts URL, domain mapping, and that non-ok throws `CvFetchError`.
- Presentation: `PersonHeader` render — name as heading; optional fields present
  when set and **omitted** (asserted not in document) when absent.

## CI / deploy — Vercel

Vercel Git integration: every PR gets a **preview** deployment; merges to
`master` deploy to **production**. Next.js is auto-detected — no `vercel.json`.
Set `BFF_URL` and `PERSON_ID` as Project Environment Variables in the Vercel
dashboard. (Different CI per repo is a deliberate feature of this demo.)

## Git workflow

`master` is protected — feature branch (`feat/…`) → push → PR via `gh`.
Definition of done: tests for every layer touched, `typecheck`/`lint`/`build`
green.
