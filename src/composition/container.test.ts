import { BffConfigError, getCv, resolveBffUrl } from './container';

const ORIGIN = 'https://dvdlxl0zqepqi.cloudfront.net';

// T-404 (H1): a production build without BFF_URL must fail instead of
// prerendering a page that fetched localhost and baked the alert into ISR.
describe('resolveBffUrl', () => {
  describe('production (VERCEL_ENV=production)', () => {
    it('throws a BffConfigError naming BFF_URL when it is unset', () => {
      const resolve = () => resolveBffUrl({ VERCEL_ENV: 'production' });
      expect(resolve).toThrow(BffConfigError);
      expect(resolve).toThrow(/BFF_URL/);
      expect(resolve).toThrow(/CLAUDE\.md/);
    });

    it('throws when it is blank', () => {
      expect(() => resolveBffUrl({ VERCEL_ENV: 'production', BFF_URL: '' })).toThrow(BffConfigError);
      expect(() => resolveBffUrl({ VERCEL_ENV: 'production', BFF_URL: '   ' })).toThrow(/BFF_URL/);
    });

    it('returns the configured origin', () => {
      expect(resolveBffUrl({ VERCEL_ENV: 'production', BFF_URL: ORIGIN })).toBe(ORIGIN);
    });
  });

  describe('outside production', () => {
    it('defaults to localhost when unset (local dev, tests)', () => {
      expect(resolveBffUrl({})).toBe('http://localhost:3000');
    });

    it('defaults to localhost when blank', () => {
      expect(resolveBffUrl({ BFF_URL: '' })).toBe('http://localhost:3000');
    });

    // Previews keep the default: requiring BFF_URL there would fail every PR's
    // validation build on a dashboard setting rather than on the code.
    it('keeps the localhost default on Vercel previews', () => {
      expect(resolveBffUrl({ VERCEL_ENV: 'preview' })).toBe('http://localhost:3000');
    });

    it('returns the configured value', () => {
      expect(resolveBffUrl({ VERCEL_ENV: 'preview', BFF_URL: ORIGIN })).toBe(ORIGIN);
    });
  });

  // A value typed into a web form that looks right but 404s: the repository
  // appends /bff/api/v1/..., so BFF_URL must be the bare origin. Rejected in
  // every environment -- a set-but-malformed value is wrong everywhere.
  describe.each([undefined, 'preview', 'production'])('malformed values (VERCEL_ENV=%s)', (vercelEnv) => {
    it.each([
      `${ORIGIN}/`,
      `${ORIGIN}/bff/api/v1`,
      `${ORIGIN}/bff/api/v1/`,
      `${ORIGIN}/bff`,
    ])('rejects %s', (value) => {
      const resolve = () => resolveBffUrl({ VERCEL_ENV: vercelEnv, BFF_URL: value });
      expect(resolve).toThrow(BffConfigError);
      expect(resolve).toThrow(/bare origin/);
    });
  });
});

describe('getCv', () => {
  const originalEnv = process.env;
  afterEach(() => {
    process.env = originalEnv;
  });

  // The build path: app/page.tsx prerenders at `next build` and calls getCv(),
  // which must surface the misconfiguration (the page rethrows it).
  it('rejects with BffConfigError in production when BFF_URL is unset', async () => {
    process.env = { ...originalEnv, VERCEL_ENV: 'production' };
    delete process.env.BFF_URL;

    await expect(getCv('1')).rejects.toBeInstanceOf(BffConfigError);
  });
});
