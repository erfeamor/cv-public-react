import { render, screen } from '@testing-library/react';
import { Cv } from '../src/domain/cv';
import { BffConfigError, CvFetchError, CvPayloadError, getCv } from '../src/composition/container';
import HomePage from './page';

jest.mock('../src/composition/container', () => ({
  ...jest.requireActual('../src/composition/container'),
  getCv: jest.fn(),
}));

const mockedGetCv = getCv as jest.MockedFunction<typeof getCv>;

const cv: Cv = {
  name: 'Jane Doe',
  headline: null,
  location: null,
  summary: null,
  experiences: [],
  education: [],
  skills: [],
  projects: [],
};

describe('HomePage', () => {
  afterEach(() => mockedGetCv.mockReset());

  it('renders the person head from the loaded CV', async () => {
    mockedGetCv.mockResolvedValue(cv);

    render(await HomePage());

    expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument();
  });

  it('renders all four sections below the person head from one getCv() call, in the order received', async () => {
    mockedGetCv.mockResolvedValue({
      ...cv,
      experiences: [
        { company: 'Older', role: 'R', location: null, startDate: '2010-01-01', endDate: '2011-01-01', description: null },
        { company: 'Newer', role: 'R', location: null, startDate: '2020-01-01', endDate: null, description: null },
      ],
      education: [{ institution: 'UNED', degree: 'BSc', fieldOfStudy: null, startDate: '2015-09-01', endDate: '2019-06-30' }],
      skills: [{ name: 'TypeScript', category: 'Languages', proficiency: 'EXPERT' }],
      projects: [{ name: 'cv-project', description: null, repoUrl: null, startDate: null, endDate: null }],
    });

    const { container } = render(await HomePage());

    expect(mockedGetCv).toHaveBeenCalledTimes(1);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Experience', 'Education', 'Skills', 'Projects']);
    const h1 = screen.getByRole('heading', { level: 1, name: 'Jane Doe' });
    expect(h1.compareDocumentPosition(screen.getByRole('heading', { name: 'Experience' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const text = container.textContent ?? '';
    expect(text.indexOf('Older')).toBeLessThan(text.indexOf('Newer'));
  });

  it('omits a section whose array is empty', async () => {
    mockedGetCv.mockResolvedValue({
      ...cv,
      skills: [{ name: 'TypeScript', category: null, proficiency: 'EXPERT' }],
    });

    render(await HomePage());

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Skills']);
  });

  it('renders the "unavailable" alert when the BFF answers non-2xx (CvFetchError)', async () => {
    mockedGetCv.mockRejectedValue(new CvFetchError('BFF responded 503', 503));

    render(await HomePage());

    expect(screen.getByRole('alert')).toHaveTextContent('temporarily unavailable');
  });

  it('renders the "unavailable" alert when the BFF is unreachable (fetch rejects)', async () => {
    mockedGetCv.mockRejectedValue(new TypeError('fetch failed'));

    render(await HomePage());

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  // T-409 (H1): a contract-violating payload is NOT rendered as the alert.
  // Under ISR, a throw during background revalidation makes Next keep serving
  // the last good page, and a first build against a bad payload fails -- the
  // "fail loudly" a running page can actually do.
  it('rethrows a CvPayloadError instead of rendering the alert', async () => {
    const error = new CvPayloadError('experiences[0].endDate', 'is absent');
    mockedGetCv.mockRejectedValue(error);

    await expect(HomePage()).rejects.toBe(error);
  });

  // End to end through the real adapter (only fetch is faked): a 2xx HTML
  // body must reach the page as CvPayloadError and propagate, not be caught
  // as a generic failure and rendered as the alert.
  it('rethrows when the BFF answers 2xx with a body that is not JSON', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    });
    const { getCv: realGetCv } = jest.requireActual<typeof import('../src/composition/container')>(
      '../src/composition/container',
    );
    mockedGetCv.mockImplementation(realGetCv);

    try {
      await expect(HomePage()).rejects.toBeInstanceOf(CvPayloadError);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // T-404 (H1): a missing/malformed BFF_URL must fail `next build` (the page is
  // prerendered there), not render the alert and ship it under ISR.
  it('rethrows a BffConfigError instead of rendering the alert', async () => {
    const error = new BffConfigError('BFF_URL is not set');
    mockedGetCv.mockRejectedValue(error);

    await expect(HomePage()).rejects.toBe(error);
  });

  it('rethrows through the real composition root in production with BFF_URL unset', async () => {
    const originalEnv = process.env;
    process.env = { ...originalEnv, VERCEL_ENV: 'production' };
    delete process.env.BFF_URL;
    const { getCv: realGetCv } = jest.requireActual<typeof import('../src/composition/container')>(
      '../src/composition/container',
    );
    mockedGetCv.mockImplementation(realGetCv);

    try {
      await expect(HomePage()).rejects.toBeInstanceOf(BffConfigError);
    } finally {
      process.env = originalEnv;
    }
  });
});
