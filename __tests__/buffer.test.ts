import { Buffer as NodeBuffer } from 'node:buffer'

jest.mock('react-native-nitro-modules')

import { Buffer } from '../src'

describe('Buffer compatibility', () => {
    it('supports README string encoding examples for hex and base64', () => {
        const hello = Buffer.from('Hello World')

        expect(hello.toString('hex')).toBe(NodeBuffer.from('Hello World').toString('hex'))
        expect(hello.toString('base64')).toBe(NodeBuffer.from('Hello World').toString('base64'))
        expect(Buffer.from(hello.toString('base64'), 'base64').toString()).toBe('Hello World')
        expect(Buffer.from('aGVsbG8gd29ybGQ', 'base64url' as any).toString()).toBe('hello world')
        expect(Buffer.from('foo', 'utf16le' as any).toString('hex')).toBe('66006f006f00')
    })

    it('matches Node byteLength for utf8 and base64 payloads', () => {
        expect(Buffer.byteLength('你好', 'utf8')).toBe(NodeBuffer.byteLength('你好', 'utf8'))
        expect(Buffer.byteLength('SGVsbG8=', 'base64')).toBe(NodeBuffer.byteLength('SGVsbG8=', 'base64'))
    })

    it('alloc fills repeated string patterns', () => {
        const filled = Buffer.alloc(6, 'ab')

        expect(Array.from(filled)).toEqual(Array.from(NodeBuffer.alloc(6, 'ab')))
    })

    it('concats buffers with an explicit totalLength like Node Buffer', () => {
        const result = Buffer.concat([Buffer.from([1, 2]), Buffer.from([3, 4])], 3)

        expect(Array.from(result)).toEqual([1, 2, 3])
    })

    it('searches and compares values consistently', () => {
        const source = Buffer.from('bananas')

        expect(source.indexOf('na')).toBe(2)
        expect(source.lastIndexOf('na')).toBe(4)
        expect(source.includes(Buffer.from('anas'))).toBe(true)
        expect(Buffer.compare(Buffer.from('abc'), Buffer.from('abd'))).toBeLessThan(0)
        expect(Buffer.from('abc').equals(Buffer.from('abc'))).toBe(true)
    })

    it('slice and subarray share underlying memory', () => {
        const source = Buffer.from([1, 2, 3, 4])
        const sliced = source.slice(1, 3)
        const viewed = source.subarray(2)

        sliced[0] = 99
        viewed[0] = 88

        expect(Array.from(source)).toEqual([1, 99, 88, 4])
    })

    it('writes and reads string segments with offsets', () => {
        const buffer = Buffer.alloc(6)
        const written = buffer.write('hello', 1, 3, 'utf8')

        expect(written).toBe(3)
        expect(buffer.toString('utf8', 1, 4)).toBe('hel')
        expect(Array.from(buffer)).toEqual(Array.from(NodeBuffer.from([0, 104, 101, 108, 0, 0])))
    })

    it('fills numeric and string ranges', () => {
        const numeric = Buffer.alloc(4)
        const patterned = Buffer.alloc(5)

        numeric.fill(0xaa)
        patterned.fill('ab', 1, 5)

        expect(Array.from(numeric)).toEqual([0xaa, 0xaa, 0xaa, 0xaa])
        expect(Array.from(patterned)).toEqual([0, 97, 98, 97, 98])
    })

    it('copies, serializes and rehydrates through JSON', () => {
        const source = Buffer.from([9, 8, 7, 6])
        const target = Buffer.alloc(3)

        const copied = source.copy(target, 0, 1, 4)
        const json = source.toJSON()

        expect(copied).toBe(3)
        expect(Array.from(target)).toEqual([8, 7, 6])
        expect(json).toEqual({ type: 'Buffer', data: [9, 8, 7, 6] })
        expect(Array.from(Buffer.from(json))).toEqual([9, 8, 7, 6])
    })

    it('exposes numeric read and write helpers', () => {
        const buffer = Buffer.alloc(16)

        buffer.writeUInt16LE(0x1234, 0)
        buffer.writeUInt32BE(0x12345678, 2)
        buffer.writeDoubleLE(Math.PI, 6)

        expect(buffer.readUInt16LE(0)).toBe(0x1234)
        expect(buffer.readUInt32BE(2)).toBe(0x12345678)
        expect(buffer.readDoubleLE(6)).toBeCloseTo(Math.PI, 10)
    })

    it('guards copyBytesFrom boundaries', () => {
        expect(Array.from(Buffer.copyBytesFrom(new Uint8Array([1, 2, 3]), 2, 2))).toEqual(
            Array.from(NodeBuffer.copyBytesFrom(new Uint8Array([1, 2, 3]), 2, 2))
        )
    })

    it('supports byte order swap helpers', () => {
        expect(Array.from(Buffer.from([0x12, 0x34]).swap16())).toEqual([0x34, 0x12])
        expect(Array.from(Buffer.from([0x12, 0x34, 0x56, 0x78]).swap32())).toEqual([0x78, 0x56, 0x34, 0x12])
        expect(Array.from(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]).swap64())).toEqual([8, 7, 6, 5, 4, 3, 2, 1])
        expect(() => Buffer.from([1, 2, 3]).swap16()).toThrow(RangeError)
    })

    it('keeps Buffer specific runtime traits', () => {
        const buffer = Buffer.from([1, 2, 3])

        expect(buffer).toBeInstanceOf(Uint8Array)
        expect(Buffer.isBuffer(buffer)).toBe(true)
        expect(Buffer.isBuffer(new Uint8Array([1, 2, 3]))).toBe(false)
        expect(Buffer.isEncoding('ascii')).toBe(true)
        expect(Buffer.isEncoding('base64url')).toBe(true)
        expect(Buffer.isEncoding('utf-16le')).toBe(true)
        expect(buffer.inspect()).toBe('<Buffer 01 02 03>')
    })
})
