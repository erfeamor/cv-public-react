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
 * Typed error thrown when the BFF answers 2xx with a body that violates
 * `docs/api-contract.md`. `path` names the offending JSON location
 * (`experiences[0].startDate`, `$` for the body itself) so the log line is
 * actionable without a debugger. Deliberately distinct from CvFetchError:
 * app/page.tsx renders an "unavailable" alert for a failed fetch but rethrows
 * this, so ISR keeps serving the last good page instead of replacing it.
 */
export class CvPayloadError extends Error {
  constructor(
    readonly path: string,
    problem: string,
    options?: { cause?: unknown },
  ) {
    super(`Invalid CV payload from the BFF at ${path}: ${problem}`, options);
    this.name = 'CvPayloadError';
  }
}

/**
 * The anti-corruption layer for the BFF `/people/:id/cv` payload. The body
 * arrives as `unknown` and is VALIDATED, then NORMALIZED, field by field —
 * there is no cast. What it guarantees about the Cv it returns:
 *
 * VALIDATED — any violation throws one CvPayloadError naming the JSON path, and
 * the whole payload is rejected (there is no partial Cv):
 * - The body parses as JSON and is an object; each present section is an
 *   array of objects.
 * - Required fields (the contract's `Required:` lists, plus the person's and
 *   the skill's `name`) are present strings. Presence and primitive type only:
 *   ISO-8601 date format and non-emptiness are NOT checked.
 * - `proficiency` is one of the four Proficiency literals. An unknown value
 *   rejects the whole payload, not just the skill.
 * - `endDate` (experience, education, project) is a PRESENT key holding a
 *   string or null. Rule 3 gives its null the meaning "current", so an absent
 *   key is a producer bug and is rejected rather than read as "current".
 * - Every other optional field, when present, is a string or null.
 *
 * NORMALIZED — T-407's rule-7 tolerance, applied only after validation:
 * - An absent optional key (all but `endDate`) becomes the domain's `null`.
 *   For these ten fields null is merely the empty value, so this is neutral.
 * - An absent or null section becomes `[]`.
 *
 * Nothing normalized here leaves the process, which is why the same `?? null`
 * is correct here and forbidden in cv-bff-node (T-210), where it would
 * fabricate a value on the wire. Unknown extra keys are ignored, not copied:
 * every domain object is rebuilt field by field.
 */
type Json = Record<string, unknown>;

// A Record, not an array, so it is exhaustive at compile time: adding or
// removing a Proficiency literal without updating this line is a type error.
const PROFICIENCIES: Record<Proficiency, true> = {
  BEGINNER: true,
  INTERMEDIATE: true,
  ADVANCED: true,
  EXPERT: true,
};

// Own-property check, never `value in PROFICIENCIES`: `in` also matches keys
// inherited from Object.prototype, such as "toString" and "constructor".
function isProficiency(value: unknown): value is Proficiency {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PROFICIENCIES, value);
}

function describeValue(value: unknown): string {
  return value === undefined ? 'absent' : `got ${JSON.stringify(value)}`;
}

/** `$` is the body itself; its fields are named bare (`name`, not `$.name`). */
function at(path: string, key: string): string {
  return path === '$' ? key : `${path}.${key}`;
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(obj: Json, key: string, path: string): string {
  const value = obj[key];
  if (typeof value !== 'string') {
    throw new CvPayloadError(at(path, key), `expected a string, ${describeValue(value)}`);
  }
  return value;
}

/** Rule-7 optional: absent => null (T-407); present must be string | null. */
function optionalString(obj: Json, key: string, path: string): string | null {
  // `?? null`, never `|| null`: the two disagree only on a legitimate empty
  // string, which `||` would erase.
  const value = obj[key] ?? null;
  if (value !== null && typeof value !== 'string') {
    throw new CvPayloadError(at(path, key), `expected a string or null, ${describeValue(value)}`);
  }
  return value;
}

/** Rule-3 `endDate`: the key must be PRESENT; null means "current". */
function endDate(obj: Json, path: string): string | null {
  if (!('endDate' in obj)) {
    throw new CvPayloadError(
      at(path, 'endDate'),
      'key is absent; it must be present, null meaning "current" (contract rule 3)',
    );
  }
  return optionalString(obj, 'endDate', path);
}

function proficiency(obj: Json, path: string): Proficiency {
  const value = obj.proficiency;
  if (!isProficiency(value)) {
    throw new CvPayloadError(
      at(path, 'proficiency'),
      `expected one of ${Object.keys(PROFICIENCIES).join(' | ')}, ${describeValue(value)}`,
    );
  }
  return value;
}

function toExperience(obj: Json, path: string): Experience {
  return {
    company: requiredString(obj, 'company', path),
    role: requiredString(obj, 'role', path),
    location: optionalString(obj, 'location', path),
    startDate: requiredString(obj, 'startDate', path),
    endDate: endDate(obj, path),
    description: optionalString(obj, 'description', path),
  };
}

function toEducation(obj: Json, path: string): Education {
  return {
    institution: requiredString(obj, 'institution', path),
    degree: requiredString(obj, 'degree', path),
    fieldOfStudy: optionalString(obj, 'fieldOfStudy', path),
    startDate: requiredString(obj, 'startDate', path),
    endDate: endDate(obj, path),
  };
}

function toSkill(obj: Json, path: string): Skill {
  return {
    name: requiredString(obj, 'name', path),
    category: optionalString(obj, 'category', path),
    proficiency: proficiency(obj, path),
  };
}

function toProject(obj: Json, path: string): Project {
  return {
    name: requiredString(obj, 'name', path),
    description: optionalString(obj, 'description', path),
    repoUrl: optionalString(obj, 'repoUrl', path),
    startDate: optionalString(obj, 'startDate', path),
    endDate: endDate(obj, path),
  };
}

/** Absent or null section => [] (T-407); present must be an array of objects. */
function section<T>(body: Json, key: string, toElement: (obj: Json, path: string) => T): T[] {
  const value = body[key] ?? [];
  if (!Array.isArray(value)) {
    throw new CvPayloadError(key, `expected an array, ${describeValue(value)}`);
  }
  return value.map((element: unknown, index) => {
    const path = `${key}[${index}]`;
    if (!isObject(element)) {
      throw new CvPayloadError(path, `expected an object, ${describeValue(element)}`);
    }
    return toElement(element, path);
  });
}

function toCv(body: unknown): Cv {
  if (!isObject(body)) {
    throw new CvPayloadError('$', `expected a JSON object, ${describeValue(body)}`);
  }
  return {
    name: requiredString(body, 'name', '$'),
    headline: optionalString(body, 'headline', '$'),
    location: optionalString(body, 'location', '$'),
    summary: optionalString(body, 'summary', '$'),
    experiences: section(body, 'experiences', toExperience),
    education: section(body, 'education', toEducation),
    skills: section(body, 'skills', toSkill),
    projects: section(body, 'projects', toProject),
  };
}

/**
 * Infrastructure adapter: fetches the CV aggregate from cv-bff-node.
 *
 * Server-side fetch only — this runs during static generation and background
 * revalidation, never in the browser. `revalidateSeconds` drives Next's fetch
 * cache so pages are statically served and refreshed in the background (ISR),
 * not rendered per request. It deliberately talks ONLY to the BFF, never to
 * cv-domain-service. Throws CvFetchError on a non-2xx response and
 * CvPayloadError on a 2xx body that violates the contract (see toCv's guards).
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

    // A 2xx body that is not JSON (e.g. a proxy's 200 HTML maintenance page)
    // violates the contract too, so it must surface as CvPayloadError: a bare
    // SyntaxError would be rendered as the alert and cached over the last
    // good page.
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new CvPayloadError('$', 'body is not valid JSON', { cause: error });
    }
    return toCv(body);
  }
}
