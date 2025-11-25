module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit'],
  testMatch: ['**/tests/unit/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    'isomorphic-dompurify': '<rootDir>/tests/unit/__mocks__/isomorphic-dompurify.js',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: 'node',
        strict: false,
        skipLibCheck: true,
      }
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(isomorphic-dompurify)/)',
  ],
  testTimeout: 10000,
  verbose: true,
  collectCoverage: true,
  coverageDirectory: 'coverage/unit',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/lib/auction/engine.ts',
    'src/lib/worker.ts',
  ],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
