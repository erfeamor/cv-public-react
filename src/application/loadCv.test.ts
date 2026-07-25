import { Cv } from '../domain/cv';
import { CvRepository } from '../domain/ports';
import { loadCv } from './loadCv';

// A fake repository through the port — the use case must never touch fetch.
function fakeRepository(cv: Cv): CvRepository {
  return { getCv: jest.fn().mockResolvedValue(cv) };
}

const sampleCv: Cv = {
  name: 'Jane Doe',
  headline: 'Backend Engineer',
  location: 'Madrid',
  summary: 'Builds things.',
  experiences: [],
  education: [],
  skills: [],
  projects: [],
};

describe('loadCv', () => {
  it('returns the domain CV from the repository', async () => {
    const repository = fakeRepository(sampleCv);

    const result = await loadCv(repository, '1');

    expect(result).toEqual(sampleCv);
  });

  it('asks the repository for the requested person id', async () => {
    const repository = fakeRepository(sampleCv);

    await loadCv(repository, '42');

    expect(repository.getCv).toHaveBeenCalledWith('42');
  });

  it('propagates repository failures to the caller', async () => {
    const repository: CvRepository = {
      getCv: jest.fn().mockRejectedValue(new Error('boom')),
    };

    await expect(loadCv(repository, '1')).rejects.toThrow('boom');
  });
});
