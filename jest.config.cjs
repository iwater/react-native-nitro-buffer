module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/__tests__'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    moduleNameMapper: {
        '^react-native-nitro-modules$': '<rootDir>/__mocks__/react-native-nitro-modules.ts'
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
    }
}
