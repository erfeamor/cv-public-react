/**
 * Pure display helpers shared by the section components. Framework-free and
 * deterministic: no Intl, no locale, so a build machine's locale can never
 * change what ISR freezes into the served page. Mirrors cv-public-vanilla's
 * `sections.js` (T-401) so both public sites render the same CV the same way.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Contract-optional fields arrive as `null` (rule 7); `''` is treated as empty too. */
export function isPresent(value: string | null): value is string {
  return value !== null && value !== '';
}

/** `YYYY-MM-DD` → `Mon YYYY`; anything else is returned as received. */
export function formatMonthYear(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(isoDate);
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  return match && month ? `${month} ${match[1]}` : isoDate;
}

/**
 * `endDate: null` means "current" (contract rule 3) → "Present". An entry with
 * no startDate (only projects can have one) has no period at all: "Present"
 * alone would claim an undated project is ongoing. Returns null for "no line".
 */
export function formatPeriod(startDate: string | null, endDate: string | null): string | null {
  if (!isPresent(startDate)) {
    return isPresent(endDate) ? formatMonthYear(endDate) : null;
  }
  const end = isPresent(endDate) ? formatMonthYear(endDate) : 'Present';
  return `${formatMonthYear(startDate)} – ${end}`;
}

/**
 * Returns a safe href for an absolute http(s) URL, else null. React 18 does not
 * sanitize `href` (it only warns on `javascript:`), so this is the only guard.
 * The WHATWG URL parser is the algorithm the browser applies to href, so
 * whitespace, tab/newline and control-character tricks around a scheme are
 * resolved before the check, and the returned value is the parser's own
 * normalized serialization, not the raw input.
 */
export function safeHttpUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
}
