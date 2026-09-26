import { Proficiency, Skill } from '../../domain/cv';
import { isPresent } from '../format';

/** Exhaustive: a fifth `Proficiency` literal is a compile error here. */
const PROFICIENCY_LABELS: Record<Proficiency, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

/**
 * Pure presentational Server Component. A flat list in the order received —
 * not grouped by category, since grouping would be a client-side reordering
 * (api-contract § Ordering). Nothing when empty.
 */
export default function SkillsSection({ skills }: { skills: Skill[] }) {
  if (skills.length === 0) return null;

  return (
    <section className="cv-section cv-skills">
      <h2>Skills</h2>
      <ul role="list">
        {skills.map((skill, index) => (
          <li key={index}>
            <span className="cv-skill-name">{skill.name}</span>
            {isPresent(skill.category) ? (
              <>
                {' '}
                <span className="cv-skill-category">{skill.category}</span>
              </>
            ) : null}{' '}
            <span className="cv-skill-proficiency">{PROFICIENCY_LABELS[skill.proficiency]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
