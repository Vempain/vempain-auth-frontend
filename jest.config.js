const config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/jest.setup.ts'],
    testMatch: ['<rootDir>/src/**/__tests__/**/*.[jt]s?(x)', '<rootDir>/src/**/*.(spec|test).[jt]s?(x)'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    transform: {
        '^.+\\.[jt]sx?$': ['ts-jest', {
            tsconfig: '<rootDir>/tsconfig.jest.json'
        }]
    }
};

export default config;
