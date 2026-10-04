import { loadCv } from '../application/loadCv';
import { Cv } from '../domain/cv';
import { BffCvRepository } from '../infrastructure/BffCvRepository';

// The adapter's typed failures, re-exported so app/ can tell them apart
// without importing infrastructure directly.
export { CvFetchError, CvPayloadError } from '../infrastructure/BffCvRepository';

/**
 * Composition root — the ONLY module that reads environment variables and
 * wires concrete adapters into the use case. Everything above this layer
 * depends on ports, never on env or fetch.
 *
 * Env is server-side only (NOT NEXT_PUBLIC_*): these values must never reach
 * the client bundle. `BFF_URL` is the cv-bff-node aggregate — this site never
 * talks to cv-domain-service directly.
 */

/**
 * ISR window in seconds. Must match the `export const revalidate` in
 * app/page.tsx (Next needs a literal there for static analysis); this is the
 * value the fetch cache uses inside the repository.
 */
export const REVALIDATE_SECONDS = 60;

const LOCAL_BFF_URL = 'http://localhost:3000';

/**
 * A missing or malformed `BFF_URL`. app/page.tsx rethrows it (it does not
 * render the "unavailable" alert), so the prerender at `next build` fails and
 * the misconfigured deploy never ships (T-404).
 */
export class BffConfigError extends Error {
  constructor(problem: string) {
    super(`${problem} -- see "CI / deploy -- Vercel" in cv-public-react/CLAUDE.md.`);
    this.name = 'BffConfigError';
  }
}

/**
 * Resolve the BFF base URL from env (T-404, H1 2026-10-04).
 *
 * - Production (`VERCEL_ENV=production`): `BFF_URL` is REQUIRED. Without it the
 *   page would fetch localhost, render the alert, and ISR would cache that.
 * - Everywhere else (local dev, tests, Vercel previews): unset/blank falls back
 *   to the local BFF. Previews deliberately keep the default: every PR's
 *   preview build is this repo's CI gate, and failing it on a dashboard
 *   setting would block code review on configuration; a preview without the
 *   variable just shows the alert, which ISR never promotes to production.
 * - When set, in any environment, it must be a bare origin: the repository
 *   appends `/bff/api/v1/...` itself, so a trailing slash or a `/bff...` path
 *   yields a URL that 404s while looking right.
 */
export function resolveBffUrl(env: Readonly<Record<string, string | undefined>>): string {
  const value = env.BFF_URL?.trim() ?? '';
  if (value === '') {
    if (env.VERCEL_ENV === 'production') {
      throw new BffConfigError(
        'BFF_URL is not set (or blank) in a production build; set it to the BFF origin in the Vercel project settings',
      );
    }
    return LOCAL_BFF_URL;
  }
  if (value.endsWith('/') || /\/bff(\/|$)/.test(value)) {
    throw new BffConfigError(
      `BFF_URL must be a bare origin (no trailing slash, no /bff/api/v1 path), got "${value}"`,
    );
  }
  return value;
}

function bffUrl(): string {
  return resolveBffUrl(process.env);
}

export function personId(): string {
  return process.env.PERSON_ID ?? '1';
}

function cvRepository(): BffCvRepository {
  return new BffCvRepository(bffUrl(), REVALIDATE_SECONDS);
}

/** Entry point for Server Components: load the configured person's CV. */
export async function getCv(id: string = personId()): Promise<Cv> {
  return loadCv(cvRepository(), id);
}
