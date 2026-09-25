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

### Device: Mac mini M4

| Operation | Nitro Buffer | Competitor (Craftz) | Improvement |
|:---|:---:|:---:|:---:|
| `fill(0)` | **0.01ms** | 7.38ms | **~715x 🚀** |
| `write(utf8)` | **4.24ms** | 135.75ms | **~32x 🚀** |
| `toString(utf8)` | **0.78ms** | 112.75ms | **~144x 🚀** |
| `toString(base64)` | 0.30ms | 0.30ms | 1.00x |
| `from(base64)` | **0.35ms** | 82.53ms | **~239x 🚀** |
| `toString(hex)` | **9.28ms** | 33.66ms | **~3.6x 🚀** |
| `from(hex)` | **7.66ms** | 78.49ms | **~10x 🚀** |
| `btoa(1MB)` | **9.62ms** | 133.63ms | **~14x 🚀** |
| `atob(1MB)` | **4.05ms** | 282.94ms | **~70x 🚀** |
| `alloc(1MB)` | 0.05ms | **0.02ms** | 0.33x |

*> Benchmarks averaged over 50 iterations on 1MB Buffer operations.*
*> Tested versions: `react-native-nitro-buffer` v0.3.0 vs `@craftzdog/react-native-buffer` v6.1.2 (with `react-native-quick-base64` v3.0.1) on React Native 0.81.6 (New Architecture).*

> [!NOTE]
> **About `alloc` Performance**: The slight difference in allocation time (~0.3ms) is due to the overhead of initializing the ES6 Class structure (`Object.setPrototypeOf`), which provides a cleaner and safer type inheritance model compared to the functional mixin approach. This one-time initialization cost is negligible compared to the massive **3x - 700x** performance gains in actual Buffer operations.

> [!TIP]
> **`atob`/`btoa` Optimization**: In modern React Native environments (Hermes), `global.atob` and `global.btoa` are natively implemented and highly optimized. `react-native-nitro-buffer` automatically detects and uses these native implementations if available, ensuring your app runs at peak performance while maintaining Node.js utility compatibility.

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

## ⚠️ Compatibility Notes

### `toString('ascii')` Behavior

When decoding binary data with non-ASCII bytes (0x80-0xFF), `react-native-nitro-buffer` follows the **Node.js standard** by replacing invalid bytes with the Unicode replacement character (`U+FFFD`, displayed as `�`).

```javascript
const buf = Buffer.from([0x48, 0x69, 0x80, 0xFF, 0x21]); // "Hi" + invalid bytes + "!"
buf.toString('ascii');
// Nitro (Node.js compatible): "Hi��!" (length: 5)
// @craftzdog/react-native-buffer: "Hi!" (length: 5) - incorrectly drops invalid bytes
```

This ensures consistent behavior with Node.js when handling binary protocols like WebSocket messages containing mixed text and binary data (e.g., Microsoft TTS audio streams).

## 📄 License

ISC
