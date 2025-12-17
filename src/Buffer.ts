import { NitroModules } from 'react-native-nitro-modules'
import type { NitroBuffer } from './NitroBuffer.nitro'

// Lazily load the native module
let _native: NitroBuffer | undefined

function getNative(): NitroBuffer {
    if (!_native) {
        _native = NitroModules.createHybridObject<NitroBuffer>('NitroBuffer')
    }
    return _native
}

export class Buffer extends Uint8Array {
    constructor(length: number)
    constructor(array: Uint8Array)
    constructor(arrayBuffer: ArrayBuffer, byteOffset?: number, length?: number)
    constructor(string: string, encoding?: string)
    constructor(arg: any, encodingOrOffset?: any, length?: any) {
        // Handling different constructor arguments roughly
        if (typeof arg === 'number') {
            super(arg)
        } else if (typeof arg === 'string') {
            const encoding = encodingOrOffset || 'utf8'
            const len = getNative().byteLength(arg, encoding)
            super(len)
            getNative().write(this.buffer as ArrayBuffer, arg, 0, len, encoding)
        } else if (arg instanceof Uint8Array) {
            super(arg)
        } else if (arg instanceof ArrayBuffer) {
            super(arg, encodingOrOffset, length)
        } else if (Object.prototype.toString.call(arg) === '[object ArrayBuffer]') {
            super(arg, encodingOrOffset, length)
        } else if (typeof arg === 'object' && arg !== null && arg.type === 'Buffer' && Array.isArray(arg.data)) {
            // Buffer.from({ type: 'Buffer', data: [...] })
            super(arg.data)
        } else {
            super(arg)
        }
    }

    get parent(): ArrayBuffer {
        return this.buffer as ArrayBuffer
    }

    static from(value: any, encodingOrOffset?: any, length?: any): Buffer {
        if (typeof value === 'string') {
            return new Buffer(value, encodingOrOffset)
        }
        if (value instanceof Uint8Array) {
            // Copy
            const buf = new Buffer(value.length)
            buf.set(value)
            return buf
        }
        if (value instanceof ArrayBuffer) {
            return new Buffer(value, encodingOrOffset, length)
        }
        if (Array.isArray(value)) {
            return new Buffer(new Uint8Array(value).buffer)
        }
        throw new TypeError('Unsupported type for Buffer.from')
    }

    static alloc(size: number, fill?: string | Buffer | number, encoding?: string): Buffer {
        // Fast path: use Uint8Array directly to avoid Buffer constructor overhead
        const buf = new Uint8Array(size) as unknown as Buffer
        Object.setPrototypeOf(buf, Buffer.prototype)

        if (fill !== undefined) {
            buf.fill(fill, encoding)
        }
        return buf
    }

    static allocUnsafe(size: number): Buffer {
        // In JS, memory is always zeroed for security, so allocUnsafe is same as alloc usually.
        // Unless we recycled buffers (not implemented).
        // Using native allocUnsafe might give uninitialized memory, but bridge overhead (~0.05ms) 
        // might outweight the zeroing cost (~0.02ms). 
        // So we stick to JS native alloc for now.
        const buf = new Uint8Array(size) as unknown as Buffer
        Object.setPrototypeOf(buf, Buffer.prototype)
        return buf
    }

    static allocUnsafeSlow(size: number): Buffer {
        return Buffer.allocUnsafe(size)
    }

    static byteLength(string: string, encoding: string = 'utf8'): number {
        return getNative().byteLength(string, encoding)
    }

    static isBuffer(obj: any): obj is Buffer {
        return obj instanceof Buffer
    }

    static compare(buf1: Uint8Array, buf2: Uint8Array): number {
        return getNative().compare(buf1.buffer as ArrayBuffer, buf1.byteOffset, buf1.byteLength, buf2.buffer as ArrayBuffer, buf2.byteOffset, buf2.byteLength)
    }

    static copyBytesFrom(view: ArrayBufferView, offset?: number, length?: number): Buffer {
        if (offset === undefined) offset = 0
        if (length === undefined) length = view.byteLength - offset
        if (offset < 0 || length < 0 || offset + length > view.byteLength) {
            throw new RangeError('offset or length out of bounds')
        }
        const buf = Buffer.allocUnsafe(length)
        const src = new Uint8Array(view.buffer, view.byteOffset + offset, length)
        buf.set(src)
        return buf
    }

    static concat(list: Uint8Array[], totalLength?: number): Buffer {
        if (totalLength === undefined) {
            totalLength = list.reduce((acc, curr) => acc + curr.length, 0)
        }
        const buf = Buffer.allocUnsafe(totalLength!)
        let offset = 0
        for (const item of list) {
            buf.set(item, offset)
            offset += item.length
        }
        return buf
    }

    write(string: string, offset?: number, length?: number, encoding?: string): number {
        // Argument handling
        if (offset === undefined) {
            offset = 0
            length = this.length
            encoding = 'utf8'
        } else if (length === undefined && typeof offset === 'string') {
            encoding = offset
            offset = 0
            length = this.length
        } else if (length === undefined) {
            length = this.length - offset
            encoding = 'utf8'
        } else if (encoding === undefined) {
            encoding = 'utf8'
        }

        return getNative().write(this.buffer as ArrayBuffer, string, this.byteOffset + (offset as number), length as number, encoding as string)
    }

    toString(encoding?: string, start?: number, end?: number): string {
        if (encoding === undefined) encoding = 'utf8'
        if (start === undefined) start = 0
        if (end === undefined) end = this.length

        if (start < 0) start = 0
        if (end > this.length) end = this.length
        if (start >= end) return ''

        return getNative().decode(this.buffer as ArrayBuffer, this.byteOffset + start, end - start, encoding)
    }

    indexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: string): number {
        if (typeof value === 'string') {
            const needle = Buffer.from(value, encoding)
            return getNative().indexOfBuffer(this.buffer as ArrayBuffer, needle.buffer as ArrayBuffer, byteOffset || 0, this.length)
        }
        if (value instanceof Uint8Array) {
            return getNative().indexOfBuffer(this.buffer as ArrayBuffer, value.buffer as ArrayBuffer, byteOffset || 0, this.length)
        }
        if (typeof value === 'number') {
            return getNative().indexOf(this.buffer as ArrayBuffer, value, byteOffset || 0, this.length)
        }
        throw new TypeError('"value" argument must be string, number or Buffer')
    }

    lastIndexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: string): number {
        // Node.js defaults byteOffset to buf.length - 1
        // If byteOffset is provided, it is the index to start searching backwards from.
        // We implement this by defining a window [0, limit] where limit is calculated.

        if (byteOffset === undefined || byteOffset > this.length) {
            byteOffset = this.length
        }

        if (typeof value === 'string') {
            const needle = Buffer.from(value, encoding)
            if (needle.length === 0) return -1
            // We search in [0, byteOffset + needle.length]. 
            // The match must start at <= byteOffset.
            // So the match must be fully contained in [0, byteOffset + needle.length].
            return getNative().lastIndexOfBuffer(this.buffer as ArrayBuffer, needle.buffer as ArrayBuffer, 0, byteOffset + needle.length)
        }
        if (value instanceof Uint8Array) {
            if (value.length === 0) return -1
            return getNative().lastIndexOfBuffer(this.buffer as ArrayBuffer, value.buffer as ArrayBuffer, 0, byteOffset + value.length)
        }
        if (typeof value === 'number') {
            // Search in [0, byteOffset + 1]. The last byte checked is at byteOffset.
            return getNative().lastIndexOfByte(this.buffer as ArrayBuffer, value, 0, byteOffset + 1)
        }
        throw new TypeError('"value" argument must be string, number or Buffer')
    }

    includes(value: string | number | Buffer, byteOffset?: number, encoding?: string): boolean {
        return this.indexOf(value, byteOffset, encoding) !== -1
    }

    fill(value: string | Buffer | number | Uint8Array, offset?: any, end?: any, encoding?: string): this {
        // Handle argument shifting
        if (typeof offset === 'string') {
            encoding = offset
            offset = 0
            end = this.length
        } else if (typeof end === 'string') {
            encoding = end
            end = this.length
        }

        if (offset === undefined) offset = 0
        if (end === undefined) end = this.length

        const len = end - offset
        if (len <= 0) return this

        if (typeof value === 'number') {
            getNative().fill(this.buffer as ArrayBuffer, value, this.byteOffset + offset, len)
            return this
        }

        let valBuf: Uint8Array
        if (typeof value === 'string') {
            valBuf = Buffer.from(value, encoding)
        } else if (value instanceof Uint8Array) {
            valBuf = value
        } else {
            throw new TypeError('"value" argument must be string, number or Buffer')
        }

        if (valBuf.length === 0) return this

        // Native fillBuffer takes ArrayBuffer, assumes generic fill logic
        getNative().fillBuffer(this.buffer as ArrayBuffer, valBuf.buffer as ArrayBuffer, this.byteOffset + offset, len)
        return this
    }

    compare(target: Uint8Array, targetStart?: number, targetEnd?: number, sourceStart?: number, sourceEnd?: number): number {
        if (targetStart === undefined) targetStart = 0
        if (targetEnd === undefined) targetEnd = target.length
        if (sourceStart === undefined) sourceStart = 0
        if (sourceEnd === undefined) sourceEnd = this.length

        return getNative().compare(
            this.buffer as ArrayBuffer, this.byteOffset + sourceStart, sourceEnd - sourceStart,
            target.buffer as ArrayBuffer, target.byteOffset + targetStart, targetEnd - targetStart
        )
    }

    slice(start?: number, end?: number): Buffer {
        // Uint8Array.prototype.slice returns a copy (new buffer).
        // Buffer.prototype.slice (legacy) returned a view.
        // Buffer.prototype.subarray returns a view.
        // In Node.js Buffer.slice is deprecated and acts like subarray? No, Buffer.slice returns a view (unlike Uint8Array.slice which returns copy).
        // Wait, Node Buffer.slice returns a NEW Buffer that references the SAME memory.
        // But Uint8Array.prototype.slice returns a COPY.
        // So we should override slice to return a view (subarray behavior) but wrapped in Buffer?
        // Actually Node documentation says: "The Buffer.prototype.slice() method is deprecated... use subarray() instead."
        // BUT for compatibility, often libs expect slice to duplicate memory? No, Buffer.slice(start, end) shares memory. 
        // Uint8Array.prototype.slice(start, end) copies memory.
        // So we should override slice to be compatible with Node behavior (view), OR standard Uint8Array behavior (copy).
        // Node's `slice` shares memory. `Uint8Array`'s `slice` copies. This is a conflict.
        // Let's implement `subarray` which returns a Buffer view.

        const sub = this.subarray(start, end)
        // sub is Uint8Array. We need to cast it to Buffer.
        // We can use Object.setPrototypeOf or just new Buffer via constructor that takes Uint8Array 
        // but that constructor usually copies?
        // `new Buffer(uint8Array)` copies.
        // We need `new Buffer(arrayBuffer, byteOffset, length)`.
        return new Buffer(sub.buffer as ArrayBuffer, sub.byteOffset, sub.byteLength)
    }

    subarray(begin?: number, end?: number): Buffer {
        const sub = super.subarray(begin, end)
        // Ensure we return a Buffer, not just a Uint8Array
        if (sub instanceof Buffer) return sub

        // Wrap the Uint8Array's memory view into a new Buffer
        // Note: new Buffer(arrayBuffer, byteOffset, length) creates a view
        return new Buffer(sub.buffer as ArrayBuffer, sub.byteOffset, sub.byteLength)
    }
    // ================== Read Methods ==================

    readInt8(offset: number = 0): number {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getInt8(offset)
    }

    readUInt8(offset: number = 0): number {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getUint8(offset)
    }

    readInt16LE(offset: number = 0): number {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getInt16(offset, true)
    }

    readInt16BE(offset: number = 0): number {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getInt16(offset, false)
    }

    readUInt16LE(offset: number = 0): number {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getUint16(offset, true)
    }

    readUInt16BE(offset: number = 0): number {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getUint16(offset, false)
    }

    readInt32LE(offset: number = 0): number {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getInt32(offset, true)
    }

    readInt32BE(offset: number = 0): number {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getInt32(offset, false)
    }

    readUInt32LE(offset: number = 0): number {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getUint32(offset, true)
    }

    readUInt32BE(offset: number = 0): number {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getUint32(offset, false)
    }

    readBigInt64LE(offset: number = 0): bigint {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getBigInt64(offset, true)
    }

    readBigInt64BE(offset: number = 0): bigint {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getBigInt64(offset, false)
    }

    readBigUInt64LE(offset: number = 0): bigint {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getBigUint64(offset, true)
    }

    readBigUInt64BE(offset: number = 0): bigint {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getBigUint64(offset, false)
    }

    readFloatLE(offset: number = 0): number {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getFloat32(offset, true)
    }

    readFloatBE(offset: number = 0): number {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getFloat32(offset, false)
    }

    readDoubleLE(offset: number = 0): number {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getFloat64(offset, true)
    }

    readDoubleBE(offset: number = 0): number {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getFloat64(offset, false)
    }

    readIntLE(offset: number, byteLength: number): number {
        if (offset === undefined) throw new TypeError('"offset" is invalid')
        if (byteLength > 6 || byteLength < 0) throw new RangeError('"byteLength" out of range')

        offset = offset >>> 0
        byteLength = byteLength >>> 0

        let val = this[offset]
        let mul = 1
        let i = 0
        while (++i < byteLength && (mul *= 0x100)) {
            val += this[offset + i] * mul
        }
        mul *= 0x80
        if (val >= mul) val -= Math.pow(2, 8 * byteLength)
        return val
    }

    readIntBE(offset: number, byteLength: number): number {
        if (offset === undefined) throw new TypeError('"offset" is invalid')
        if (byteLength > 6 || byteLength < 0) throw new RangeError('"byteLength" out of range')

        offset = offset >>> 0
        byteLength = byteLength >>> 0

        let i = byteLength
        let mul = 1
        let val = this[offset + --i]
        while (i > 0 && (mul *= 0x100)) {
            val += this[offset + --i] * mul
        }
        mul *= 0x80
        if (val >= mul) val -= Math.pow(2, 8 * byteLength)
        return val
    }

    readUIntLE(offset: number, byteLength: number): number {
        if (offset === undefined) throw new TypeError('"offset" is invalid')
        if (byteLength > 6 || byteLength < 0) throw new RangeError('"byteLength" out of range')

        offset = offset >>> 0
        byteLength = byteLength >>> 0

        let val = this[offset]
        let mul = 1
        let i = 0
        while (++i < byteLength && (mul *= 0x100)) {
            val += this[offset + i] * mul
        }
        return val
    }

    readUIntBE(offset: number, byteLength: number): number {
        if (offset === undefined) throw new TypeError('"offset" is invalid')
        if (byteLength > 6 || byteLength < 0) throw new RangeError('"byteLength" out of range')

        offset = offset >>> 0
        byteLength = byteLength >>> 0

        let i = byteLength
        let mul = 1
        let val = this[offset + --i]
        while (i > 0 && (mul *= 0x100)) {
            val += this[offset + --i] * mul
        }
        return val
    }
    // ================== Write Methods ==================

    writeInt8(value: number, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setInt8(offset, value)
        return offset + 1
    }

    writeUInt8(value: number, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setUint8(offset, value)
        return offset + 1
    }

    writeInt16LE(value: number, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setInt16(offset, value, true)
        return offset + 2
    }

    writeInt16BE(value: number, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setInt16(offset, value, false)
        return offset + 2
    }

    writeUInt16LE(value: number, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setUint16(offset, value, true)
        return offset + 2
    }

    writeUInt16BE(value: number, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setUint16(offset, value, false)
        return offset + 2
    }

    writeInt32LE(value: number, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setInt32(offset, value, true)
        return offset + 4
    }

    writeInt32BE(value: number, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setInt32(offset, value, false)
        return offset + 4
    }

    writeUInt32LE(value: number, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setUint32(offset, value, true)
        return offset + 4
    }

    writeUInt32BE(value: number, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setUint32(offset, value, false)
        return offset + 4
    }

    writeBigInt64LE(value: bigint, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setBigInt64(offset, value, true)
        return offset + 8
    }

    writeBigInt64BE(value: bigint, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setBigInt64(offset, value, false)
        return offset + 8
    }

    writeBigUInt64LE(value: bigint, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setBigUint64(offset, value, true)
        return offset + 8
    }

    writeBigUInt64BE(value: bigint, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setBigUint64(offset, value, false)
        return offset + 8
    }

    writeFloatLE(value: number, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setFloat32(offset, value, true)
        return offset + 4
    }

    writeFloatBE(value: number, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setFloat32(offset, value, false)
        return offset + 4
    }

    writeDoubleLE(value: number, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setFloat64(offset, value, true)
        return offset + 8
    }

    writeDoubleBE(value: number, offset: number = 0): number {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setFloat64(offset, value, false)
        return offset + 8
    }

    writeIntLE(value: number, offset: number, byteLength: number): number {
        if (offset === undefined) throw new TypeError('"offset" is invalid')
        if (byteLength > 6 || byteLength < 0) throw new RangeError('"byteLength" out of range')

        offset = offset >>> 0
        byteLength = byteLength >>> 0

        let i = 0
        let mul = 1
        let sub = 0
        this[offset] = value & 0xFF
        while (++i < byteLength && (mul *= 0x100)) {
            if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
                sub = 1
            }
            this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
        }
        return offset + byteLength
    }

    writeIntBE(value: number, offset: number, byteLength: number): number {
        if (offset === undefined) throw new TypeError('"offset" is invalid')
        if (byteLength > 6 || byteLength < 0) throw new RangeError('"byteLength" out of range')

        offset = offset >>> 0
        byteLength = byteLength >>> 0

        let i = byteLength - 1
        let mul = 1
        let sub = 0
        this[offset + i] = value & 0xFF
        while (--i >= 0 && (mul *= 0x100)) {
            if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
                sub = 1
            }
            this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
        }
        return offset + byteLength
    }

    writeUIntLE(value: number, offset: number, byteLength: number): number {
        if (offset === undefined) throw new TypeError('"offset" is invalid')
        if (byteLength > 6 || byteLength < 0) throw new RangeError('"byteLength" out of range')

        offset = offset >>> 0
        byteLength = byteLength >>> 0

        let i = 0
        let mul = 1
        this[offset] = value & 0xFF
        while (++i < byteLength && (mul *= 0x100)) {
            this[offset + i] = (value / mul) & 0xFF
        }
        return offset + byteLength
    }

    writeUIntBE(value: number, offset: number, byteLength: number): number {
        if (offset === undefined) throw new TypeError('"offset" is invalid')
        if (byteLength > 6 || byteLength < 0) throw new RangeError('"byteLength" out of range')

        offset = offset >>> 0
        byteLength = byteLength >>> 0

        let i = byteLength - 1
        let mul = 1
        this[offset + i] = value & 0xFF
        while (--i >= 0 && (mul *= 0x100)) {
            this[offset + i] = (value / mul) & 0xFF
        }
        return offset + byteLength
    }
    // ================== Utils ==================
    toJSON(): { type: 'Buffer', data: number[] } {
        return {
            type: 'Buffer',
            data: Array.from(this)
        }
    }

    static poolSize: number = 8192

    static isEncoding(encoding: string): boolean {
        switch (encoding.toLowerCase()) {
            case 'utf8':
            case 'utf-8':
            case 'hex':
            case 'base64':
            case 'binary':
            case 'latin1':
            case 'ascii':
            case 'utf16le':
            case 'ucs2':
                return true
            default:
                return false
        }
    }

    swap16(): Buffer {
        const len = this.length
        if (len % 2 !== 0) throw new RangeError('Buffer size must be a multiple of 16-bits')
        for (let i = 0; i < len; i += 2) {
            const v = this[i]
            this[i] = this[i + 1]
            this[i + 1] = v
        }
        return this
    }

    swap32(): Buffer {
        const len = this.length
        if (len % 4 !== 0) throw new RangeError('Buffer size must be a multiple of 32-bits')
        for (let i = 0; i < len; i += 4) {
            const v0 = this[i]; const v1 = this[i + 1]; const v2 = this[i + 2]; const v3 = this[i + 3];
            this[i] = v3; this[i + 1] = v2; this[i + 2] = v1; this[i + 3] = v0;
        }
        return this
    }

    swap64(): Buffer {
        const len = this.length
        if (len % 8 !== 0) throw new RangeError('Buffer size must be a multiple of 64-bits')
        for (let i = 0; i < len; i += 8) {
            const v0 = this[i]; const v1 = this[i + 1]; const v2 = this[i + 2]; const v3 = this[i + 3];
            const v4 = this[i + 4]; const v5 = this[i + 5]; const v6 = this[i + 6]; const v7 = this[i + 7];
            this[i] = v7; this[i + 1] = v6; this[i + 2] = v5; this[i + 3] = v4;
            this[i + 4] = v3; this[i + 5] = v2; this[i + 6] = v1; this[i + 7] = v0;
        }
        return this
    }

    copy(target: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number {
        if (!target) throw new TypeError('argument must be a Buffer')
        if (targetStart === undefined) targetStart = 0
        if (sourceStart === undefined) sourceStart = 0
        if (sourceEnd === undefined) sourceEnd = this.length

        if (targetStart >= target.length) return 0
        if (sourceStart >= sourceEnd) return 0

        if (sourceStart < 0) sourceStart = 0
        if (sourceEnd > this.length) sourceEnd = this.length
        if (targetStart < 0) targetStart = 0

        let len = sourceEnd - sourceStart
        if (target.length - targetStart < len) {
            len = target.length - targetStart
        }

        target.set(this.subarray(sourceStart, sourceStart + len), targetStart)
        return len
    }
}

