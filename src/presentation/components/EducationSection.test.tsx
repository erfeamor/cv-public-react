import { render, screen, within } from '@testing-library/react';
import { Education } from '../../domain/cv';
import EducationSection from './EducationSection';

const uned: Education = {
  institution: 'UNED', degree: 'BSc', fieldOfStudy: 'Computer Science',
  startDate: '2015-09-01', endDate: '2019-06-30',
};
const current: Education = {
  institution: 'MIT', degree: 'MSc', fieldOfStudy: null, startDate: '2020-09-01', endDate: null,
};

describe('EducationSection', () => {
  it('renders the heading and every contract field, in the order received', () => {
    render(<EducationSection education={[uned, current]} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Education' })).toBeInTheDocument();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole('heading', { level: 3 })).toHaveTextContent('BSc · UNED');
    expect(within(items[0]).getByText('Computer Science')).toBeInTheDocument();
    expect(within(items[0]).getByText('Sep 2015 – Jun 2019')).toBeInTheDocument();
    expect(within(items[1]).getByRole('heading', { level: 3 })).toHaveTextContent('MSc · MIT');
  });

  it('renders a null endDate as "Present"', () => {
    render(<EducationSection education={[current]} />);

    expect(screen.getByText('Sep 2020 – Present')).toBeInTheDocument();
  });

  it('omits a null or empty fieldOfStudy without rendering "null"', () => {
    render(<EducationSection education={[current, { ...current, fieldOfStudy: '' }]} />);

    screen.getAllByRole('listitem').forEach((item) => {
      expect(item.querySelectorAll('p')).toHaveLength(1);
    });
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
  });

  it('marks the list with role="list"', () => {
    const { container } = render(<EducationSection education={[uned]} />);

    expect(container.querySelector('ul')).toHaveAttribute('role', 'list');
  });

  it('renders nothing for an empty array', () => {
    const { container } = render(<EducationSection education={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
