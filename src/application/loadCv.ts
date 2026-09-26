import { Cv } from '../domain/cv';
import { CvRepository } from '../domain/ports';

/**
 * Application use case: load a person's full CV through the CvRepository port.
 *
 * Deliberately a passthrough, and a real seam for future cross-section logic
 * without the presentation or infrastructure layers needing to change. Two
 * things do NOT belong here: ordering (api-contract § Ordering — the domain
 * service orders, and a sort here would be a second answer that ISR caches) and
 * empty-section handling (each section component renders nothing for an empty
 * array; T-402 H1). Framework-free: no Next, no fetch, no env — inject a
 * repository and call it.
 */
export function loadCv(repository: CvRepository, personId: string): Promise<Cv> {
  return repository.getCv(personId);
}
