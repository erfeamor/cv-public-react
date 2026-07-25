import { Cv } from '../domain/cv';
import { CvRepository } from '../domain/ports';

/**
 * Application use case: load a person's full CV through the CvRepository port.
 *
 * Deliberately thin, but a real seam — this is where future cross-section logic
 * lives (ordering experiences by date, filtering empty sections, etc.) without
 * the presentation or infrastructure layers needing to change. Framework-free:
 * no Next, no fetch, no env — inject a repository and call it.
 */
export function loadCv(repository: CvRepository, personId: string): Promise<Cv> {
  return repository.getCv(personId);
}
