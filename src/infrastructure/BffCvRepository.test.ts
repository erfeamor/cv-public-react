import { BffCvRepository, CvFetchError, CvPayloadError } from './BffCvRepository';
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
  // The fixture is annotated `Cv` deliberately, so the compiler checks it
  // against the domain types. When this was written `BffCvRepository` cast the
  // response with no runtime validation (T-409 added it), which made this the
  // only place a null landing in a `string`-typed field could be caught --
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
  // what `JSON.parse` yields from a producer that dropped a key. Ten fields are
  // rule-7 optionals, whose null is merely the empty value, so an absent key is
  // normalized to it. The three rule-3 `endDate`s are NOT among them: their
  // null means "current", so an absent one is a contract violation the adapter
  // rejects (T-409, named tests below) -- this fixture sends them present-null.
  const omittedKeys = {
    name: 'Jane Doe',
    // headline, location, summary: absent
    experiences: [
      // location, description: absent
      { company: 'ACME', role: 'Engineer', startDate: '2022-01-01', endDate: null },
      { company: 'Globex', role: 'Lead', startDate: '2020-03-01', endDate: null },
    ],
    // fieldOfStudy: absent
    education: [{ institution: 'UNED', degree: 'BSc', startDate: '2015-09-01', endDate: null }],
    // category: absent
    skills: [{ name: 'TypeScript', proficiency: 'ADVANCED' }],
    // description, repoUrl, startDate: absent
    projects: [{ name: 'cv-project', endDate: null }],
  };

  async function getCvFrom(json: unknown): Promise<Cv> {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => json });
    return repository().getCv('1');
  }

  // One case per field so a partial fix cannot hide behind an earlier failure:
  // against T-407's base all of these failed, because it copied the section
  // arrays verbatim and never mapped their elements at all. The three
  // `endDate` rows that used to sit here are the named T-409 tests below.
  describe.each<[string, (cv: Cv) => string | null]>([
    ['headline', (cv) => cv.headline],
    ['location', (cv) => cv.location],
    ['summary', (cv) => cv.summary],
    ['experiences[0].location', (cv) => cv.experiences[0].location],
    ['experiences[0].description', (cv) => cv.experiences[0].description],
    ['education[0].fieldOfStudy', (cv) => cv.education[0].fieldOfStudy],
    ['skills[0].category', (cv) => cv.skills[0].category],
    ['projects[0].description', (cv) => cv.projects[0].description],
    ['projects[0].repoUrl', (cv) => cv.projects[0].repoUrl],
    ['projects[0].startDate', (cv) => cv.projects[0].startDate],
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

  // ------------------------------------------------------------------ T-409
  // The adapter VALIDATES before it normalizes. Every contract violation is one
  // typed CvPayloadError naming the JSON path, thrown here at the boundary --
  // not as an `Invalid Date` three layers up. A payload is accepted whole or
  // rejected whole: there is no partial CV.

  type Fixture = {
    [key: string]: unknown;
    experiences: Record<string, unknown>[];
    education: Record<string, unknown>[];
    skills: Record<string, unknown>[];
    projects: Record<string, unknown>[];
  };

  /** A fresh, contract-valid payload to break in exactly one place. */
  function valid(): Fixture {
    return JSON.parse(JSON.stringify(payload)) as Fixture;
  }

  async function expectPayloadError(json: unknown, path: string): Promise<void> {
    const failure = getCvFrom(json);
    await expect(failure).rejects.toBeInstanceOf(CvPayloadError);
    await expect(failure).rejects.toMatchObject({ name: 'CvPayloadError', path });
  }

  // `endDate` is the one field where `null` is a positive claim (rule 3:
  // "current"), so these three are named, not rows in the table above. T-407
  // normalized an absent `endDate` to null, which made a producer that dropped
  // the key on a finished 2020-2022 role render it as "Present" -- a wrong fact
  // on a public CV. The adapter can only tell "absent" (producer bug) from
  // "present and null" (a current role) before normalizing, so it does.
  describe('endDate: absent is a producer bug, present-null means "current"', () => {
    it('rejects a payload with experiences[].endDate absent, rather than silently asserting "current"', async () => {
      const json = valid();
      delete json.experiences[0].endDate;
      await expectPayloadError(json, 'experiences[0].endDate');
    });

    it('rejects a payload with education[].endDate absent, rather than silently asserting "current"', async () => {
      const json = valid();
      delete json.education[0].endDate;
      await expectPayloadError(json, 'education[0].endDate');
    });

    it('rejects a payload with projects[].endDate absent, rather than silently asserting "current"', async () => {
      const json = valid();
      delete json.projects[0].endDate;
      await expectPayloadError(json, 'projects[0].endDate');
    });

    it('keeps a present-null endDate as null ("current") on all three sections', async () => {
      const json = valid();
      json.experiences[0].endDate = null;
      json.education[0].endDate = null;
      json.projects[0].endDate = null;

      const cv = await getCvFrom(json);

      expect(cv.experiences[0].endDate).toBeNull();
      expect(cv.education[0].endDate).toBeNull();
      expect(cv.projects[0].endDate).toBeNull();
    });
  });

  // Required per docs/api-contract.md: the `Required:` lists for experience,
  // education and project, plus the person's and the catalog skill's `name`.
  // Each is broken three ways -- absent, null, wrong primitive -- because a
  // presence check alone would let `startDate: 123` through.
  describe.each<[string, (json: Fixture) => [Record<string, unknown>, string]]>([
    ['name', (json) => [json, 'name']],
    ['experiences[0].company', (json) => [json.experiences[0], 'company']],
    ['experiences[0].role', (json) => [json.experiences[0], 'role']],
    ['experiences[0].startDate', (json) => [json.experiences[0], 'startDate']],
    ['education[0].institution', (json) => [json.education[0], 'institution']],
    ['education[0].degree', (json) => [json.education[0], 'degree']],
    ['education[0].startDate', (json) => [json.education[0], 'startDate']],
    ['skills[0].name', (json) => [json.skills[0], 'name']],
    ['projects[0].name', (json) => [json.projects[0], 'name']],
  ])('the required field %s', (path, locate) => {
    it('rejects the payload when the key is absent', async () => {
      const json = valid();
      const [target, key] = locate(json);
      delete target[key];
      await expectPayloadError(json, path);
    });

    it('rejects the payload when the value is null', async () => {
      const json = valid();
      const [target, key] = locate(json);
      target[key] = null;
      await expectPayloadError(json, path);
    });

    it('rejects the payload when the value is not a string', async () => {
      const json = valid();
      const [target, key] = locate(json);
      target[key] = 123;
      await expectPayloadError(json, path);
    });
  });

  // An unknown proficiency rejects the WHOLE payload (H1, 2026-09-26), not just
  // that skill: one rule, one test shape. A fifth enum value reaching a
  // `Record<Proficiency, ...>` lookup would yield undefined with no type error.
  describe('proficiency', () => {
    it.each(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'])('accepts %s', async (level) => {
      const json = valid();
      json.skills[0].proficiency = level;
      expect((await getCvFrom(json)).skills[0].proficiency).toBe(level);
    });

    it.each<[string, unknown]>([
      ['an unknown enum value', 'MASTER'],
      ['a known value in the wrong case', 'advanced'],
      ['an empty string', ''],
      ['null', null],
    ])('rejects the whole payload for %s', async (_label, value) => {
      const json = valid();
      json.skills[0].proficiency = value;
      await expectPayloadError(json, 'skills[0].proficiency');
    });

    it('rejects the whole payload when proficiency is absent', async () => {
      const json = valid();
      delete json.skills[0].proficiency;
      await expectPayloadError(json, 'skills[0].proficiency');
    });
  });

  // Decision (T-409): an optional field that is PRESENT but neither a string
  // nor null is a contract violation like any other -- it is rejected, not
  // coerced. Only absence is normalized (T-407), because only absence has a
  // neutral reading.
  describe.each<[string, (json: Fixture) => [Record<string, unknown>, string]]>([
    ['headline', (json) => [json, 'headline']],
    ['experiences[0].location', (json) => [json.experiences[0], 'location']],
    ['experiences[0].endDate', (json) => [json.experiences[0], 'endDate']],
    ['education[0].fieldOfStudy', (json) => [json.education[0], 'fieldOfStudy']],
    ['skills[0].category', (json) => [json.skills[0], 'category']],
    ['projects[0].startDate', (json) => [json.projects[0], 'startDate']],
    ['projects[0].repoUrl', (json) => [json.projects[0], 'repoUrl']],
  ])('the nullable field %s', (path, locate) => {
    it('rejects the payload when the value is neither a string nor null', async () => {
      const json = valid();
      const [target, key] = locate(json);
      target[key] = 42;
      await expectPayloadError(json, path);
    });
  });

  // Decision (T-409): an absent OR null section is the empty list (T-407's
  // `?? []`, unchanged); a present non-array section, or a non-object element,
  // is rejected.
  describe('section shape', () => {
    it.each(['experiences', 'education', 'skills', 'projects'])(
      'rejects the payload when %s is present but not an array',
      async (section) => {
        const json = valid();
        json[section] = { 0: 'not a list' };
        await expectPayloadError(json, section);
      },
    );

    it('treats a null section like an absent one: the empty list', async () => {
      const cv = await getCvFrom({ name: 'Solo Person', experiences: null });
      expect(cv.experiences).toEqual([]);
    });

    it('rejects the payload when a section element is not an object', async () => {
      const json = valid();
      (json.education as unknown[])[0] = 'UNED';
      await expectPayloadError(json, 'education[0]');
    });

    it('rejects a body that is not a JSON object at all', async () => {
      await expectPayloadError(['Jane Doe'], '$');
      await expectPayloadError(null, '$');
    });
  });

  it('names the path and the offending value in the error message', async () => {
    const json = valid();
    json.skills[0].proficiency = 'MASTER';
    await expect(getCvFrom(json)).rejects.toThrow(/skills\[0\]\.proficiency.*"MASTER"/);
  });

  it('throws a typed CvFetchError on a non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });

    await expect(repository().getCv('1')).rejects.toBeInstanceOf(CvFetchError);
    await expect(repository().getCv('1')).rejects.toMatchObject({ status: 502 });
  });
});
