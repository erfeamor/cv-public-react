import { render, screen } from '@testing-library/react';
import { Skill } from '../../domain/cv';
import SkillsSection from './SkillsSection';

describe('SkillsSection', () => {
  it('renders a flat list in the order received, with category and proficiency label', () => {
    // deliberately not category/name ASC: the component must not re-sort or group
    const skills: Skill[] = [
      { name: 'TypeScript', category: 'Languages', proficiency: 'EXPERT' },
      { name: 'Docker', category: 'Tools', proficiency: 'INTERMEDIATE' },
      { name: 'Java', category: 'Languages', proficiency: 'ADVANCED' },
      { name: 'Rust', category: 'Languages', proficiency: 'BEGINNER' },
    ];

    render(<SkillsSection skills={skills} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Skills' })).toBeInTheDocument();
    expect(screen.getAllByRole('list')).toHaveLength(1);
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'TypeScript Languages Expert',
      'Docker Tools Intermediate',
      'Java Languages Advanced',
      'Rust Languages Beginner',
    ]);
  });

  it('omits a null or empty category without rendering "null"', () => {
    render(
      <SkillsSection
        skills={[
          { name: 'Docker', category: null, proficiency: 'BEGINNER' },
          { name: 'Git', category: '', proficiency: 'EXPERT' },
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['Docker Beginner', 'Git Expert']);
    expect(document.querySelector('.cv-skill-category')).toBeNull();
  });

  it('marks the list with role="list"', () => {
    const { container } = render(
      <SkillsSection skills={[{ name: 'Git', category: null, proficiency: 'EXPERT' }]} />,
    );

    expect(container.querySelector('ul')).toHaveAttribute('role', 'list');
  });

  it('renders nothing for an empty array', () => {
    const { container } = render(<SkillsSection skills={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
