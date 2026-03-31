module.exports = {
  displayName: 'ui',
  preset: 'react-native',
  setupFilesAfterSetup: ['@testing-library/react-native/extend-expect'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
  },
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.tsx', '**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '@ascension/shared': '<rootDir>/../shared/src/index.ts',
  },
};
