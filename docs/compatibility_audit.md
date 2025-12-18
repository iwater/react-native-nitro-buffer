# Node.js Buffer Compatibility Audit

This document details the compatibility of `react-native-nitro-buffer` with the official Node.js `Buffer` API.

## ✅ Summary

High compatibility with Node.js `Buffer` API. Most core methods are implemented, including all read/write integers/floats, string encoding/decoding, and utility methods like `concat`, `compare`, `equals`, `fill`, etc.

**Score:** ~99% Compatibility (Excluding Blob/File)

## 📊 Detailed API Status

| API | Status | Notes |
| :--- | :--- | :--- |
| **Static Methods** | | |
| `Buffer.alloc(size[, fill[, encoding]])` | ✅ Supported | Full support. |
| `Buffer.allocUnsafe(size)` | ✅ Supported | Full support. (Note: zero-fills in RN environment to avoid uninitialized memory). |
| `Buffer.allocUnsafeSlow(size)` | ✅ Supported | Alias for `allocUnsafe`. |
| `Buffer.byteLength(string[, encoding])` | ✅ Supported | Full support via native. |
| `Buffer.compare(buf1, buf2)` | ✅ Supported | Full support. |
| `Buffer.concat(list[, totalLength])` | ✅ Supported | Full support. |
| `Buffer.copyBytesFrom(view[, offset[, length]])` | ✅ Supported | Full support. |
| `Buffer.from(array)` | ✅ Supported | Full support. |
| `Buffer.from(arrayBuffer[, byteOffset[, length]])` | ✅ Supported | Full support. |
| `Buffer.from(buffer)` | ✅ Supported | Full support. |
| `Buffer.from(object[, offsetOrEncoding[, length]])` | ✅ Supported | Full support. |
| `Buffer.from(string[, encoding])` | ✅ Supported | Full support. |
| `Buffer.isBuffer(obj)` | ✅ Supported | Full support. |
| `Buffer.isEncoding(encoding)` | ✅ Supported | Full support. |
| `Buffer.poolSize` | ✅ Supported | Property implemented (default 8192). |
| **Instance Properties** | | |
| `buf[index]` | ✅ Supported | Inherited from `Uint8Array`. |
| `buf.buffer` | ✅ Supported | Inherited from `Uint8Array`. |
| `buf.byteOffset` | ✅ Supported | Inherited from `Uint8Array`. |
| `buf.length` | ✅ Supported | Inherited from `Uint8Array`. |
| `buf.parent` | ✅ Supported | Implemented as getter for `buffer`. |
| **Instance Methods** | | |
| `buf.compare(target)` | ✅ Supported | Full support. |
| `buf.copy(target)` | ✅ Supported | Full support. |
| `buf.entries()` | ✅ Supported | Inherited from `Uint8Array`. |
| `buf.equals(otherBuffer)` | ✅ Supported | Full support. |
| `buf.fill(value[, offset[, end]][, encoding])` | ✅ Supported | Full support. |
| `buf.includes(value[, byteOffset][, encoding])` | ✅ Supported | Full support. |
| `buf.indexOf(value[, byteOffset][, encoding])` | ✅ Supported | Full support. |
| `buf.keys()` | ✅ Supported | Inherited from `Uint8Array`. |
| `buf.lastIndexOf(value[, byteOffset][, encoding])` | ✅ Supported | Full support. |
| `buf.readBigInt64BE([offset])` | ✅ Supported | Full support. |
| `buf.readBigInt64LE([offset])` | ✅ Supported | Full support. |
| `buf.readBigUInt64BE([offset])` | ✅ Supported | Full support. |
| `buf.readBigUInt64LE([offset])` | ✅ Supported | Full support. |
| `buf.readDoubleBE([offset])` | ✅ Supported | Full support. |
| `buf.readDoubleLE([offset])` | ✅ Supported | Full support. |
| `buf.readFloatBE([offset])` | ✅ Supported | Full support. |
| `buf.readFloatLE([offset])` | ✅ Supported | Full support. |
| `buf.readInt8([offset])` | ✅ Supported | Full support. |
| `buf.readInt16BE([offset])` | ✅ Supported | Full support. |
| `buf.readInt16LE([offset])` | ✅ Supported | Full support. |
| `buf.readInt32BE([offset])` | ✅ Supported | Full support. |
| `buf.readInt32LE([offset])` | ✅ Supported | Full support. |
| `buf.readIntBE(offset, byteLength)` | ✅ Supported | Full support. |
| `buf.readIntLE(offset, byteLength)` | ✅ Supported | Full support. |
| `buf.readUInt8([offset])` | ✅ Supported | Full support. |
| `buf.readUInt16BE([offset])` | ✅ Supported | Full support. |
| `buf.readUInt16LE([offset])` | ✅ Supported | Full support. |
| `buf.readUInt32BE([offset])` | ✅ Supported | Full support. |
| `buf.readUInt32LE([offset])` | ✅ Supported | Full support. |
| `buf.readUIntBE(offset, byteLength)` | ✅ Supported | Full support. |
| `buf.readUIntLE(offset, byteLength)` | ✅ Supported | Full support. |
| `buf.subarray([start[, end]])` | ✅ Supported | Returns `Buffer` instance (overrides `Uint8Array`). |
| `buf.slice([start[, end]])` | ✅ Supported | Implemented (aliases `subarray` behavior as per modern Node). |
| `buf.swap16()` | ✅ Supported | Full support. |
| `buf.swap32()` | ✅ Supported | Full support. |
| `buf.swap64()` | ✅ Supported | Full support. |
| `buf.toJSON()` | ✅ Supported | Full support. |
| `buf.toString([encoding[, start[, end]]])` | ✅ Supported | Full support. |
| `buf.values()` | ✅ Supported | Inherited from `Uint8Array`. |
| `buf.write(string[, offset[, length]][, encoding])` | ✅ Supported | Full support. |
| `buf.writeBigInt64BE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeBigInt64LE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeBigUInt64BE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeBigUInt64LE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeDoubleBE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeDoubleLE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeFloatBE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeFloatLE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeInt8(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeInt16BE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeInt16LE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeInt32BE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeInt32LE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeIntBE(value, offset, byteLength)` | ✅ Supported | Full support. |
| `buf.writeIntLE(value, offset, byteLength)` | ✅ Supported | Full support. |
| `buf.writeUInt8(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeUInt16BE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeUInt16LE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeUInt32BE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeUInt32LE(value[, offset])` | ✅ Supported | Full support. |
| `buf.writeUIntBE(value, offset, byteLength)` | ✅ Supported | Full support. |
| `buf.writeUIntLE(value, offset, byteLength)` | ✅ Supported | Full support. |
| `buf.inspect()` | ✅ Supported | Implemented. |
| **Classes** | | |
| `Blob` | ❌ Missing | **Action**: Class not exported or implemented. |
| `File` | ❌ Missing | **Action**: Class not exported or implemented. |
| **Constants** | | |
| `buffer.constants` | ✅ Supported | constant values exported. |
| `buffer.kMaxLength` | ✅ Supported | Exported. |
| `buffer.kStringMaxLength` | ✅ Supported | Exported. |
| `buffer.INSPECT_MAX_BYTES` | ✅ Supported | Exported. |
| `buffer.transcode` | ✅ Supported | Exported via `utils`. |
| `buffer.resolveObjectURL` | ✅ Supported | Exported via `utils`. |
| `buffer.SlowBuffer` | ✅ Supported | Exported. |

## ⚠️ Known Differences

1. **Garbage Collection**: Node.js `Buffer` can allocate from a shared pool (`poolSize`). `react-native-nitro-buffer` currently always allocates new memory. `Buffer.poolSize` is present for compatibility but ignored for allocation strategy.
2. **`Blob` / `File`**: These Web classes are part of the Node.js `buffer` module implementation but are typically provided by React Native.
