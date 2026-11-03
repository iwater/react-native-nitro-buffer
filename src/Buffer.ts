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

// ── Unknown encoding rejection (issue #3) ──────────────────────────────────
// Node's `ERR_UNKNOWN_ENCODING` is a `TypeError` with an own `code` property.
// The message preserves the caller's verbatim argument (e.g. `NOPE` is not lowercased).
// Consumers branch on `err.code === 'ERR_UNKNOWN_ENCODING'` (including `assert.throws(fn, { code })`),
// so throwing a plain TypeError is not sufficient.
//
// ⚠️ Validation rules differ across entry points and cannot be unified into a single switch:
//   · `Buffer.from(str, enc)`: Validates against the table only when enc is a non-empty string
//     (Node's `fromString` explicitly checks `encoding.length !== 0`); non-strings are ignored -> utf8.
//   · `toString` / `indexOf` / `lastIndexOf`: Follows `getEncoding` semantics — empty string is also treated as unknown.
//   · `write`: Empty string and `null` default to utf8; other unknown values throw.
//   · `byteLength` / `isEncoding`: Never throw (Node treats unknown encodings as utf8 for length calculation).
function throwUnknownEncoding(enc: any): never {
    const error: any = new TypeError(`Unknown encoding: ${enc}`)
    error.code = 'ERR_UNKNOWN_ENCODING'
    throw error
}

export class Buffer extends Uint8Array {
    static poolSize = 8192

    constructor(length: number)
    constructor(array: Uint8Array)
    constructor(arrayBuffer: ArrayBuffer, byteOffset?: number, length?: number)
    constructor(string: string, encoding?: string)
    constructor(arg: any, encodingOrOffset?: any, length?: any) {
        // Handling different constructor arguments roughly
        if (typeof arg === 'number') {
            super(arg)
        } else if (typeof arg === 'string') {
            // issue #3: Node's `fromString` validates the table only when encoding is a non-empty string;
            // non-strings (`Buffer.from('abc', 5)`) and empty strings are ignored -> default to utf8.
            // Previously `encodingOrOffset || 'utf8'` passed 5 to `_normalizeEncoding`
            // -> `5.toLowerCase is not a function` (Node accepts it and defaults to utf8).
            let encoding: string
            if (typeof encodingOrOffset === 'string' && encodingOrOffset.length !== 0) {
                if (!Buffer.isEncoding(encodingOrOffset)) throwUnknownEncoding(encodingOrOffset)
                encoding = Buffer._normalizeEncoding(encodingOrOffset)
            } else {
                encoding = 'utf8'
            }
            // ⚠️ Use `Buffer.byteLength` instead of native `byteLength`: the predicted size for `hex` /
            // `base64` / `base64url` is calculated from the JS string length (UTF-16 code units),
            // which is only known on the JS side (see comments in `byteLength`).
            const len = Buffer.byteLength(arg, encoding)
            super(len)
            const written = getNative().write(this.buffer as ArrayBuffer, arg, 0, len, encoding)
            // ⚠️ Node's `Buffer.from(str, enc).length` is the actual number of decoded bytes, whereas
            // `byteLength()` is only an estimated prediction — they can diverge for `hex` / `base64`.
            // In Node v22.12.0:
            //   `Buffer.byteLength('Y W J j','base64')` = 5, but
            //   `Buffer.from('Y W J j','base64').length`  = 3
            //   `Buffer.byteLength('61zz','hex')`       = 2, but
            //   `Buffer.from('61zz','hex').length`      = 1
            // A Uint8Array cannot change length after `super(len)`, so we allocate and return an exact-sized
            // Buffer matching actual written bytes (returning an object from a constructor is valid in JS).
            if (written < len) {
                const exact = Buffer.allocUnsafe(written)
                exact.set(this.subarray(0, written))
                return exact
            }
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
        if (typeof value === 'object' && value !== null && value.type === 'Buffer' && Array.isArray(value.data)) {
            return new Buffer(value.data)
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

    static byteLength(string: string | ArrayBuffer | ArrayBufferView, encoding: string = 'utf8'): number {
        // Node's `byteLength` accepts 4 types of arguments: string / Buffer / TypedArray / ArrayBuffer.
        // Previously only string was accepted, causing the native layer to throw `Value is an object, expected a String`.
        // This broke packages like got@11 which calls `Buffer.byteLength(chunk)` inside an async iterator loop.
        if (typeof string !== 'string') {
            if (string instanceof ArrayBuffer) return string.byteLength
            if (typeof SharedArrayBuffer !== 'undefined' && string instanceof SharedArrayBuffer) {
                return (string as any).byteLength
            }
            if (ArrayBuffer.isView(string)) return (string as ArrayBufferView).byteLength
            const error: any = new TypeError(
                'The "string" argument must be of type string or an instance of Buffer or ArrayBuffer'
            )
            error.code = 'ERR_INVALID_ARG_TYPE'
            throw error
        }
        // Node's `byteLength` never throws on any encoding: non-strings (null / 5 / true / {})
        // and unknown strings are all counted as utf8 (in Node v22.11.0, all return `string.length`).
        // Previously, passing a non-string directly to `_normalizeEncoding` caused `null.toLowerCase` to crash.
        const enc = Buffer._normalizeEncoding(typeof encoding === 'string' ? encoding : 'utf8')
        // ⚠️ In Node, `byteLength` for `hex` / `base64` / `base64url` is an estimate calculated from
        // JS string length (UTF-16 code units), NOT from the actual decoded byte count.
        // Tested against Node v22.12.0:
        //   `hex`                = `len >>> 1`
        //   `base64`/`base64url` = `floor((len - min(trailing '=' count, 2)) * 3 / 4)`
        // E.g.: `byteLength('中文','hex')`      = 1 (not 3)
        //       `byteLength('Y W J j','base64')` = 5 (whereas `Buffer.from('Y W J j','base64').length` is 3)
        // The native side only receives UTF-8 bytes and cannot see JS string length, so this must be computed in JS.
        // (The actual length for `Buffer.from` is truncated based on actual bytes written; see constructor).
        if (enc === 'hex') return string.length >>> 1
        if (enc === 'base64' || enc === 'base64url') {
            let pad = 0
            for (let i = string.length - 1; i >= 0 && pad < 2 && string.charCodeAt(i) === 0x3d; i--) pad++
            return Math.floor((string.length - pad) * 3 / 4)
        }
        return getNative().byteLength(string, enc)
    }

    static isBuffer(obj: any): obj is Buffer {
        return obj instanceof Buffer
    }

    static compare(buf1: Uint8Array, buf2: Uint8Array): number {
        return getNative().compare(buf1.buffer as ArrayBuffer, buf1.byteOffset, buf1.byteLength, buf2.buffer as ArrayBuffer, buf2.byteOffset, buf2.byteLength)
    }

    equals(otherBuffer: Uint8Array): boolean {
        if (!Buffer.isBuffer(otherBuffer)) throw new TypeError('Argument must be a Buffer')
        if (this === otherBuffer) return true
        return Buffer.compare(this, otherBuffer) === 0
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

        // issue #3: In `write`, empty string and `null` default to utf8 (Node does not throw on
        // `write('a','')` or `write('a',0,1,null)`); only other unknown values throw (`5` / `true` / `'nope'`).
        let enc: any = encoding
        if (enc === undefined || enc === null || enc === '') {
            enc = 'utf8'
        } else {
            if (!Buffer.isEncoding(enc)) throwUnknownEncoding(enc)
            enc = Buffer._normalizeEncoding(enc)
        }

        return getNative().write(this.buffer as ArrayBuffer, string, this.byteOffset + (offset as number), length as number, enc)
    }

    toString(encoding?: string, start?: number, end?: number): string {
        if (start === undefined) start = 0
        if (end === undefined) end = this.length

        if (start < 0) start = 0
        if (end > this.length) end = this.length
        if (start >= end) return ''

        if (encoding === undefined) encoding = 'utf8'
        // issue #3: `toString` follows Node's `getEncoding`, where empty string is also treated as unknown
        // (`buf.toString('')` throws `Unknown encoding: `); non-strings also throw using their String value.
        // ⚠️ Validation must occur after the empty range early-return above: Node normalizes start/end first,
        // returning `''` immediately for an empty buffer or empty slice before checking encoding.
        // Thus `Buffer.alloc(0).toString('nope')` returns `''` in Node rather than throwing.
        else if (!Buffer.isEncoding(encoding)) throwUnknownEncoding(encoding)

        return getNative().decode(this.buffer as ArrayBuffer, this.byteOffset + start, end - start, Buffer._normalizeEncoding(encoding))
    }

    indexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: string): number {
        if (typeof value === 'string') {
            // issue #3: Encoding validation only applies to string needles (Node does not throw on `indexOf(97, 0, 'nope')`);
            // string needles follow `getEncoding` where empty string is also treated as unknown.
            if (encoding !== undefined && !Buffer.isEncoding(encoding)) throwUnknownEncoding(encoding)
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
            // issue #3: Same as `indexOf` — validates encoding only for string needles; empty string is also unknown.
            if (encoding !== undefined && !Buffer.isEncoding(encoding)) throwUnknownEncoding(encoding)
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

    includes(value: string | number | Buffer | Uint8Array, byteOffset?: number, encoding?: string): boolean {
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

    inspect(): string {
        let str = ''
        const max = 50 // Default max bytes to inspect
        const len = Math.min(this.length, max)
        for (let i = 0; i < len; i++) {
            if (i > 0) str += ' '
            str += this[i].toString(16).padStart(2, '0')
        }
        if (this.length > max) str += ' ... ' + (this.length - max) + ' more bytes'
        return '<Buffer ' + str + '>'
    }

    [Symbol.for('nodejs.util.inspect.custom')]() {
        return this.inspect()
    }

    static isEncoding(encoding: string): boolean {
        if (typeof encoding !== 'string') return false

        // Fast path for common lowercase encodings (avoids toLowerCase() allocation)
        switch (encoding) {
            case 'utf8':
            case 'utf-8':
            case 'hex':
            case 'base64':
            case 'latin1':
            case 'binary':
            case 'ascii':
            case 'utf16le':
            case 'ucs2':
            case 'base64url':
                return true
        }

        // Fallback for case-insensitive and rarer aliases
        switch (encoding.toLowerCase()) {
            case 'utf8':
            case 'utf-8':
            case 'hex':
            case 'base64':
            case 'base64url':
            case 'latin1':
            case 'binary':
            case 'ascii':
            case 'utf16le':
            case 'utf-16le':
            case 'ucs2':
            case 'ucs-2':
                return true
            default:
                return false
        }
    }

    private static _normalizeEncoding(enc: string): string {
        const encoding = enc.toLowerCase()
        switch (encoding) {
            case 'utf8':
            case 'utf-8':
                return 'utf8'
            case 'ucs2':
            case 'ucs-2':
            case 'utf16le':
            case 'utf-16le':
                return 'utf16le'
            case 'latin1':
            case 'binary':
                return 'latin1'
            case 'base64':
                return 'base64'
            case 'base64url':
                return 'base64url'
            case 'hex':
                return 'hex'
            case 'ascii':
                return 'ascii'
            default:
                return encoding
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

// ── Align static method enumerability with Node ────────────────────────────
//
// Node's `Buffer` is defined as a CJS function whose static methods are enumerable.
// In contrast, ES class static methods default to `enumerable: false`.
// While this seems like subtle metadata, `for...in`, `Object.keys`, `Object.assign`,
// and object spreads `{...x}` all iterate based on enumerability — and copying static
// members is very common across the npm ecosystem (e.g. `safer-buffer@2.1.2`).
//
// When non-enumerable, copying resulted in a nearly empty object, causing
// `require('safer-buffer').Buffer.isBuffer` to be undefined, breaking `iconv-lite@0.7.x`
// and Express 5's `express.json()`.
//
// In Node parity: `for (const k in Buffer) n++` enumerates 12 keys (was only 1: `poolSize`).
// Only modifies `enumerable: true`, preserving value/writable/configurable descriptors.
for (const key of Object.getOwnPropertyNames(Buffer)) {
    if (key === 'length' || key === 'name' || key === 'prototype' || key === 'arguments' || key === 'caller') continue
    const desc = Object.getOwnPropertyDescriptor(Buffer, key)
    if (desc && !desc.enumerable && desc.configurable) {
        try {
            Object.defineProperty(Buffer, key, { ...desc, enumerable: true })
        } catch {
            // Ignore if engine restricts property reconfiguration
        }
    }
}

