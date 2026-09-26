import { render, screen, within } from '@testing-library/react';
import { Project } from '../../domain/cv';
import ProjectsSection from './ProjectsSection';

const cvProject: Project = {
  name: 'cv-project', description: 'This CV.', repoUrl: 'https://github.com/erfeamor/cv',
  startDate: '2026-07-01', endDate: null,
};
const undated: Project = { name: 'Side thing', description: null, repoUrl: null, startDate: null, endDate: null };

describe('ProjectsSection', () => {
  it('renders the heading and every contract field, in the order received', () => {
    // undated first: the contract puts it last, the component must not "fix" it
    render(<ProjectsSection projects={[undated, cvProject]} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Projects' })).toBeInTheDocument();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((li) => within(li).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Side thing',
      'cv-project',
    ]);
    expect(within(items[1]).getByText('This CV.')).toBeInTheDocument();
    const link = within(items[1]).getByRole('link', { name: 'https://github.com/erfeamor/cv' });
    expect(link).toHaveAttribute('href', 'https://github.com/erfeamor/cv');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).not.toHaveAttribute('target');
  });

  it('renders a null endDate as "Present"', () => {
    render(<ProjectsSection projects={[cvProject]} />);

    expect(screen.getByText('Jul 2026 – Present')).toBeInTheDocument();
  });

  it('renders no date line for an undated project, and omits null/empty optionals', () => {
    render(<ProjectsSection projects={[undated, { ...undated, description: '', repoUrl: '' }]} />);

    screen.getAllByRole('listitem').forEach((item) => {
      expect(item.querySelectorAll('p')).toHaveLength(0);
    });
    expect(screen.queryByText(/Present/)).not.toBeInTheDocument();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
  });

  it('marks the list with role="list"', () => {
    const { container } = render(<ProjectsSection projects={[cvProject]} />);

    expect(container.querySelector('ul')).toHaveAttribute('role', 'list');
  });

  it('renders nothing for an empty array', () => {
    const { container } = render(<ProjectsSection projects={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each(['http://example.com/a', 'HTTPS://example.com/a'])('links %j', (repoUrl) => {
    render(<ProjectsSection projects={[{ ...cvProject, repoUrl }]} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', expect.stringMatching(/^https?:\/\/example\.com\/a$/));
  });

  // React 18 does not sanitize href (it only warns on javascript:), so the
  // component itself must refuse to link anything but http(s).
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
  ])('renders %j as plain text, never a link', (repoUrl) => {
    const { container } = render(<ProjectsSection projects={[{ ...cvProject, repoUrl }]} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.querySelector('[href]')).toBeNull();
    expect(container.querySelector('.cv-project-repo')?.textContent).toBe(repoUrl);
  });
});
