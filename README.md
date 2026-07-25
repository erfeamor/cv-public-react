# cv-public-react

Public CV site for [cv-project](../README.md): a fast, optimized résumé built with
**Next.js 14 (App Router) + React 18 + TypeScript**, rendered via **ISR**
(Incremental Static Regeneration) and consuming the [cv-bff-node](../cv-bff-node)
aggregate.

Part of the [cv-project](../README.md) multi-repo. Deploy target: **Vercel**.

## What it is

The public résumé, served as static HTML and refreshed in the background every
60 seconds. It fetches the full CV aggregate from the BFF **server-side** during
static generation and revalidation — pages are not rendered per request, and it
deliberately **does not talk to cv-domain-service directly** at runtime. It is a
sibling to [cv-public-vanilla](../cv-public-vanilla) (the zero-framework take on
the same page); React escapes interpolated text for free, so there is no manual
HTML escaping here.

## Stack

- Next.js 14 (App Router, Server Components) + React 18
- TypeScript (`strict`)
- Node 20
- Jest + React Testing Library (jsdom) for TDD

## Local development

```bash
cp .env.example .env      # point BFF_URL at your cv-bff-node instance
npm install
npm run dev                 # start on :4300 (Server Components render on the server)
npm test                    # run the test suite
npm run typecheck           # tsc --noEmit (strict; separate gate)
npm run lint                # next lint
npm run build               # production build (static + ISR)
```

Ports across the demo: this site :4300, admin :5173, public-vanilla :4173, BFF :3000.

## Environment

Server-side only (**never** `NEXT_PUBLIC_*` — these must not reach the browser),
read only in the composition root (`src/composition/container.ts`):

| Var | Default | Meaning |
|---|---|---|
| `BFF_URL` | `http://localhost:3000` | cv-bff-node base URL (the aggregate source) |
| `PERSON_ID` | `1` | Which person's CV to render |

## Architecture

Clean / hexagonal layering (mirrors [cv-admin-react](../cv-admin-react)); the
dependency rule points inward: `domain ← application ← composition → infrastructure`.

- `src/domain/` — entities (`cv.ts`: `Person`, `Cv`, and the section types) and
  the `CvRepository` port (`ports.ts`). Imports nothing from other layers.
- `src/application/` — `loadCv(repository, personId)`: framework-free use case,
  the seam for future ordering/filtering logic.
- `src/infrastructure/` — `BffCvRepository` implements `CvRepository`, fetching
  `${BFF_URL}/api/v1/people/:id/cv` server-side, mapping the payload to the
  domain `Cv`, and throwing a typed `CvFetchError` on non-2xx.
- `src/composition/` — composition root: the **only** place env vars are read;
  wires `BffCvRepository` into the use case.
- `src/presentation/components/` — pure presentational components (`PersonHeader`).
- `app/` — App Router. `app/page.tsx` is a Server Component that calls the
  composition root + use case and renders `PersonHeader`. ISR via
  `export const revalidate = 60`.

The full `Cv` aggregate (experiences, education, skills, projects) is typed per
`docs/api-contract.md` so the app is ready to scale, even though the initial UI
renders only the person head.

## Testing

TDD across every layer (a PR without tests is incomplete):

- **Application** — `loadCv` against a fake `CvRepository`; never touches fetch.
- **Infrastructure** — `BffCvRepository` with mocked `global.fetch`: asserts the
  URL, the domain mapping, and that non-ok responses throw `CvFetchError`.
- **Presentation** — `PersonHeader` via RTL: name as heading, optional fields
  omitted when absent; queried by role/text, not test-ids.

## Deploy — Vercel

Vercel's Git integration builds and deploys automatically: every PR gets a
preview deployment, and merges to `master` deploy to production. Set `BFF_URL`
and `PERSON_ID` as Project Environment Variables in the Vercel dashboard.

`vercel.json` overrides the build command to `lint && typecheck && test &&
build`, so the deploy doubles as the validation pipeline — a failing lint, type
check, or test blocks the deployment on both previews and production.
