module.exports = {
  preset: 'ts-jest',
  projects: [
    // Backend/Node tests
    {
      displayName: 'node',
      testEnvironment: 'node',
      roots: ['<rootDir>/packages'],
      testMatch: [
        '**/__tests__/**/*.test.(ts)',
        '**/?(*.)+(spec|test).(ts)',
      ],
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      moduleNameMapper: {
        '^@portal/(.*)$': '<rootDir>/packages/$1/src',
      },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    },
    // React/Frontend tests
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/apps'],
      testMatch: [
        '**/__tests__/**/*.test.(ts|tsx)',
        '**/?(*.)+(spec|test).(ts|tsx)',
      ],
      transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/apps/desktop/src/$1',
        '^@shared/(.*)$': '<rootDir>/apps/desktop/src/shared/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      },
      setupFilesAfterEnv: [
        '<rootDir>/jest.setup.js',
        '<rootDir>/apps/desktop/src/test-setup.ts',
      ],
    },
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsx}',
    'apps/*/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};