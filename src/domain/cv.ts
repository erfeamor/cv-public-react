/**
 * Domain entities for the public CV aggregate.
 *
 * Shapes mirror the BFF public payload ratified in the meta repo
 * `docs/api-contract.md` (GET /bff/api/v1/people/:id/cv — the public edge path
 * since T-013): the person head fields plus four section arrays, with NO
 * internal ids and NO email — the BFF strips those from public payloads.
 *
 * CONTRACT-OPTIONAL FIELDS ARE `string | null`, NOT `?:`. Rule 7 (T-209) says
 * an optional field is always a PRESENT key whose empty value is `null` — the
 * key is never missing — so `?:` described a shape the BFF does not send, and a
 * bare `string` (which `Skill.category` and `Project.startDate` used to be) was
 * an outright lie: `BffCvRepository` then cast the response with no runtime
 * validation, so a `null` reached a `string`-typed field with nothing able to
 * warn. (It validates at the boundary since T-409.) `endDate` is `string | null` for a different reason — rule 3 gives its
 * null the meaning "current", which rule 7 explicitly does not govern.
 *
 * The full aggregate is typed now so the app is ready to scale, even though the
 * initial UI only renders the person head (PersonHeader).
 */

/** Person head — the four public fields from the aggregate. */
export interface Person {
  name: string;
  headline: string | null;
  location: string | null;
  summary: string | null;
}

/** `endDate: null` means "current" per the contract (dates are ISO-8601). */
export interface Experience {
  company: string;
  role: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
}

export interface Education {
  institution: string;
  degree: string;
  fieldOfStudy: string | null;
  startDate: string;
  endDate: string | null;
}

export type Proficiency = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export interface Skill {
  name: string;
  category: string | null;
  proficiency: Proficiency;
}

export interface Project {
  name: string;
  description: string | null;
  repoUrl: string | null;
  /** Contract-optional: § Ordering calls it "the only nullable date of the three". */
  startDate: string | null;
  endDate: string | null;
}

/** The full CV aggregate = person head + the four section arrays. */
export interface Cv extends Person {
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
}
