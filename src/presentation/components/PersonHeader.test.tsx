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

  // Contract rule 7 (T-209): an optional field is a PRESENT key valued `null`,
  // never a missing one -- so this is what the BFF actually sends for a person
  // with no headline/location/summary. The fixture used to be
  // `{ name: 'Solo Person' }`, a shape the BFF does not produce and which only
  // typechecked because these fields were `?:` (T-405).
  it('omits optional fields when they are null, without rendering "null"', () => {
    const person: Person = {
      name: 'Solo Person',
      headline: null,
      location: null,
      summary: null,
    };

    render(<PersonHeader person={person} />);

    expect(screen.getByRole('heading', { name: 'Solo Person' })).toBeInTheDocument();
    expect(screen.queryByText('Backend Engineer')).not.toBeInTheDocument();
    expect(screen.queryByText('Madrid')).not.toBeInTheDocument();
    expect(screen.queryByText('Builds reliable systems.')).not.toBeInTheDocument();
    // This is the assertion that does the work: it fails if the truthiness
    // guard is dropped, because an unconditional <p> renders EMPTY for a null
    // child. Verified by probe -- removing the guard fails this test.
    expect(document.querySelectorAll('p')).toHaveLength(0);
    // Weaker, and kept only for the case the line above cannot see: React
    // renders `{null}` as nothing, so a null child leaves no text -- but
    // INTERPOLATING it (`{`${person.headline}`}`) renders the literal "null".
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });
});
