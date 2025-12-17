# react-native-nitro-buffer

A high-performance, Node.js compatible `Buffer` implementation for React Native, powered by **Nitro Modules** and C++.

## 🚀 Features

*   **⚡️ Blazing Fast**: Implemented in C++ using Nitro Modules for maximum performance.
*   **✅ Node.js Compatible**: Drop-in replacement for the standard Node.js `Buffer` API.
*   **🔒 Type Safe**: Written in TypeScript with full type definitions.
*   **📦 Zero Dependencies**: Lightweight and efficient.
*   **📱 Cross Platform**: Works flawlessly on iOS and Android.

## 🏎️ Performance

`react-native-nitro-buffer` is significantly faster than other Buffer implementations for React Native.

**Benchmark Results (1MB Buffer operations):**

| Operation | Nitro Buffer | Competitor (Craftz) | Improvement |
|:---|:---:|:---:|:---:|
| `fill(0)` | **0.019ms** | 10.36ms | **~545x 🚀** |
| `write(utf8)` | **2.53ms** | 212.42ms | **~84x 🚀** |
| `toString(utf8)` | **0.25ms** | 170.72ms | **~691x 🚀** |
| `toString(base64)` | **0.68ms** | 3.37ms | **~5x 🚀** |
| `from(base64)` | **1.37ms** | 146.70ms | **~107x 🚀** |
| `toString(hex)` | **4.86ms** | 56.77ms | **~11.7x 🚀** |
| `from(hex)` | **11.05ms** | 136.64ms | **~12.4x 🚀** |
| `alloc(1MB)` | 0.39ms | 0.09ms | 0.23x |

*> Benchmarks ran on iPad Air 5 (M1), averaging 50 iterations.*

> [!NOTE]
> **About `alloc` Performance**: The slight difference in allocation time (~0.3ms) is due to the overhead of initializing the ES6 Class structure (`Object.setPrototypeOf`), which provides a cleaner and safer type inheritance model compared to the functional mixin approach. This one-time initialization cost is negligible compared to the massive **10x - 700x** performance gains in actual Buffer operations.

## 📦 Installation

```bash
npm install react-native-nitro-buffer
# or
yarn add react-native-nitro-buffer
```

### iOS Setup

```bash
cd ios && pod install
```

## 📖 Usage

Import `Buffer` directly from the package. It follows the standard [Node.js Buffer API](https://nodejs.org/api/buffer.html).

```typescript
import { Buffer } from 'react-native-nitro-buffer';

// 1. Allocation
const buf = Buffer.alloc(10);
buf.fill(0);

// 2. From String
const hello = Buffer.from('Hello World');
console.log(hello.toString('hex')); // 48656c6c6f20576f726c64

// 3. String Encoding/Decoding
const base64 = hello.toString('base64');
console.log(base64); // SGVsbG8gV29ybGQ=

const decoded = Buffer.from(base64, 'base64');
console.log(decoded.toString()); // Hello World

// 4. Binary Manipulation
const buf2 = Buffer.allocUnsafe(4);
buf2.writeUInt8(0x12, 0); // (Note: typed array methods available via standard Uint8Array API)
```

## 🧩 API Support

This library achieves **100% API compatibility** with Node.js `Buffer`.

### Static Methods
*   `Buffer.alloc(size, fill, encoding)`
*   `Buffer.allocUnsafe(size)`
*   `Buffer.from(array|string|buffer)`
*   `Buffer.byteLength(string, encoding)`
*   `Buffer.isBuffer(obj)`
*   `Buffer.compare(buf1, buf2)`
*   `Buffer.concat(list, totalLength)`
*   `Buffer.isEncoding(encoding)`
*   `Buffer.poolSize`

### Instance Methods
*   **Binary Read/Write**:
    *   `readInt8`, `readUInt8`, `writeInt8`, `writeUInt8`
    *   `readInt16LE/BE`, `readUInt16LE/BE`, `writeInt16LE/BE`, `writeUInt16LE/BE`
    *   `readInt32LE/BE`, `readUInt32LE/BE`, `writeInt32LE/BE`, `writeUInt32LE/BE`
    *   `readBigInt64LE/BE`, `readBigUInt64LE/BE`, `writeBigInt64LE/BE`, `writeBigUInt64LE/BE`
    *   `readFloatLE/BE`, `readDoubleLE/BE`, `writeFloatLE/BE`, `writeDoubleLE/BE`
    *   `readIntLE/BE`, `readUIntLE/BE`, `writeIntLE/BE`, `writeUIntLE/BE`
*   **String/Search**:
    *   `includes(value, byteOffset, encoding)`
    *   `indexOf(value, byteOffset, encoding)`
    *   `lastIndexOf(value, byteOffset, encoding)`
    *   `fill(value, offset, end, encoding)`
*   **Manipulation/Utils**:
    *   `write(string, offset, length, encoding)`
    *   `toString(encoding, start, end)`
    *   `compare(target, ...)`
    *   `copy(target, ...)`
    *   `slice(start, end)` (Returns a view, similar to Node.js `subarray`)
    *   `swap16()`, `swap32()`, `swap64()`
    *   `toJSON()`

## 🔄 Interoperability

`react-native-nitro-buffer` is designed to be fully interoperable with React Native's ecosystem.

*   **Standard Uint8Array**: Instances are standard `Uint8Array`s, so they work with any API accepting standard typed arrays.
*   **`@craftzdog/react-native-buffer`**: Fully compatible. You can convert between the two or mix them in standard operations (like `concat` or `compare`) because both adhere to standard byte structures.
    ```typescript
    import { Buffer as NitroBuffer } from 'react-native-nitro-buffer';
    import { Buffer as CraftzBuffer } from '@craftzdog/react-native-buffer';

    const nBuf = NitroBuffer.from('Hello');
    const cBuf = CraftzBuffer.from(nBuf); // Works!
    ```

## 📄 License

ISC
