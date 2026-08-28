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
    expect(url).toBe('http://bff.test/api/v1/people/1/cv');
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

  it('throws a typed CvFetchError on a non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });

    await expect(repository().getCv('1')).rejects.toBeInstanceOf(CvFetchError);
    await expect(repository().getCv('1')).rejects.toMatchObject({ status: 502 });
  });
});
