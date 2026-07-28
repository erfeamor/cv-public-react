import { BffCvRepository, CvFetchError } from './BffCvRepository';

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

  it('throws a typed CvFetchError on a non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });

    await expect(repository().getCv('1')).rejects.toBeInstanceOf(CvFetchError);
    await expect(repository().getCv('1')).rejects.toMatchObject({ status: 502 });
  });
});
