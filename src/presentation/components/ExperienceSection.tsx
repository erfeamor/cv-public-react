import { Experience } from '../../domain/cv';
import { formatPeriod, isPresent } from '../format';

/**
 * Pure presentational Server Component, like PersonHeader. Renders entries in
 * the order received (api-contract § Ordering: the domain service orders) and
 * renders nothing at all for an empty array — no empty heading.
 */
export default function ExperienceSection({ experiences }: { experiences: Experience[] }) {
  if (experiences.length === 0) return null;

  return (
    <section className="cv-section">
      <h2>Experience</h2>
      <ul role="list">
        {experiences.map((experience, index) => (
          // Index keys: a static, server-rendered list that never reorders.
          <li key={index} className="cv-entry">
            <h3>
              {experience.role} · {experience.company}
            </h3>
            <p className="cv-period">{formatPeriod(experience.startDate, experience.endDate)}</p>
            {isPresent(experience.location) ? <p className="cv-location">{experience.location}</p> : null}
            {isPresent(experience.description) ? (
              <p className="cv-description">{experience.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
