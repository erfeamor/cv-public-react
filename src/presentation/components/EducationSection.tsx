import { Education } from '../../domain/cv';
import { formatPeriod, isPresent } from '../format';

/** Pure presentational Server Component; order as received, nothing when empty. */
export default function EducationSection({ education }: { education: Education[] }) {
  if (education.length === 0) return null;

  return (
    <section className="cv-section">
      <h2>Education</h2>
      <ul role="list">
        {education.map((entry, index) => (
          <li key={index} className="cv-entry">
            <h3>
              {entry.degree} · {entry.institution}
            </h3>
            {isPresent(entry.fieldOfStudy) ? <p className="cv-field">{entry.fieldOfStudy}</p> : null}
            <p className="cv-period">{formatPeriod(entry.startDate, entry.endDate)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
