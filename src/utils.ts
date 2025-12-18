
import { Buffer } from './Buffer'

export function atob(data: string): string {
    if (typeof global.atob === 'function') {
        return global.atob(data)
    }
    return Buffer.from(data, 'base64').toString('binary')
}

export function btoa(data: string): string {
    if (typeof global.btoa === 'function') {
        return global.btoa(data)
    }
    return Buffer.from(data, 'binary').toString('base64')
}

export function isAscii(input: Buffer | Uint8Array | ArrayBuffer): boolean {
    const arr = input instanceof Uint8Array ? input : new Uint8Array(input as ArrayBuffer)
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] > 127) return false
    }
    return true
}

export function isUtf8(input: Buffer | Uint8Array | ArrayBuffer): boolean {
    const arr = input instanceof Uint8Array ? input : new Uint8Array(input as ArrayBuffer)
    try {
        // Fast path: TextDecoder if available
        if (typeof TextDecoder !== 'undefined') {
            new TextDecoder('utf-8', { fatal: true }).decode(arr)
            return true
        }
    } catch (e) {
        return false
    }

    // Fallback: JS implementation of UTF-8 validation
    let i = 0
    const len = arr.length
    while (i < len) {
        let descriptor = arr[i]
        if (descriptor <= 127) {
            i++
            continue
        } else if ((descriptor & 0xE0) === 0xC0) {
            // 2 bytes
            if (i + 1 >= len || (arr[i + 1] & 0xC0) !== 0x80) return false
            if ((descriptor & 0xFE) === 0xC0) return false // Overlong
            i += 2
        } else if ((descriptor & 0xF0) === 0xE0) {
            // 3 bytes
            if (i + 2 >= len || (arr[i + 1] & 0xC0) !== 0x80 || (arr[i + 2] & 0xC0) !== 0x80) return false
            if (descriptor === 0xE0 && (arr[i + 1] < 0xA0)) return false // Overlong
            if (descriptor === 0xED && (arr[i + 1] >= 0xA0)) return false // Surrogate
            i += 3
        } else if ((descriptor & 0xF8) === 0xF0) {
            // 4 bytes
            if (i + 3 >= len || (arr[i + 1] & 0xC0) !== 0x80 || (arr[i + 2] & 0xC0) !== 0x80 || (arr[i + 3] & 0xC0) !== 0x80) return false
            if (descriptor === 0xF0 && (arr[i + 1] < 0x90)) return false // Overlong
            if (descriptor === 0xF4 && (arr[i + 1] >= 0x90)) return false // Out of range
            i += 4
        } else {
            return false
        }
    }
    return true
}

export function transcode(source: Uint8Array, fromEnc: string, toEnc: string): Buffer {
    if (!Buffer.isEncoding(fromEnc) || !Buffer.isEncoding(toEnc)) {
        throw new TypeError('Invalid encoding')
    }
    const buf = source instanceof Buffer ? source : Buffer.from(source)
    const str = buf.toString(fromEnc)
    return Buffer.from(str, toEnc)
}

export function resolveObjectURL(id: string): string | undefined {
    // Not implemented in RN context usually, stub or return undefined
    return undefined
}
