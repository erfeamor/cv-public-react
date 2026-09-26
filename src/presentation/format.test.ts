import { formatMonthYear, formatPeriod, isPresent, safeHttpUrl } from './format';

describe('formatMonthYear', () => {
  it.each([
    ['2022-01-01', 'Jan 2022'],
    ['2019-06-30', 'Jun 2019'],
    ['2024-12-31', 'Dec 2024'],
  ])('formats %s as %s from a fixed English month list', (iso, expected) => {
    expect(formatMonthYear(iso)).toBe(expected);
  });

  it.each(['2022-13-01', '2022-00-01', '2022-01', 'sometime', ''])(
    'returns %j as received when it is not YYYY-MM-DD with a real month',
    (value) => {
      expect(formatMonthYear(value)).toBe(value);
    },
  );
});

describe('formatPeriod', () => {
  it('renders a closed range', () => {
    expect(formatPeriod('2015-09-01', '2019-06-30')).toBe('Sep 2015 – Jun 2019');
  });

  it('renders a null endDate as "Present"', () => {
    expect(formatPeriod('2022-01-01', null)).toBe('Jan 2022 – Present');
  });

  it('returns null for an undated entry, rather than claiming it is ongoing', () => {
    expect(formatPeriod(null, null)).toBeNull();
  });

  it('renders only the end when there is no start', () => {
    expect(formatPeriod(null, '2020-03-01')).toBe('Mar 2020');
  });
});

describe('isPresent', () => {
  it.each([
    [null, false],
    ['', false],
    ['x', true],
  ])('%j -> %s', (value, expected) => {
    expect(isPresent(value)).toBe(expected);
  });
});

describe('safeHttpUrl', () => {
  it.each([
    ['https://github.com/erfeamor/cv', 'https://github.com/erfeamor/cv'],
    ['http://example.com/a', 'http://example.com/a'],
    ['HTTPS://Example.com/a', 'https://example.com/a'],
    ['  https://example.com/a', 'https://example.com/a'],
  ])('accepts %j as %j (the parser-normalized href)', (value, expected) => {
    expect(safeHttpUrl(value)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    '\u0000javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '//evil.example/x',
    'github.com/erfeamor/cv',
    '',
  ])('rejects %j', (value) => {
    expect(safeHttpUrl(value)).toBeNull();
  });
});
