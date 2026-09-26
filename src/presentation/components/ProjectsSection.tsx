import { Project } from '../../domain/cv';
import { formatPeriod, isPresent, safeHttpUrl } from '../format';

/**
 * Pure presentational Server Component; order as received, nothing when empty.
 * `repoUrl` becomes a link only for absolute http(s) URLs — React does not
 * sanitize href — and renders as plain text otherwise.
 */
export default function ProjectsSection({ projects }: { projects: Project[] }) {
  if (projects.length === 0) return null;

  return (
    <section className="cv-section">
      <h2>Projects</h2>
      <ul role="list">
        {projects.map((project, index) => {
          const period = formatPeriod(project.startDate, project.endDate);
          return (
            <li key={index} className="cv-entry">
              <h3>{project.name}</h3>
              {period !== null ? <p className="cv-period">{period}</p> : null}
              {isPresent(project.description) ? (
                <p className="cv-description">{project.description}</p>
              ) : null}
              {isPresent(project.repoUrl) ? (
                <p className="cv-project-repo">
                  <RepoLink repoUrl={project.repoUrl} />
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RepoLink({ repoUrl }: { repoUrl: string }) {
  const href = safeHttpUrl(repoUrl);
  return href !== null ? (
    <a href={href} rel="noopener noreferrer">
      {repoUrl}
    </a>
  ) : (
    <>{repoUrl}</>
  );
}
