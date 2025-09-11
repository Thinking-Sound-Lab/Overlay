module.exports = {
  // Use multiple projects for different test environments
  projects: [
    // Main process tests (Node environment)
    {
      displayName: 'main',
      testMatch: ['<rootDir>/tests/unit/services/**/*.test.ts', '<rootDir>/tests/integration/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@shared/(.*)$': '<rootDir>/src/shared/$1',
        '^@main/(.*)$': '<rootDir>/src/main/$1',
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup/main.setup.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.json'
        }]
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      collectCoverageFrom: [
        'src/main/**/*.{ts,tsx}',
        '!src/main/**/*.d.ts',
        '!src/main/**/index.ts',
      ],
      coverageDirectory: 'coverage/main',
      coverageReporters: ['text', 'lcov', 'html']
    },
    
    // Renderer process tests (JSDOM environment)
    {
      displayName: 'renderer',
      testMatch: ['<rootDir>/tests/unit/components/**/*.test.{ts,tsx}'],
      testEnvironment: 'jsdom',
      preset: 'ts-jest',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@shared/(.*)$': '<rootDir>/src/shared/$1',
        '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup/renderer.setup.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.json'
        }]
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      collectCoverageFrom: [
        'src/renderer/**/*.{ts,tsx}',
        '!src/renderer/**/*.d.ts',
        '!src/renderer/**/index.ts',
      ],
      coverageDirectory: 'coverage/renderer',
      coverageReporters: ['text', 'lcov', 'html']
    }
  ],
  
  // Global coverage settings
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/preload/**/*', // Preload scripts are harder to test
  ],
  
  // Test timeout
  testTimeout: 10000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Better error reporting
  errorOnDeprecated: true,
  
  // Reporters for CI/CD
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'reports/junit',
      outputName: 'junit.xml',
      addFileAttribute: true, // Required for CircleCI test splitting
      ancestorSeparator: ' › ',
      uniqueOutputName: 'false',
      suiteNameTemplate: '{displayName}: {filepath}',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }]
  ],
};