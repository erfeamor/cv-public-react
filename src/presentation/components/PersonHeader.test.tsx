import { render, screen } from '@testing-library/react';
import { Person } from '../../domain/cv';
import PersonHeader from './PersonHeader';

describe('PersonHeader', () => {
  it('renders the name as a heading with all optional fields present', () => {
    const person: Person = {
      name: 'Jane Doe',
      headline: 'Backend Engineer',
      location: 'Madrid',
      summary: 'Builds reliable systems.',
    };

    render(<PersonHeader person={person} />);

    expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument();
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Madrid')).toBeInTheDocument();
    expect(screen.getByText('Builds reliable systems.')).toBeInTheDocument();
  });

  it('omits optional fields when they are absent', () => {
    render(<PersonHeader person={{ name: 'Solo Person' }} />);

    expect(screen.getByRole('heading', { name: 'Solo Person' })).toBeInTheDocument();
    expect(screen.queryByText('Backend Engineer')).not.toBeInTheDocument();
    expect(screen.queryByText('Madrid')).not.toBeInTheDocument();
    expect(screen.queryByText('Builds reliable systems.')).not.toBeInTheDocument();
  });
});
