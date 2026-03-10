import { Buffer as NodeBuffer } from 'node:buffer'

const normalizeEncoding = (encoding: string = 'utf8'): BufferEncoding => {
    switch (encoding.toLowerCase()) {
        case 'utf8':
        case 'utf-8':
            return 'utf8'
        case 'latin1':
        case 'binary':
            return 'latin1'
        case 'ucs2':
        case 'utf16le':
        case 'utf-16le':
            return 'utf16le'
        default:
            return encoding as BufferEncoding
    }
}

const getView = (buffer: ArrayBuffer, offset = 0, length?: number): NodeBuffer => {
    const byteLength = length ?? (buffer.byteLength - offset)
    return NodeBuffer.from(buffer, offset, byteLength)
}

const hybridObject = {
    byteLength(string: string, encoding: string): number {
        return NodeBuffer.byteLength(string, normalizeEncoding(encoding))
    },
    write(buffer: ArrayBuffer, string: string, offset: number, length: number, encoding: string): number {
        const target = getView(buffer)
        const source = NodeBuffer.from(string, normalizeEncoding(encoding))
        const end = Math.min(target.length, offset + length)
        const bytesToWrite = Math.max(0, Math.min(source.length, end - offset))

        source.copy(target, offset, 0, bytesToWrite)
        return bytesToWrite
    },
    decode(buffer: ArrayBuffer, offset: number, length: number, encoding: string): string {
        return getView(buffer, offset, length).toString(normalizeEncoding(encoding))
    },
    compare(a: ArrayBuffer, aOffset: number, aLength: number, b: ArrayBuffer, bOffset: number, bLength: number): number {
        return getView(a, aOffset, aLength).compare(getView(b, bOffset, bLength))
    },
    fill(buffer: ArrayBuffer, value: number, offset: number, length: number): void {
        getView(buffer).fill(value, offset, offset + length)
    },
    indexOf(buffer: ArrayBuffer, value: number, offset: number, length: number): number {
        const view = getView(buffer, offset, length)
        const index = view.indexOf(value)
        return index === -1 ? -1 : offset + index
    },
    indexOfBuffer(buffer: ArrayBuffer, needle: ArrayBuffer, offset: number, length: number): number {
        const view = getView(buffer, offset, length)
        const index = view.indexOf(getView(needle))
        return index === -1 ? -1 : offset + index
    },
    lastIndexOfByte(buffer: ArrayBuffer, value: number, offset: number, length: number): number {
        const view = getView(buffer, offset, length)
        const index = view.lastIndexOf(value)
        return index === -1 ? -1 : offset + index
    },
    lastIndexOfBuffer(buffer: ArrayBuffer, needle: ArrayBuffer, offset: number, length: number): number {
        const view = getView(buffer, offset, length)
        const index = view.lastIndexOf(getView(needle))
        return index === -1 ? -1 : offset + index
    },
    fillBuffer(buffer: ArrayBuffer, value: ArrayBuffer, offset: number, length: number): void {
        getView(buffer).fill(getView(value), offset, offset + length)
    }
}

export const NitroModules = {
    createHybridObject: jest.fn(() => hybridObject)
}
