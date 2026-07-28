import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Load next.config and .env files into the test environment.
  dir: './',
});

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

// next/jest merges its own transform (SWC) — export the async factory so it wins.
export default createJestConfig(config);
