module.exports = {
  globals: {
    'ts-jest': {
      // Tests use jest globals (it/expect) which the app's tsconfig
      // intentionally excludes from its `types` allow-list. Point
      // ts-jest at a test-only tsconfig that re-adds the jest types so
      // type-checking the specs doesn't fail; the app build is untouched.
      tsconfig: 'tsconfig.jest.json',
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^~/(.*)$': '<rootDir>/$1',
    '^vue$': 'vue/dist/vue.common.js'
  },
  moduleFileExtensions: [
    'ts',
    'js',
    'vue',
    'json'
  ],
  transform: {
    "^.+\\.ts$": "ts-jest",
    '^.+\\.js$': 'babel-jest',
    '.*\\.(vue)$': 'vue-jest'
  },
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/components/**/*.vue',
    '<rootDir>/pages/**/*.vue'
  ],
  testEnvironment: 'jsdom'
}
