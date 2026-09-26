import { render, screen, within } from '@testing-library/react';
import { Experience } from '../../domain/cv';
import ExperienceSection from './ExperienceSection';

const current: Experience = {
  company: 'ACME', role: 'Backend Engineer', location: 'Remote',
  startDate: '2022-01-01', endDate: null, description: 'Built things.',
};
const later: Experience = {
  company: 'Initech', role: 'Intern', location: null,
  startDate: '2024-03-01', endDate: '2024-09-30', description: null,
};

describe('ExperienceSection', () => {
  it('renders the heading and every contract field, in the order received', () => {
    // deliberately not startDate DESC: the component must not re-sort
    render(<ExperienceSection experiences={[current, later]} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Experience' })).toBeInTheDocument();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole('heading', { level: 3 })).toHaveTextContent('Backend Engineer · ACME');
    expect(within(items[0]).getByText('Remote')).toBeInTheDocument();
    expect(within(items[0]).getByText('Built things.')).toBeInTheDocument();
    expect(within(items[1]).getByRole('heading', { level: 3 })).toHaveTextContent('Intern · Initech');
    expect(within(items[1]).getByText('Mar 2024 – Sep 2024')).toBeInTheDocument();
  });

  it('renders a null endDate as "Present"', () => {
    render(<ExperienceSection experiences={[current]} />);

    expect(screen.getByText('Jan 2022 – Present')).toBeInTheDocument();
  });

  it('omits null and empty optionals without rendering "null"', () => {
    render(<ExperienceSection experiences={[later, { ...later, location: '', description: '' }]} />);

    // each item: heading + period only
    screen.getAllByRole('listitem').forEach((item) => {
      expect(item.querySelectorAll('p')).toHaveLength(1);
    });
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
  });

  it('marks the list with role="list"', () => {
    const { container } = render(<ExperienceSection experiences={[current]} />);

    expect(container.querySelector('ul')).toHaveAttribute('role', 'list');
  });

  it('renders nothing for an empty array', () => {
    const { container } = render(<ExperienceSection experiences={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
