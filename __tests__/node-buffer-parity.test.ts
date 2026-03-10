import { Buffer as NodeBuffer } from 'node:buffer'

jest.mock('react-native-nitro-modules')

import { Buffer } from '../src'

type MutableBuffer = InstanceType<typeof Buffer> | InstanceType<typeof NodeBuffer>

const toBytes = (value: Uint8Array) => Array.from(value)
const normalizeResult = (value: unknown) => value instanceof Uint8Array ? toBytes(value) : value

const expectMutationParity = (
    makeNitro: () => MutableBuffer,
    makeNode: () => MutableBuffer,
    mutate: (buffer: MutableBuffer) => unknown
) => {
    const nitro = makeNitro()
    const node = makeNode()

    const nitroResult = mutate(nitro)
    const nodeResult = mutate(node)

    expect(normalizeResult(nitroResult)).toEqual(normalizeResult(nodeResult))
    expect(toBytes(nitro)).toEqual(toBytes(node))
}

describe('Node Buffer parity derived from official test-buffer-* cases', () => {
    it('matches test-buffer-of-no-deprecation.js for Buffer.of', () => {
        expect(toBytes((Buffer as typeof Buffer & { of: (...items: number[]) => Buffer }).of(0, 1, 255))).toEqual(
            toBytes(NodeBuffer.of(0, 1, 255))
        )
    })

    it('matches test-buffer-from.js for typed array element copying', () => {
        const typed = new Uint32Array(4).fill(42)

        expect(toBytes(Buffer.from(typed as any))).toEqual(toBytes(NodeBuffer.from(typed)))
    })

    it('matches test-buffer-arraybuffer.js for shared ArrayBuffer views', () => {
        const array = new Uint8Array([1, 2, 3, 4, 5])
        const nitro = Buffer.from(array.buffer, 1, 3)
        const node = NodeBuffer.from(array.buffer, 1, 3)

        nitro[0] = 9

        expect(nitro.parent).toBe(array.buffer)
        expect(node.parent).toBe(array.buffer)
        expect(toBytes(nitro)).toEqual(toBytes(node))
        expect(array[1]).toBe(9)
    })

    it('matches test-buffer-bytelength.js for strings and binary views', () => {
        const view = new Uint16Array(8)
        const dataView = new DataView(new ArrayBuffer(2))

        expect(Buffer.byteLength('∑éllö wørl∂!', 'utf-8')).toBe(NodeBuffer.byteLength('∑éllö wørl∂!', 'utf-8'))
        expect(Buffer.byteLength('Il était tué', 'latin1')).toBe(NodeBuffer.byteLength('Il était tué', 'latin1'))
        expect(Buffer.byteLength('aGVsbG8gd29ybGQ=', 'base64')).toBe(NodeBuffer.byteLength('aGVsbG8gd29ybGQ=', 'base64'))
        expect((Buffer as any).byteLength(view)).toBe(NodeBuffer.byteLength(view))
        expect((Buffer as any).byteLength(dataView)).toBe(NodeBuffer.byteLength(dataView))
    })

    it('matches test-buffer-concat.js for truncation, zero-fill tail and Uint8Array input', () => {
        const random = Uint8Array.from([1, 2, 3, 4])

        expect(toBytes(Buffer.concat([]))).toEqual(toBytes(NodeBuffer.concat([])))
        expect(toBytes(Buffer.concat([Buffer.from('asdf')]))).toEqual(toBytes(NodeBuffer.concat([NodeBuffer.from('asdf')])))
        expect(toBytes(Buffer.concat([Buffer.from(random), Buffer.from(random)], 6))).toEqual(
            toBytes(NodeBuffer.concat([NodeBuffer.from(random), NodeBuffer.from(random)], 6))
        )
        expect(toBytes(Buffer.concat([Buffer.from(random)], 8))).toEqual(
            toBytes(NodeBuffer.concat([NodeBuffer.from(random)], 8))
        )
        expect(toBytes(Buffer.concat([Uint8Array.from([0x41, 0x42]), Uint8Array.from([0x43, 0x44])] as Uint8Array[]))).toEqual(
            toBytes(NodeBuffer.concat([Uint8Array.from([0x41, 0x42]), Uint8Array.from([0x43, 0x44])]))
        )
    })

    it('matches test-buffer-copy.js for truncation and Uint8Array targets', () => {
        const makeSource = () => Uint8Array.from({ length: 16 }, (_, index) => index + 1)
        const nitroSource = Buffer.from(makeSource())
        const nodeSource = NodeBuffer.from(makeSource())
        const nitroTarget = Buffer.alloc(6)
        const nodeTarget = NodeBuffer.alloc(6)

        expect(nitroSource.copy(nitroTarget, 0, 4, 20)).toBe(nodeSource.copy(nodeTarget, 0, 4, 20))
        expect(toBytes(nitroTarget)).toEqual(toBytes(nodeTarget))

        const nitroUint8Target = new Uint8Array(6)
        const nodeUint8Target = new Uint8Array(6)

        expect(nitroSource.copy(nitroUint8Target, 0, 2, 8)).toBe(nodeSource.copy(nodeUint8Target, 0, 2, 8))
        expect(toBytes(nitroUint8Target)).toEqual(toBytes(nodeUint8Target))
    })

    it('matches test-buffer-fill.js for number and string patterns', () => {
        expectMutationParity(
            () => Buffer.alloc(10),
            () => NodeBuffer.alloc(10),
            (buffer) => buffer.fill(0xaa)
        )

        expectMutationParity(
            () => Buffer.alloc(12),
            () => NodeBuffer.alloc(12),
            (buffer) => buffer.fill('abc', 2, 11, 'utf8')
        )
    })

    it('matches test-buffer-compare.js and search cases from test-buffer-indexof.js', () => {
        const nitro = Buffer.from('bananas')
        const node = NodeBuffer.from('bananas')

        expect(Buffer.compare(Buffer.from('abc'), Buffer.from('abd'))).toBe(NodeBuffer.compare(NodeBuffer.from('abc'), NodeBuffer.from('abd')))
        expect(nitro.compare(Buffer.from('banana'), 0, 6, 0, 6)).toBe(node.compare(NodeBuffer.from('banana'), 0, 6, 0, 6))
        expect(nitro.indexOf('na')).toBe(node.indexOf('na'))
        expect(nitro.indexOf(Buffer.from('anas'))).toBe(node.indexOf(NodeBuffer.from('anas')))
        expect(nitro.lastIndexOf('na')).toBe(node.lastIndexOf('na'))
        expect(nitro.includes(0x62)).toBe(node.includes(0x62))
    })

    it('matches test-buffer-write.js and test-buffer-tostring.js for common encodings', () => {
        const encodings = [
            { encoding: 'utf8', input: 'foo' },
            { encoding: 'ascii', input: 'foo' },
            { encoding: 'latin1', input: 'foo' },
            { encoding: 'hex', input: '666f6f' },
            { encoding: 'base64', input: 'Zm9v' }
        ] as const

        for (const { encoding, input } of encodings) {
            const nitro = Buffer.alloc(9)
            const node = NodeBuffer.alloc(9)
            const nitroLength = Buffer.byteLength(input, encoding)
            const nodeLength = NodeBuffer.byteLength(input, encoding)

            expect(nitro.write(input, 0, nitroLength, encoding)).toBe(node.write(input, 0, nodeLength, encoding))
            expect(toBytes(nitro)).toEqual(toBytes(node))
            expect(nitro.subarray(0, nitroLength).toString(encoding)).toBe(node.subarray(0, nodeLength).toString(encoding))
        }
    })

    it('matches official read and write integer cases', () => {
        expectMutationParity(
            () => Buffer.alloc(8),
            () => NodeBuffer.alloc(8),
            (buffer) => {
                buffer.writeInt16BE(-1679, 0)
                buffer.writeUInt16LE(0xff80, 2)
                buffer.writeInt32LE(-805306713, 4)
                return [
                    buffer.readInt16BE(0),
                    buffer.readUInt16LE(2),
                    buffer.readInt32LE(4)
                ]
            }
        )

        expectMutationParity(
            () => Buffer.alloc(6),
            () => NodeBuffer.alloc(6),
            (buffer) => {
                buffer.writeUIntBE(0x1234567890ab, 0, 6)
                return buffer.readUIntBE(0, 6)
            }
        )
    })

    it('matches test-buffer-slice.js, test-buffer-swap.js, test-buffer-tojson.js and inspect output', () => {
        const nitro = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])
        const node = NodeBuffer.from([1, 2, 3, 4, 5, 6, 7, 8])
        const nitroSlice = nitro.slice(2, 6)
        const nodeSlice = node.slice(2, 6)

        nitroSlice.swap32()
        nodeSlice.swap32()

        expect(toBytes(nitro)).toEqual(toBytes(node))
        expect(nitro.toJSON()).toEqual(node.toJSON())
        expect(nitro.inspect()).toBe(node.inspect())
    })

    it('matches test-buffer-from.js for copyBytesFrom', () => {
        const typed = new Uint16Array([0, 0xffff])

        expect(toBytes(Buffer.copyBytesFrom(typed, 1, 5))).toEqual(toBytes(NodeBuffer.copyBytesFrom(typed, 1, 5)))
    })
})
