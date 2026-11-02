export { Buffer } from './Buffer'
export * from './utils'

export const INSPECT_MAX_BYTES = 50
export const kMaxLength = 2147483647
export const kStringMaxLength = 536870888

export const constants = {
    MAX_LENGTH: kMaxLength,
    MAX_STRING_LENGTH: kStringMaxLength
}

export class SlowBuffer extends Uint8Array {
    constructor(size: number) {
        super(size)
        Object.setPrototypeOf(this, require('./Buffer').Buffer.prototype)
    }
}

export default {
    get Buffer() { return Buffer },
    get constants() { return constants },
    get INSPECT_MAX_BYTES() { return INSPECT_MAX_BYTES },
    get kMaxLength() { return kMaxLength },
    get kStringMaxLength() { return kStringMaxLength },
    get SlowBuffer() { return SlowBuffer },
};
