import {
  Cv,
  Education,
  Experience,
  Proficiency,
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
 *
 * The DTO types every contract-optional field `?: string | null`, which the
 * domain types deliberately do NOT (T-405/T-209: rule 7 says the key is always
 * present, `null` is its empty value). The difference is the point: the DTO
 * describes what a producer could actually send — including a dropped key —
 * and this adapter is the anti-corruption layer that turns `undefined` into
 * the domain's `null` before anything upstream of it can compare `=== null`
 * and take the wrong branch. Nothing normalized here leaves the process, which
 * is why the same `?? null` is correct here and forbidden in cv-bff-node
 * (T-210), where it would fabricate a value on the wire.
 */
interface PersonDto {
  name: string;
  headline?: string | null;
  location?: string | null;
  summary?: string | null;
}

interface ExperienceDto {
  company: string;
  role: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
}

interface EducationDto {
  institution: string;
  degree: string;
  fieldOfStudy?: string | null;
  startDate: string;
  endDate?: string | null;
}

interface SkillDto {
  name: string;
  category?: string | null;
  proficiency: Proficiency;
}

interface ProjectDto {
  name: string;
  description?: string | null;
  repoUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface CvDto extends PersonDto {
  experiences?: ExperienceDto[];
  education?: EducationDto[];
  skills?: SkillDto[];
  projects?: ProjectDto[];
}

// `?? null`, never `|| null`: the two disagree only on a legitimate empty
// string, which `||` would erase.
//
// KNOWN, ACCEPTED TRADE-OFF at the three `endDate` sites below (Experience,
// Education, Project). For the ten rule-7 optionals `null` is merely the empty
// value, so coercing an absent key to it is neutral. For `endDate` rule 3 makes
// `null` a positive assertion — "current" — so an absent one becomes
// indistinguishable from a deliberate "current", and a finished 2020–2022 role
// whose producer dropped the key will render as "Present" once sections land:
// a wrong fact, not a blank. Accepted because the domain invariant requires
// `null` over `undefined`; telling the two apart needs runtime validation at
// this boundary, which is out of scope here and filed as its own task.
function toExperience(dto: ExperienceDto): Experience {
  return {
    company: dto.company,
    role: dto.role,
    location: dto.location ?? null,
    startDate: dto.startDate,
    endDate: dto.endDate ?? null, // absent => "current"; see trade-off above
    description: dto.description ?? null,
  };
}

function toEducation(dto: EducationDto): Education {
  return {
    institution: dto.institution,
    degree: dto.degree,
    fieldOfStudy: dto.fieldOfStudy ?? null,
    startDate: dto.startDate,
    endDate: dto.endDate ?? null, // absent => "current"; see trade-off above
  };
}

function toSkill(dto: SkillDto): Skill {
  return {
    name: dto.name,
    category: dto.category ?? null,
    proficiency: dto.proficiency,
  };
}

function toProject(dto: ProjectDto): Project {
  return {
    name: dto.name,
    description: dto.description ?? null,
    repoUrl: dto.repoUrl ?? null,
    startDate: dto.startDate ?? null,
    endDate: dto.endDate ?? null, // absent => "current"; see trade-off above
  };
}

function toCv(dto: CvDto): Cv {
  // Guard the array BEFORE mapping: `(dto.experiences ?? []).map(...)`, not
  // `dto.experiences.map(...) ?? []`, which would throw on an absent section.
  return {
    name: dto.name,
    headline: dto.headline ?? null,
    location: dto.location ?? null,
    summary: dto.summary ?? null,
    experiences: (dto.experiences ?? []).map(toExperience),
    education: (dto.education ?? []).map(toEducation),
    skills: (dto.skills ?? []).map(toSkill),
    projects: (dto.projects ?? []).map(toProject),
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
