/**
 * Domain entities for the public CV aggregate.
 *
 * Shapes mirror the BFF public payload ratified in the meta repo
 * `docs/api-contract.md` (GET /api/v1/people/:id/cv): the person head fields
 * plus four section arrays, with NO internal ids and NO email — the BFF strips
 * those from public payloads. Optional head fields are optional here too.
 *
 * The full aggregate is typed now so the app is ready to scale, even though the
 * initial UI only renders the person head (PersonHeader).
 */

/** Person head — the four public fields from the aggregate. */
export interface Person {
  name: string;
  headline?: string;
  location?: string;
  summary?: string;
}

/** `endDate: null` means "current" per the contract (dates are ISO-8601). */
export interface Experience {
  company: string;
  role: string;
  location?: string;
  startDate: string;
  endDate: string | null;
  description?: string;
}

export interface Education {
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startDate: string;
  endDate: string | null;
}

export type Proficiency = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export interface Skill {
  name: string;
  category: string;
  proficiency: Proficiency;
}

export interface Project {
  name: string;
  description?: string;
  repoUrl?: string;
  startDate: string;
  endDate: string | null;
}

/** The full CV aggregate = person head + the four section arrays. */
export interface Cv extends Person {
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
}
