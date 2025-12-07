import {createDefaultPreset} from 'ts-jest';

const tsJestPreset = createDefaultPreset();

const transform = {
    ...tsJestPreset.transform,
    '^.+\\.[jt]sx?$': ['ts-jest', {
        tsconfig: '<rootDir>/tsconfig.jest.json',
        useESM: true
    }]
};

const config = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts', '.tsx'],
    testMatch: ['<rootDir>/src/**/__tests__/**/*.[jt]s?(x)', '<rootDir>/src/**/*.(spec|test).[jt]s?(x)'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    transform
};

export default config;
