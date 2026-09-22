import { BffCvRepository, CvFetchError } from './BffCvRepository';
import { Cv } from '../domain/cv';

describe('BffCvRepository', () => {
  const originalFetch = global.fetch;

  function repository() {
    return new BffCvRepository('http://bff.test', 60);
  }

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const payload = {
    name: 'Jane Doe',
    headline: 'Backend Engineer',
    location: 'Madrid',
    summary: 'Builds things.',
    experiences: [
      {
        company: 'ACME',
        role: 'Engineer',
        location: 'Remote',
        startDate: '2022-01-01',
        endDate: null,
        description: 'Worked.',
      },
    ],
    education: [
      {
        institution: 'UNED',
        degree: 'BSc',
        fieldOfStudy: 'Computer Science',
        startDate: '2015-09-01',
        endDate: '2019-06-30',
      },
    ],
    skills: [{ name: 'TypeScript', category: 'Languages', proficiency: 'ADVANCED' }],
    projects: [
      {
        name: 'cv-project',
        description: 'Demo',
        repoUrl: 'https://github.com/erfeamor/cv-project',
        startDate: '2026-07-01',
        endDate: null,
      },
    ],
  };

  it('fetches the aggregate from the person cv endpoint with revalidation', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    });

    await repository().getCv('1');

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://bff.test/bff/api/v1/people/1/cv');
    expect(options.next).toEqual({ revalidate: 60 });
  });

  it('maps the payload to the domain Cv', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    });

    const cv = await repository().getCv('1');

    expect(cv.name).toBe('Jane Doe');
    expect(cv.headline).toBe('Backend Engineer');
    expect(cv.experiences).toHaveLength(1);
    expect(cv.experiences[0].company).toBe('ACME');
    expect(cv.education[0].institution).toBe('UNED');
    expect(cv.skills[0].proficiency).toBe('ADVANCED');
    expect(cv.projects[0].name).toBe('cv-project');
  });

  // Guard order matters: `(dto.experiences ?? []).map(...)` is correct, while
  // `dto.experiences.map(...) ?? []` evaluates `.map` BEFORE the guard and
  // throws on an absent array. This payload carries no section keys at all, so
  // the wrong shape fails here rather than in production.
  it('defaults missing section arrays to empty', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ name: 'Solo Person' }),
    });

    const cv = await repository().getCv('1');

    expect(cv.experiences).toEqual([]);
    expect(cv.education).toEqual([]);
    expect(cv.skills).toEqual([]);
    expect(cv.projects).toEqual([]);
  });

  // Contract rule 7 (T-209, docs/api-contract.md): an optional field is always a
  // PRESENT key whose empty value is `null` -- never a missing key. The BFF
  // copies those values verbatim (T-210), so this is exactly what production
  // sends for a sparsely-filled CV.
  //
  // The fixture is annotated `Cv` deliberately. `BffCvRepository` casts the
  // response (`as CvDto`) with no runtime validation, so nothing between the
  // wire and the domain type can catch a null landing in a `string`-typed
  // field. Type-checking the fixture is the only place that check can live --
  // and before T-405 it did not compile: `Skill.category` and
  // `Project.startDate` were required non-null strings, and the other eight
  // optionals were `?:`, claiming a key that is always present may be absent.
  const allNull: Cv = {
    name: 'Jane Doe',
    headline: null,
    location: null,
    summary: null,
    experiences: [
      {
        company: 'ACME',
        role: 'Engineer',
        location: null,
        startDate: '2022-01-01',
        endDate: null,
        description: null,
      },
    ],
    education: [
      {
        institution: 'UNED',
        degree: 'BSc',
        fieldOfStudy: null,
        startDate: '2015-09-01',
        endDate: null,
      },
    ],
    skills: [{ name: 'TypeScript', category: null, proficiency: 'ADVANCED' }],
    projects: [
      { name: 'cv-project', description: null, repoUrl: null, startDate: null, endDate: null },
    ],
  };

  it('carries rule-7 nulls through to the domain Cv without coercing them', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => allNull,
    });

    const cv = await repository().getCv('1');

    // Head fields: null, not undefined and not ''.
    expect(cv.headline).toBeNull();
    expect(cv.location).toBeNull();
    expect(cv.summary).toBeNull();

    // The two the contract's SS Ordering already reasons about as empty:
    // undated projects sort last, uncategorized skills sort last. Before T-405
    // both were typed as required non-null strings.
    expect(cv.skills[0].category).toBeNull();
    expect(cv.projects[0].startDate).toBeNull();

    // The rest, present-and-null rather than absent.
    expect(cv.experiences[0].location).toBeNull();
    expect(cv.experiences[0].description).toBeNull();
    expect(cv.education[0].fieldOfStudy).toBeNull();
    expect(cv.projects[0].description).toBeNull();
    expect(cv.projects[0].repoUrl).toBeNull();

    // Sections still map; nulls did not knock out the arrays.
    expect(cv.experiences).toHaveLength(1);
    expect(cv.skills[0].proficiency).toBe('ADVANCED');
  });


  // ------------------------------------------------------------------ T-407
  // Rule 7 says the key is ALWAYS present, so the domain types declare
  // `string | null` (T-405). `toCv` is the one place that assumption is made
  // safe: it is this app's anti-corruption layer, and normalizing a producer's
  // omission into the domain's own empty value never leaves the process. (The
  // same `?? null` is FORBIDDEN in cv-bff-node per T-210 — the BFF is a
  // pass-through and would fabricate a null on the wire.)
  //
  // Keys below are genuinely ABSENT, not null and not explicit undefined --
  // what `JSON.parse` yields from a producer that dropped a key. Thirteen
  // fields are typed `string | null`: ten rule-7 optionals plus the three
  // rule-3 `endDate`s, whose null means "current" and whose undefined would
  // silently stop a current role being rendered as "Present".
  const omittedKeys = {
    name: 'Jane Doe',
    // headline, location, summary: absent
    experiences: [
      // location, endDate, description: absent
      { company: 'ACME', role: 'Engineer', startDate: '2022-01-01' },
      { company: 'Globex', role: 'Lead', startDate: '2020-03-01' },
    ],
    // fieldOfStudy, endDate: absent
    education: [{ institution: 'UNED', degree: 'BSc', startDate: '2015-09-01' }],
    // category: absent
    skills: [{ name: 'TypeScript', proficiency: 'ADVANCED' }],
    // description, repoUrl, startDate, endDate: absent
    projects: [{ name: 'cv-project' }],
  };

  async function getCvFrom(json: unknown): Promise<Cv> {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => json });
    return repository().getCv('1');
  }

  // One case per field so a partial fix cannot hide behind an earlier failure:
  // against master all thirteen fail, because master copies the section arrays
  // verbatim and never maps their elements at all.
  describe.each<[string, (cv: Cv) => string | null]>([
    ['headline', (cv) => cv.headline],
    ['location', (cv) => cv.location],
    ['summary', (cv) => cv.summary],
    ['experiences[0].location', (cv) => cv.experiences[0].location],
    ['experiences[0].endDate', (cv) => cv.experiences[0].endDate],
    ['experiences[0].description', (cv) => cv.experiences[0].description],
    ['education[0].fieldOfStudy', (cv) => cv.education[0].fieldOfStudy],
    ['education[0].endDate', (cv) => cv.education[0].endDate],
    ['skills[0].category', (cv) => cv.skills[0].category],
    ['projects[0].description', (cv) => cv.projects[0].description],
    ['projects[0].repoUrl', (cv) => cv.projects[0].repoUrl],
    ['projects[0].startDate', (cv) => cv.projects[0].startDate],
    ['projects[0].endDate', (cv) => cv.projects[0].endDate],
  ])('an omitted contract-optional key', (field, read) => {
    it(`becomes null, not undefined, at ${field}`, async () => {
      // toBeNull(), never toBeFalsy(): it fails on undefined too.
      expect(read(await getCvFrom(omittedKeys))).toBeNull();
    });
  });

  it('normalizes every element of a section, not just the first', async () => {
    const cv = await getCvFrom(omittedKeys);

    expect(cv.experiences).toHaveLength(2);
    expect(cv.experiences[1].company).toBe('Globex');
    expect(cv.experiences[1].location).toBeNull();
    expect(cv.experiences[1].endDate).toBeNull();
    expect(cv.experiences[1].description).toBeNull();
  });

  // `?? null` vs `|| null`: they disagree on exactly one input, the legitimate
  // empty string. `'' ?? null` is `''`; `'' || null` is `null`, erasing a real
  // value. One `''` per mapping site (the Person literal + four element
  // mappers). This does NOT fail against master -- master does no scalar
  // coercion, so `''` already survives there; it exists to fail against a
  // plausible wrong fix, and was verified by mutating each `??` to `||`.
  const emptyStrings: Cv = {
    name: 'Jane Doe',
    headline: '',
    location: '',
    summary: '',
    experiences: [
      {
        company: 'ACME',
        role: 'Engineer',
        location: '',
        startDate: '2022-01-01',
        endDate: '',
        description: '',
      },
    ],
    education: [
      { institution: 'UNED', degree: 'BSc', fieldOfStudy: '', startDate: '2015-09-01', endDate: '' },
    ],
    skills: [{ name: 'TypeScript', category: '', proficiency: 'ADVANCED' }],
    projects: [{ name: 'cv-project', description: '', repoUrl: '', startDate: '', endDate: '' }],
  };

  it('keeps a legitimate empty string instead of collapsing it to null', async () => {
    const cv = await getCvFrom(emptyStrings);

    expect(cv.headline).toBe('');
    expect(cv.location).toBe('');
    expect(cv.summary).toBe('');
    expect(cv.experiences[0].location).toBe('');
    expect(cv.experiences[0].endDate).toBe('');
    expect(cv.experiences[0].description).toBe('');
    expect(cv.education[0].fieldOfStudy).toBe('');
    expect(cv.education[0].endDate).toBe('');
    expect(cv.skills[0].category).toBe('');
    expect(cv.projects[0].description).toBe('');
    expect(cv.projects[0].repoUrl).toBe('');
    expect(cv.projects[0].startDate).toBe('');
    expect(cv.projects[0].endDate).toBe('');
  });

  it('throws a typed CvFetchError on a non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });

    await expect(repository().getCv('1')).rejects.toBeInstanceOf(CvFetchError);
    await expect(repository().getCv('1')).rejects.toMatchObject({ status: 502 });
  });
});
