import { Person } from '../../domain/cv';

/**
 * Pure presentational component for the person head. No data fetching, no env,
 * no client state — a Server Component by default. Optional fields render only
 * when present, so absent data leaves no empty elements behind.
 *
 * Note vs cv-public-vanilla: that repo hand-escapes every interpolated value to
 * avoid XSS. React escapes text children by default, so no manual escaping is
 * needed here — that safety comes for free with JSX.
 */
export default function PersonHeader({ person }: { person: Person }) {
  return (
    <header className="person-header">
      <h1>{person.name}</h1>
      {person.headline ? <p className="person-headline">{person.headline}</p> : null}
      {person.location ? (
        <p className="person-location">
          <span aria-hidden="true">📍 </span>
          {person.location}
        </p>
      ) : null}
      {person.summary ? <p className="person-summary">{person.summary}</p> : null}
    </header>
  );
}
