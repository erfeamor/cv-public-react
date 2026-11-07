import { metadata } from './layout';

// T-410: without metadataBase Next resolves canonical/OG URLs against
// localhost (and warns at build); the site's own origin is react.erfeamor.com.
describe('root layout metadata', () => {
  it('resolves relative metadata URLs against https://react.erfeamor.com', () => {
    expect(metadata.metadataBase?.href).toBe('https://react.erfeamor.com/');
  });
});
