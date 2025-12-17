import { type HybridObject } from 'react-native-nitro-modules'

export interface NitroBuffer extends HybridObject<{ ios: 'c++', android: 'c++' }> {
    // Allocation
    alloc(size: number): ArrayBuffer
    allocUnsafe(size: number): ArrayBuffer

    // Operations
    byteLength(string: string, encoding: string): number
    write(buffer: ArrayBuffer, string: string, offset: number, length: number, encoding: string): number
    decode(buffer: ArrayBuffer, offset: number, length: number, encoding: string): string
    compare(a: ArrayBuffer, aOffset: number, aLength: number, b: ArrayBuffer, bOffset: number, bLength: number): number
    fill(buffer: ArrayBuffer, value: number, offset: number, length: number): void
    indexOf(buffer: ArrayBuffer, value: number, offset: number, length: number): number
    indexOfBuffer(buffer: ArrayBuffer, needle: ArrayBuffer, offset: number, length: number): number
    lastIndexOfByte(buffer: ArrayBuffer, value: number, offset: number, length: number): number
    lastIndexOfBuffer(buffer: ArrayBuffer, needle: ArrayBuffer, offset: number, length: number): number
    fillBuffer(buffer: ArrayBuffer, value: ArrayBuffer, offset: number, length: number): void
}
