import { Buffer as NodeBuffer } from 'node:buffer'

jest.mock('react-native-nitro-modules')

import { atob, btoa, Buffer, isAscii, isUtf8, resolveObjectURL } from '../src'

describe('utility helpers', () => {
    it('falls back to Buffer-based base64 helpers when globals are unavailable', () => {
        const originalAtob = global.atob
        const originalBtoa = global.btoa

        ;(global as typeof global & { atob?: typeof atob }).atob = undefined
        ;(global as typeof global & { btoa?: typeof btoa }).btoa = undefined

        expect(atob('SGVsbG8=')).toBe('Hello')
        expect(btoa('Hello')).toBe(NodeBuffer.from('Hello', 'latin1').toString('base64'))

        global.atob = originalAtob
        global.btoa = originalBtoa
    })

    it('prefers existing global atob and btoa implementations', () => {
        const originalAtob = global.atob
        const originalBtoa = global.btoa
        const atobSpy = jest.fn(() => 'from-global-atob')
        const btoaSpy = jest.fn(() => 'from-global-btoa')

        global.atob = atobSpy
        global.btoa = btoaSpy

        expect(atob('ignored')).toBe('from-global-atob')
        expect(btoa('ignored')).toBe('from-global-btoa')
        expect(atobSpy).toHaveBeenCalledWith('ignored')
        expect(btoaSpy).toHaveBeenCalledWith('ignored')

        global.atob = originalAtob
        global.btoa = originalBtoa
    })

    it('validates ascii and utf8 payloads from ArrayBuffer-like inputs', () => {
        const ascii = Buffer.from('Hello').buffer
        const validUtf8 = Uint8Array.from([0xe4, 0xbd, 0xa0]).buffer
        const invalidUtf8 = Uint8Array.from([0xc0, 0xaf]).buffer

        expect(isAscii(ascii)).toBe(true)
        expect(isAscii(Uint8Array.from([0x41, 0xff]))).toBe(false)
        expect(isUtf8(validUtf8)).toBe(true)
        expect(isUtf8(invalidUtf8)).toBe(false)
    })

    it('returns undefined for resolveObjectURL in React Native context', () => {
        expect(resolveObjectURL('blob:demo')).toBeUndefined()
    })
})
