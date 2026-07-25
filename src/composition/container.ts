import { loadCv } from '../application/loadCv';
import { Cv } from '../domain/cv';
import { BffCvRepository } from '../infrastructure/BffCvRepository';

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

function bffUrl(): string {
  return process.env.BFF_URL ?? 'http://localhost:3000';
}

export function personId(): string {
  return process.env.PERSON_ID ?? '1';
}

function cvRepository(): BffCvRepository {
  return new BffCvRepository(bffUrl(), REVALIDATE_SECONDS);
}

/** Entry point for Server Components: load the configured person's CV. */
export function getCv(id: string = personId()): Promise<Cv> {
  return loadCv(cvRepository(), id);
}
