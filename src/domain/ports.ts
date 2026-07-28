import { Cv } from './cv';

/**
 * Port the application layer depends on. The infrastructure layer provides an
 * adapter (BffCvRepository) that fetches the BFF aggregate; tests inject a fake
 * through this same interface. Imports nothing but domain types — the
 * dependency rule points inward.
 */
export interface CvRepository {
  getCv(personId: string): Promise<Cv>;
}
