import { render, screen } from '@testing-library/react';
import { Cv } from '../src/domain/cv';
import { CvFetchError, CvPayloadError, getCv } from '../src/composition/container';
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
});
