import {
  Cv,
  Education,
  Experience,
  Person,
  Project,
  Skill,
} from '../domain/cv';
import { CvRepository } from '../domain/ports';

/** Typed error thrown on any non-2xx response from the BFF aggregate. */
export class CvFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CvFetchError';
  }
}

/**
 * Raw shape of the BFF `/people/:id/cv` payload. Already public (no ids, no
 * email) per the API contract, so the DTO is structurally close to the domain
 * Cv — this adapter still owns the mapping so the domain never depends on the
 * wire format, and it defends against missing section arrays.
 */
interface CvDto extends Person {
  experiences?: Experience[];
  education?: Education[];
  skills?: Skill[];
  projects?: Project[];
}

function toCv(dto: CvDto): Cv {
  return {
    name: dto.name,
    headline: dto.headline,
    location: dto.location,
    summary: dto.summary,
    experiences: dto.experiences ?? [],
    education: dto.education ?? [],
    skills: dto.skills ?? [],
    projects: dto.projects ?? [],
  };
}

/**
 * Infrastructure adapter: fetches the CV aggregate from cv-bff-node.
 *
 * Server-side fetch only — this runs during static generation and background
 * revalidation, never in the browser. `revalidateSeconds` drives Next's fetch
 * cache so pages are statically served and refreshed in the background (ISR),
 * not rendered per request. It deliberately talks ONLY to the BFF, never to
 * cv-domain-service.
 */
export class BffCvRepository implements CvRepository {
  constructor(
    private readonly baseUrl: string,
    private readonly revalidateSeconds: number,
  ) {}

  async getCv(personId: string): Promise<Cv> {
    const url = `${this.baseUrl}/bff/api/v1/people/${personId}/cv`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: this.revalidateSeconds },
    });

    if (!response.ok) {
      throw new CvFetchError(
        `Failed to load CV for person ${personId}: BFF responded ${response.status}`,
        response.status,
      );
    }

    return toCv((await response.json()) as CvDto);
  }
}
