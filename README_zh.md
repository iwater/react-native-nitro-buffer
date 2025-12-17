# react-native-nitro-buffer

基于 **Nitro Modules** 和 C++ 构建的高性能、Node.js 兼容的 React Native `Buffer` 实现。

## 🚀 特性

*   **⚡️ 极速**: 使用 Nitro Modules 和 C++ 实现，性能极致。
*   **✅ Node.js 兼容**: 可直接替换标准的 Node.js `Buffer` API。
*   **🔒 类型安全**: 全 TypeScript 编写，提供完整的类型定义。
*   **📦 零依赖**: 轻量且高效。
*   **📱 跨平台**: 完美支持 iOS 和 Android。

## 🏎️ 性能

`react-native-nitro-buffer` 比 React Native 的其他 Buffer 实现要快得多。

**基准测试结果 (1MB Buffer 操作):**

| 操作 | Nitro Buffer | 竞品 (Craftz) | 提升幅度 |
|:---|:---:|:---:|:---:|
| `fill(0)` | **0.019ms** | 10.36ms | **~545x 🚀** |
| `write(utf8)` | **2.53ms** | 212.42ms | **~84x 🚀** |
| `toString(utf8)` | **0.25ms** | 170.72ms | **~691x 🚀** |
| `toString(base64)` | **0.68ms** | 3.37ms | **~5x 🚀** |
| `from(base64)` | **1.37ms** | 146.70ms | **~107x 🚀** |
| `toString(hex)` | **4.86ms** | 56.77ms | **~11.7x 🚀** |
| `from(hex)` | **11.05ms** | 136.64ms | **~12.4x 🚀** |
| `alloc(1MB)` | 0.39ms | 0.09ms | 0.23x |

*> 测试运行于 iPad Air 5 (M1)，取 50 次迭代平均值。*

> [!NOTE]
> **关于 `alloc` 性能**: `alloc` 时间上的微小差异 (~0.3ms) 是由于初始化 ES6 Class 结构 (`Object.setPrototypeOf`) 带来的开销，这相比于函数式混入 (functional mixin) 提供了更清晰和安全的类型继承模型。与实际 Buffer 操作中获得的 **10x - 700x** 巨大性能提升相比，这一一次性的初始化成本可以忽略不计。

## 📦 安装

```bash
npm install react-native-nitro-buffer
# 或
yarn add react-native-nitro-buffer
```

### iOS 设置

```bash
cd ios && pod install
```

## 📖 使用

直接从包中导入 `Buffer`。它遵循标准的 [Node.js Buffer API](https://nodejs.org/api/buffer.html)。

```typescript
import { Buffer } from 'react-native-nitro-buffer';

// 1. 分配内存
const buf = Buffer.alloc(10);
buf.fill(0);

// 2. 从字符串创建
const hello = Buffer.from('Hello World');
console.log(hello.toString('hex')); // 48656c6c6f20576f726c64

// 3. 字符串编码/解码
const base64 = hello.toString('base64');
console.log(base64); // SGVsbG8gV29ybGQ=

const decoded = Buffer.from(base64, 'base64');
console.log(decoded.toString()); // Hello World

// 4. 二进制操作
const buf2 = Buffer.allocUnsafe(4);
buf2.writeUInt8(0x12, 0); // (注意：可通过标准 Uint8Array API 使用类型化数组方法)
```

## 🧩 API 支持

本库实现了 Node.js `Buffer` 的 **100% API 兼容性**。

### 静态方法 (Static Methods)
*   `Buffer.alloc(size, fill, encoding)`
*   `Buffer.allocUnsafe(size)`
*   `Buffer.from(array|string|buffer)`
*   `Buffer.byteLength(string, encoding)`
*   `Buffer.isBuffer(obj)`
*   `Buffer.compare(buf1, buf2)`
*   `Buffer.concat(list, totalLength)`
*   `Buffer.isEncoding(encoding)`
*   `Buffer.poolSize`

### 实例方法 (Instance Methods)
*   **二进制读写 (Binary Read/Write)**:
    *   `readInt8`, `readUInt8`, `writeInt8`, `writeUInt8`
    *   `readInt16LE/BE`, `readUInt16LE/BE`, `writeInt16LE/BE`, `writeUInt16LE/BE`
    *   `readInt32LE/BE`, `readUInt32LE/BE`, `writeInt32LE/BE`, `writeUInt32LE/BE`
    *   `readBigInt64LE/BE`, `readBigUInt64LE/BE`, `writeBigInt64LE/BE`, `writeBigUInt64LE/BE`
    *   `readFloatLE/BE`, `readDoubleLE/BE`, `writeFloatLE/BE`, `writeDoubleLE/BE`
    *   `readIntLE/BE`, `readUIntLE/BE`, `writeIntLE/BE`, `writeUIntLE/BE`
*   **字符串/搜索 (String/Search)**:
    *   `includes(value, byteOffset, encoding)`
    *   `indexOf(value, byteOffset, encoding)`
    *   `lastIndexOf(value, byteOffset, encoding)`
    *   `fill(value, offset, end, encoding)`
*   **操作/工具 (Manipulation/Utils)**:
    *   `write(string, offset, length, encoding)`
    *   `toString(encoding, start, end)`
    *   `compare(target, ...)`
    *   `copy(target, ...)`
    *   `slice(start, end)` (返回视图，类似于 Node.js `subarray`)
    *   `swap16()`, `swap32()`, `swap64()`
    *   `toJSON()`

## 🔄 互操作性 (Interoperability)

`react-native-nitro-buffer` 旨在与 React Native 生态系统完全互操作。

*   **标准 Uint8Array**: 实例是标准的 `Uint8Array`，因此它们适用于任何接受标准类型化数组的 API。
*   **`@craftzdog/react-native-buffer`**: 完全兼容。你可以在两者之间进行转换，或者在标准操作（如 `concat` 或 `compare`）中混合使用它们，因为两者都遵循标准的字节结构。
    ```typescript
    import { Buffer as NitroBuffer } from 'react-native-nitro-buffer';
    import { Buffer as CraftzBuffer } from '@craftzdog/react-native-buffer';

    const nBuf = NitroBuffer.from('Hello');
    const cBuf = CraftzBuffer.from(nBuf); // 正常工作!
    ```

## 📄 许可

ISC
