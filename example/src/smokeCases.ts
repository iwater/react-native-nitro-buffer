import { Buffer } from 'react-native-nitro-buffer'

type SmokeCaseDefinition = {
    id: string
    description: string
    expected: unknown
    run: () => unknown
}

export type SmokeCaseResult = {
    id: string
    description: string
    expected: string
    actual: string
    pass: boolean
    error?: string
}

const serializeValue = (value: unknown): string => {
    if (typeof value === 'string') {
        return JSON.stringify(value)
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value)
    }
    if (value === null) {
        return 'null'
    }
    if (value === undefined) {
        return 'undefined'
    }
    return JSON.stringify(value)
}

const smokeCases: readonly SmokeCaseDefinition[] = [
    {
        id: 'utf8-roundtrip',
        description: 'UTF-8 strings should round-trip through the native Nitro implementation.',
        expected: 'Hello Buffer World',
        run: () => Buffer.from('Hello Buffer World').toString('utf8'),
    },
    {
        id: 'base64-roundtrip',
        description: 'Base64 encoding should match Node Buffer semantics.',
        expected: 'SGVsbG8gV29ybGQ=',
        run: () => Buffer.from('Hello World').toString('base64'),
    },
    {
        id: 'hex-decode',
        description: 'Hex input should decode back to the original UTF-8 string.',
        expected: 'Hello',
        run: () => Buffer.from('48656c6c6f', 'hex').toString('utf8'),
    },
    {
        id: 'typed-array-from',
        description: 'Buffer.from(TypedArray) should copy elements, not raw bytes.',
        expected: [42, 42, 42, 42],
        run: () => Array.from(Buffer.from(new Uint32Array(4).fill(42) as any)),
    },
    {
        id: 'concat-truncation',
        description: 'Buffer.concat(list, totalLength) should truncate extra bytes like Node.',
        expected: [65, 66, 67, 68, 69, 70],
        run: () => Array.from(Buffer.concat([Buffer.from('ABCD'), Buffer.from('EFGH')], 6)),
    },
    {
        id: 'copyBytesFrom',
        description: 'copyBytesFrom should treat offset and length as element counts.',
        expected: [255, 255],
        run: () => Array.from(Buffer.copyBytesFrom(new Uint16Array([0, 0xffff]), 1, 5)),
    },
    {
        id: 'byteLength-dataview',
        description: 'byteLength(DataView) should use the view byteLength directly.',
        expected: 3,
        run: () => Buffer.byteLength(new DataView(new Uint8Array([1, 2, 3]).buffer) as any),
    },
    {
        id: 'lastIndexOf',
        description: 'lastIndexOf should search the same window as Node Buffer.',
        expected: 4,
        run: () => Buffer.from('bananas').lastIndexOf('na'),
    },
    {
        id: 'ascii-high-bit',
        description: 'ASCII decoding should follow Node semantics for bytes above 0x7f.',
        expected: 'Hi\u0000\u007f!',
        run: () => Buffer.from([0x48, 0x69, 0x80, 0xff, 0x21]).toString('ascii'),
    },
    {
        id: 'isEncoding-base64url',
        description: 'Buffer.isEncoding("base64url") should return true.',
        expected: true,
        run: () => (Buffer as typeof Buffer & { isEncoding(encoding: string): boolean }).isEncoding('base64url'),
    },
    {
        id: 'base64url-decode',
        description: 'base64url input should decode to the same text as Node Buffer.',
        expected: 'hello world',
        run: () => Buffer.from('aGVsbG8gd29ybGQ', 'base64url' as any).toString('utf8'),
    },
    {
        id: 'utf16le-encode',
        description: 'utf16le writes should match the Node Buffer byte layout.',
        expected: '66006f006f00',
        run: () => Buffer.from('foo', 'utf16le' as any).toString('hex'),
    },
]

export const runSmokeCases = (): SmokeCaseResult[] => {
    return smokeCases.map((smokeCase) => {
        const expected = serializeValue(smokeCase.expected)

        try {
            const actualValue = smokeCase.run()
            const actual = serializeValue(actualValue)

            return {
                id: smokeCase.id,
                description: smokeCase.description,
                expected,
                actual,
                pass: actual === expected,
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)

            return {
                id: smokeCase.id,
                description: smokeCase.description,
                expected,
                actual: `ERROR: ${message}`,
                pass: false,
                error: message,
            }
        }
    })
}
