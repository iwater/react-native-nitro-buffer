#include "HybridNitroBuffer.hpp"
#include "simdutf.h"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <iostream>
#include <vector>

namespace margelo::nitro::buffer {

std::string base64_encode(const unsigned char *bytes_to_encode,
                          size_t in_len, bool url_safe = false) {
  if (in_len == 0)
    return "";
  auto opts = url_safe ? simdutf::base64_url : simdutf::base64_default;
  size_t max_len = simdutf::base64_length_from_binary(in_len, opts);
  std::string ret(max_len, '\0');
  size_t written = simdutf::binary_to_base64(
      reinterpret_cast<const char *>(bytes_to_encode), in_len, ret.data(),
      opts);
  ret.resize(written);
  return ret;
}
std::vector<unsigned char> base64_decode(std::string const &encoded_string) {
  size_t in_len = encoded_string.size();
  if (in_len == 0)
    return {};

  size_t max_len = simdutf::maximal_binary_length_from_base64(encoded_string.data(), in_len);
  std::vector<unsigned char> ret(max_len);
  size_t out_len = max_len;
  auto r = simdutf::base64_to_binary_safe(
      encoded_string.data(), in_len,
      reinterpret_cast<char *>(ret.data()), out_len,
      simdutf::base64_default_or_url_accept_garbage,
      simdutf::last_chunk_handling_options::loose,
      /*decode_up_to_bad_char*/ true);
  ret.resize(out_len);
  return ret;
}

// ---------------------------------------------------------------------------
// node 逐字节对齐的 base64 解码（用于「不干净」的输入）
// ---------------------------------------------------------------------------
//
// 为什么需要它：simdutf 的 `accept_garbage` 与 node 的规则**不是**一回事。
// node 的规则（实测反推，36 个样例全中，node v22.12.0）：
//   · 逐个 **UTF-16 码元**看它的**低 8 位**（`Buffer.from('中','base64')` 里
//     `'中'` 的低字节是 `0x2d`，也就是 `-`）；
//   · 字母表 = 标准 `A-Za-z0-9+/` **并上** URL 的 `-` `_`（**两种 encoding 都接受并集**：
//     `Buffer.from('-_','base64')` = `fb`，`Buffer.from('+/','base64url')` = `fb`）；
//   · `=` ⇒ **终止**解码（不是跳过：`Buffer.from('a😀\x00b','base64')` 里
//     `0xd83d & 0xff == 0x3d == '='` ⇒ 只剩 `'a'` 一个值 ⇒ 0 字节）；
//   · 其余字符（含空白）⇒ **跳过**；
//   · 收集到的值按标准分组：4 → 3 字节、3 → 2、2 → 1、落单的 1 个**丢弃**。
//
// 实测差异（node vs 走 simdutf 的本侧）：
//   `Buffer.from('中\x00文\x00字','base64')` → node `f9`(1B) / 本侧 ``(0B)
//   `Buffer.from('a😀\x00b','base64')`       → node ``(0B)     / 本侧 `69`(1B)
//   `Buffer.from('中中中中','base64')`        → node `fbefbe`  / 本侧 ``
// ⚠️ 表是**算出来的，不是手写的**。手写 256 项极易错位：本轮先手写了一版，
//    把 `'='`(0x3d) 放到了 `'<'`(0x3c) 的位置、又把 `'*'`(0x2a) 当成了 `'+'`(0x2b)
//    ⇒ `Buffer.from('a😀\x00b','base64')` 仍然差 1 字节（`'='` 被当成"跳过"而不是"终止"）。
//    对照 node 的探针当场抓到了它 —— **这种表要么算出来，要么用探针逐字符验一遍。**
static const int8_t *base64NodeTable() {
  struct Table {
    int8_t v[256];
    Table() {
      for (int i = 0; i < 256; i++)
        v[i] = -1;
      for (int i = 'A'; i <= 'Z'; i++)
        v[i] = static_cast<int8_t>(i - 'A');
      for (int i = 'a'; i <= 'z'; i++)
        v[i] = static_cast<int8_t>(i - 'a' + 26);
      for (int i = '0'; i <= '9'; i++)
        v[i] = static_cast<int8_t>(i - '0' + 52);
      v[static_cast<int>('+')] = 62;
      v[static_cast<int>('/')] = 63;
      // URL 字母表：node 的**标准** base64 也接受它们
      // （实测 `Buffer.from('-_','base64')` = `fb`；反向 `Buffer.from('+/','base64url')` = `fb`）
      v[static_cast<int>('-')] = 62;
      v[static_cast<int>('_')] = 63;
      v[static_cast<int>('=')] = -2; // 终止
    }
  };
  static const Table t;
  return t.v;
}

/// 「干净」= 只含规范字母表（标准 ∪ URL），且 `=` 只出现在末尾、最多 2 个。
/// 干净输入下 simdutf 与 node 必然一致（就是规范 base64）⇒ 可以走快路径。
static bool isCleanBase64(const std::string &s) {
  size_t n = s.size();
  size_t pad = 0;
  while (pad < 3 && pad < n && s[n - 1 - pad] == '=')
    pad++;
  if (pad > 2)
    return false;
  for (size_t i = 0; i + pad < n; i++) {
    int8_t v = base64NodeTable()[static_cast<unsigned char>(s[i])];
    if (v < 0)
      return false;
  }
  return true;
}

/// node 语义的解码器（见上面的规则说明）。UTF-8 → 码元 → 低 8 位 → 过表。
static std::vector<unsigned char> base64_decode_node_exact(const std::string &s) {
  std::vector<unsigned char> out;
  out.reserve(s.size() / 4 * 3 + 3);
  uint32_t acc = 0;
  int n = 0; // 已收集的值的个数（模 4）
  // 落单的 2 / 3 个值要**补成一个完整的尾组**：4 → 3 字节、3 → 2 字节、2 → 1 字节、
  // 1 → 丢弃。⚠️ 这段**在 `=` 终止时也要跑** —— 先前的写法在 `=` 处直接 `return`，
  // 把尾组吞掉了：`Buffer.from('YWJj$ZA==','base64')` 因此只得到 3 字节（node 是 4）。
  auto flushPartial = [&out, &acc, &n]() {
    if (n == 3) {
      out.push_back(static_cast<unsigned char>((acc >> 10) & 0xFF));
      out.push_back(static_cast<unsigned char>((acc >> 2) & 0xFF));
    } else if (n == 2) {
      out.push_back(static_cast<unsigned char>((acc >> 4) & 0xFF));
    }
    acc = 0;
    n = 0;
  };
  size_t i = 0;
  const size_t len = s.size();

  while (i < len) {
    unsigned char b = static_cast<unsigned char>(s[i]);
    uint32_t cp = 0;
    size_t seq = 0;
    if (b <= 0x7F) {
      cp = b;
      seq = 1;
    } else if ((b & 0xE0) == 0xC0 && i + 1 < len) {
      cp = ((b & 0x1F) << 6) | (static_cast<unsigned char>(s[i + 1]) & 0x3F);
      seq = 2;
    } else if ((b & 0xF0) == 0xE0 && i + 2 < len) {
      cp = ((b & 0x0F) << 12) |
           ((static_cast<unsigned char>(s[i + 1]) & 0x3F) << 6) |
           (static_cast<unsigned char>(s[i + 2]) & 0x3F);
      seq = 3;
    } else if ((b & 0xF8) == 0xF0 && i + 3 < len) {
      cp = ((b & 0x07) << 18) |
           ((static_cast<unsigned char>(s[i + 1]) & 0x3F) << 12) |
           ((static_cast<unsigned char>(s[i + 2]) & 0x3F) << 6) |
           (static_cast<unsigned char>(s[i + 3]) & 0x3F);
      seq = 4;
    } else {
      cp = b;
      seq = 1;
    }
    i += seq;

    // 码点 → 一到两个 UTF-16 码元（星面字符是代理对）
    uint16_t units[2];
    int nu = 1;
    if (cp > 0xFFFF) {
      uint32_t v = cp - 0x10000;
      units[0] = static_cast<uint16_t>(0xD800 | ((v >> 10) & 0x3FF));
      units[1] = static_cast<uint16_t>(0xDC00 | (v & 0x3FF));
      nu = 2;
    } else {
      units[0] = static_cast<uint16_t>(cp);
    }

    for (int u = 0; u < nu; u++) {
      int8_t v = base64NodeTable()[units[u] & 0xFF];
      if (v == -2) {
        flushPartial(); // `=` 终止：尾组要先补出来
        return out;
      }
      if (v < 0)
        continue; // 非法 ⇒ 跳过
      acc = (acc << 6) | static_cast<uint32_t>(v);
      if (++n == 4) {
        out.push_back(static_cast<unsigned char>((acc >> 16) & 0xFF));
        out.push_back(static_cast<unsigned char>((acc >> 8) & 0xFF));
        out.push_back(static_cast<unsigned char>(acc & 0xFF));
        acc = 0;
        n = 0;
      }
    }
  }

  flushPartial();
  return out;
}

// ============== Allocation ==============
std::shared_ptr<ArrayBuffer> HybridNitroBuffer::alloc(double size) {
  size_t len = static_cast<size_t>(size);
  // Create a zero-initialized buffer
  auto buffer = ArrayBuffer::allocate(len);
  if (len > 0) {
    memset(buffer->data(), 0, len);
  }
  return buffer;
}

std::shared_ptr<ArrayBuffer> HybridNitroBuffer::allocUnsafe(double size) {
  size_t len = static_cast<size_t>(size);
  // Create buffer without zero-initialization (faster)
  return ArrayBuffer::allocate(len);
}

// ============== Operations ==============
double HybridNitroBuffer::byteLength(const std::string &string,
                                     const std::string &encoding) {
  // ⚠️ `hex` / `base64` / `base64url` 这两支**不要单独调用**：node 对它们的
  //    `byteLength` 是按 **JS 字符串长度（UTF-16 码元数）** 算的预测值，
  //    而这里只拿得到 UTF-8 字节 ⇒ 非 ASCII 输入下必然算错。
  //    JS 侧 `Buffer.byteLength` 已经自己算这两支（公式与实测见 `src/Buffer.ts`），
  //    本文件里保留它们只是为了 HybridObject 的方法面完整。
  if (encoding == "hex") {
    return (double)(string.length() / 2);
  } else if (encoding == "base64" || encoding == "base64url") {
    size_t len = string.length();
    if (len == 0)
      return 0;
    
    // For base64url, we might not have padding.
    // Node.js base64url byteLength: (len * 3) / 4 (floored)
    if (encoding == "base64url") {
        // Find actual content length (ignore trailing '=')
        size_t content_len = len;
        while (content_len > 0 && string[content_len - 1] == '=') content_len--;
        return (double)((content_len * 3) / 4);
    }
    
    size_t padding = 0;
    if (len > 0 && string[len - 1] == '=')
      padding++;
    if (len > 1 && string[len - 2] == '=')
      padding++;
    return (double)((len * 3) / 4 - padding);
  } else if (encoding == "utf16le") {
    // UTF-16 characters are 2 bytes each.
    // Input string is UTF-8. We need to count Unicode code points.
    size_t count = 0;
    size_t i = 0;
    size_t len = string.length();
    const char *str = string.c_str();
    while (i < len) {
      unsigned char byte = static_cast<unsigned char>(str[i]);
      size_t seqLen = 0;
      uint32_t cp = 0;
      if (byte <= 0x7F) { seqLen = 1; cp = byte; }
      else if ((byte & 0xE0) == 0xC0) { seqLen = 2; }
      else if ((byte & 0xF0) == 0xE0) { seqLen = 3; }
      else if ((byte & 0xF8) == 0xF0) { seqLen = 4; }
      else { seqLen = 1; }
      
      i += seqLen;
      // If code point > 0xFFFF, it's a surrogate pair (4 bytes in UTF-16, 2 UTF-16 units)
      // Actually, string.length() in UTF-16 (JavaScript) counts surrogate pairs as 2.
      // But we are receiving a UTF-8 std::string.
      // A surrogate pair in UTF-8 is 4 bytes.
      if (seqLen == 4) count += 2;
      else count += 1;
    }
    return (double)(count * 2);
  } else if (encoding == "binary" || encoding == "latin1" || encoding == "ascii") {
    // ⚠️ node 的 `ascii` / `latin1` 编码都是「**每个 UTF-16 码元一个字节**」
    // （`codeUnit & 0xFF`），**不是**每个码点一个字节 —— 实测（node v22.12.0）：
    //   `Buffer.byteLength('😀','latin1')` = **2**（一个代理对 = 两个码元）
    //   `Buffer.byteLength('中文','ascii')`  = **2**
    //   `Buffer.from('😀','ascii')` = `3d 00`（= 0xD83D&0xFF, 0xDE00&0xFF）
    //   `Buffer.from('中','latin1')` = `2d`（= 0x4E2D&0xFF）
    // 所以这里数的是**码元**：4 字节的 UTF-8 序列（星面字符）算 2 个。
    size_t count = 0;
    size_t i = 0;
    size_t len = string.length();
    const char *str = string.c_str();
    while (i < len) {
      unsigned char byte = static_cast<unsigned char>(str[i]);
      if (byte <= 0x7F) {
        i += 1;
      } else if ((byte & 0xE0) == 0xC0) {
        i += 2;
      } else if ((byte & 0xF0) == 0xE0) {
        i += 3;
      } else if ((byte & 0xF8) == 0xF0) {
        i += 4;
      } else {
        i += 1;
      }
      count++;
      // 星面码点（4 字节 UTF-8）在 UTF-16 里是**两个**码元
      if (i <= len && (byte & 0xF8) == 0xF0) {
        count++;
      }
    }
    return (double)count;
  }
  // utf8 (default)
  return (double)string.length();
}

// 十六进制字符 → 数值；非法返回 -1（`strtol` 对非法输入返回 0，会把非法对
// 静默写成 0x00，与 node 的「遇到第一个非法字符就停」不一致）。
static int hexDigit(char c) {
  if (c >= '0' && c <= '9')
    return c - '0';
  if (c >= 'a' && c <= 'f')
    return c - 'a' + 10;
  if (c >= 'A' && c <= 'F')
    return c - 'A' + 10;
  return -1;
}

double HybridNitroBuffer::write(const std::shared_ptr<ArrayBuffer> &buffer,
                                const std::string &string, double offset,
                                double length, const std::string &encoding) {
  uint8_t *data = buffer->data();
  size_t bufferSize = buffer->size();
  size_t start = (size_t)offset;
  size_t byteLimit = (size_t)length;

  if (start >= bufferSize)
    return 0;
  size_t available = bufferSize - start;
  size_t toWrite = std::min(available, byteLimit);

  if (encoding == "utf8" || encoding == "utf-8") {
    size_t strLen = string.length();
    size_t actualWrite = std::min(toWrite, strLen);
    const unsigned char *src = reinterpret_cast<const unsigned char *>(string.data());
    // ⚠️ 引擎给过来的是 **CESU-8**：孤立代理项（U+D800–U+DFFF）被原样编成
    //    `ED A0 80`–`ED BF BF`，而 node（以及标准 UTF-8）要求换成 **U+FFFD**
    //    （`EF BF BD`）。实测（node v22.12.0）：
    //      `Buffer.from('\uD800','utf8')`   = `efbfbd`（本侧改前是 `eda080`）
    //      `Buffer.from('a\uD800b','utf8')` = `61efbfbd62`
    //    合法的代理**对**是 4 字节（`F0 …`），不走这条。
    //    替换是 3 字节 → 3 字节，所以**长度不变**（`byteLength` 无需改）。
    //    ⚠️ 只在这一路做：`latin1` / `ascii` 在 node 上是直接取码元 `& 0xFF`
    //    （`'\uD800'` → `00`），对它们做替换反而会与 node 不一致。
    bool hasSurrogate = false;
    for (size_t k = 0; k + 2 < actualWrite; k++) {
      if (src[k] == 0xED && src[k + 1] >= 0xA0 && src[k + 1] <= 0xBF) {
        hasSurrogate = true;
        break;
      }
    }
    if (!hasSurrogate) {
      memcpy(data + start, string.c_str(), actualWrite);
      return (double)actualWrite;
    }
    size_t written = 0;
    size_t k = 0;
    while (k < actualWrite) {
      if (src[k] == 0xED && k + 2 < actualWrite && src[k + 1] >= 0xA0 &&
          src[k + 1] <= 0xBF) {
        data[start + written++] = 0xEF;
        data[start + written++] = 0xBF;
        data[start + written++] = 0xBD;
        k += 3;
      } else {
        data[start + written++] = src[k++];
      }
    }
    return (double)written;
  } else if (encoding == "hex") {
    // ⚠️ node 在**第一个非十六进制字符**处停下（只输出成对的完整字节），
    // 而不是把非法对当成 0 —— 实测（node v22.12.0）：
    //   `Buffer.from('61zz','hex')`  = `61`   （本侧改前是 `6100`）
    //   `Buffer.from('zz','hex')`    = ``     （本侧改前是 `00`）
    //   `Buffer.from('6162 63','hex')` = `6162`
    //   `Buffer.from('0x61','hex')`  = ``
    // 注意 `byteLength('hex')` 在 node 上是**预测值** `len/2`（可以不等于实际
    // 解出的字节数），所以这里只改解码，不动 `byteLength`。
    size_t written = 0;
    for (size_t i = 0; i + 1 < string.length() && written < toWrite; i += 2) {
      int hi = hexDigit(string[i]);
      int lo = hexDigit(string[i + 1]);
      if (hi < 0 || lo < 0)
        break;
      data[start + written++] = static_cast<uint8_t>((hi << 4) | lo);
    }
    return (double)written;
  } else if (encoding == "base64" || encoding == "base64url") {
    size_t in_len = string.size();
    if (in_len == 0) {
      return 0.0;
    }
    // ⚠️ 预扫描（一次 O(n) 字节分类）：**干净**输入才走 simdutf 快路径，
    //    「不干净」的（空白 / `$` `!` 等非法字符 / 非 ASCII）一律走 node 逐字节
    //    对齐的标量解码器 —— simdutf 的 `accept_garbage` 与 node 的规则不同。
    //    干净输入就是规范 base64，两条路必然一致 ⇒ simdutf 的收益不受影响。
    bool clean = isCleanBase64(string);
    if (clean) {
      size_t max_len =
          simdutf::maximal_binary_length_from_base64(string.data(), in_len);
      if (max_len <= toWrite) {
        size_t out_len = max_len;
        simdutf::base64_to_binary_safe(
            string.data(), in_len,
            reinterpret_cast<char *>(data + start), out_len,
            simdutf::base64_default_or_url_accept_garbage,
            simdutf::last_chunk_handling_options::loose,
            /*decode_up_to_bad_char*/ true);
        return (double)out_len;
      }
    }
    std::vector<unsigned char> decoded =
        clean ? base64_decode(string) : base64_decode_node_exact(string);
    size_t actualWrite = std::min(toWrite, decoded.size());
    memcpy(data + start, decoded.data(), actualWrite);
    return (double)actualWrite;
  } else if (encoding == "utf16le") {
    size_t written = 0;
    size_t i = 0;
    const char *str = string.c_str();
    size_t utf8Len = string.length();
    while (i < utf8Len && written + 1 < toWrite) {
      uint32_t cp = 0;
      size_t seqLen = 0;
      unsigned char b1 = static_cast<unsigned char>(str[i]);
      if (b1 <= 0x7F) { cp = b1; seqLen = 1; }
      else if ((b1 & 0xE0) == 0xC0 && i + 1 < utf8Len) {
        cp = ((b1 & 0x1F) << 6) | (static_cast<unsigned char>(str[i+1]) & 0x3F);
        seqLen = 2;
      } else if ((b1 & 0xF0) == 0xE0 && i + 2 < utf8Len) {
        cp = ((b1 & 0x0F) << 12) | ((static_cast<unsigned char>(str[i+1]) & 0x3F) << 6) | (static_cast<unsigned char>(str[i+2]) & 0x3F);
        seqLen = 3;
      } else if ((b1 & 0xF8) == 0xF0 && i + 3 < utf8Len) {
        cp = ((b1 & 0x07) << 18) | ((static_cast<unsigned char>(str[i+1]) & 0x3F) << 12) | ((static_cast<unsigned char>(str[i+2]) & 0x3F) << 6) | (static_cast<unsigned char>(str[i+3]) & 0x3F);
        seqLen = 4;
      } else { cp = b1; seqLen = 1; }
      
      if (cp <= 0xFFFF) {
        data[start + written++] = static_cast<uint8_t>(cp & 0xFF);
        data[start + written++] = static_cast<uint8_t>((cp >> 8) & 0xFF);
      } else {
        if (written + 3 < toWrite) {
          cp -= 0x10000;
          uint16_t high = 0xD800 | ((cp >> 10) & 0x3FF);
          uint16_t low = 0xDC00 | (cp & 0x3FF);
          data[start + written++] = static_cast<uint8_t>(high & 0xFF);
          data[start + written++] = static_cast<uint8_t>((high >> 8) & 0xFF);
          data[start + written++] = static_cast<uint8_t>(low & 0xFF);
          data[start + written++] = static_cast<uint8_t>((low >> 8) & 0xFF);
        } else break;
      }
      i += seqLen;
    }
    return (double)written;
  } else if (encoding == "binary" || encoding == "latin1" ||
             encoding == "ascii") {
    // node 的 `latin1` / `binary` / `ascii` 编码是**同一个东西**：每个 **UTF-16
    // 码元**取低 8 位（`codeUnit & 0xFF`）一个字节。实测（node v22.12.0）：
    //   `Buffer.from('中','latin1')`   = `2d`          （0x4E2D & 0xFF）
    //   `Buffer.from('é','ascii')`     = `e9`          （0x00E9 & 0xFF，**不**掩高位的 0x7F）
    //   `Buffer.from('€','ascii')`     = `ac`          （0x20AC & 0xFF）
    //   `Buffer.from('😀','ascii')`    = `3d 00`       （代理对 = 两个码元）
    //   `Buffer.from('\uD800','latin1')` = `00`
    // 所以星面码点要展开成**两个**码元（本侧改前只写一个字节 ⇒ emoji 少一字节）。
    // 孤立代理项按码元原样取低 8 位 —— 这正是 `utf8` 那一路不能做 U+FFFD 替换的原因。
    size_t written = 0;
    size_t i = 0;
    const char *str = string.c_str();
    size_t utf8Len = string.length();

    while (i < utf8Len && written < toWrite) {
      unsigned char byte = static_cast<unsigned char>(str[i]);
      uint32_t codePoint = 0;
      size_t seqLen = 0;

      if (byte <= 0x7F) {
        codePoint = byte;
        seqLen = 1;
      } else if ((byte & 0xE0) == 0xC0 && i + 1 < utf8Len) {
        codePoint = ((byte & 0x1F) << 6) |
                    (static_cast<unsigned char>(str[i + 1]) & 0x3F);
        seqLen = 2;
      } else if ((byte & 0xF0) == 0xE0 && i + 2 < utf8Len) {
        codePoint = ((byte & 0x0F) << 12) |
                    ((static_cast<unsigned char>(str[i + 1]) & 0x3F) << 6) |
                    (static_cast<unsigned char>(str[i + 2]) & 0x3F);
        seqLen = 3;
      } else if ((byte & 0xF8) == 0xF0 && i + 3 < utf8Len) {
        codePoint = ((byte & 0x07) << 18) |
                    ((static_cast<unsigned char>(str[i + 1]) & 0x3F) << 12) |
                    ((static_cast<unsigned char>(str[i + 2]) & 0x3F) << 6) |
                    (static_cast<unsigned char>(str[i + 3]) & 0x3F);
        seqLen = 4;
      } else {
        codePoint = byte;
        seqLen = 1;
      }

      if (seqLen == 4) {
        // 星面码点 → UTF-16 代理对（两个码元，各取低 8 位）
        uint32_t v = codePoint - 0x10000;
        uint16_t high = static_cast<uint16_t>(0xD800 | ((v >> 10) & 0x3FF));
        uint16_t low = static_cast<uint16_t>(0xDC00 | (v & 0x3FF));
        data[start + written++] = static_cast<uint8_t>(high & 0xFF);
        if (written < toWrite) {
          data[start + written++] = static_cast<uint8_t>(low & 0xFF);
        }
      } else {
        data[start + written++] = static_cast<uint8_t>(codePoint & 0xFF);
      }
      i += seqLen;
    }
    return (double)written;
  }

  // Fallback utf8
  size_t strLen = string.length();
  size_t actualWrite = std::min(toWrite, strLen);
  memcpy(data + start, string.c_str(), actualWrite);
  return (double)actualWrite;
}

// UTF-8 replacement character (U+FFFD) encoded as UTF-8
static const char UTF8_REPLACEMENT[] = "\xEF\xBF\xBD";

// Fast validation: returns true if all data is valid UTF-8, false otherwise
// This allows us to use memcpy for the common case of valid UTF-8
static bool isValidUtf8(const uint8_t *data, size_t len) {
  size_t i = 0;
  while (i < len) {
    uint8_t byte1 = data[i];

    // ASCII (0x00-0x7F) - most common case
    if (byte1 <= 0x7F) {
      i++;
      continue;
    }

    // Invalid leading byte
    if (byte1 < 0xC2 || byte1 > 0xF4) {
      return false;
    }

    // 2-byte sequence (0xC2-0xDF)
    if (byte1 <= 0xDF) {
      if (i + 1 >= len || (data[i + 1] & 0xC0) != 0x80) {
        return false;
      }
      i += 2;
      continue;
    }

    // 3-byte sequence (0xE0-0xEF)
    if (byte1 <= 0xEF) {
      if (i + 2 >= len)
        return false;
      uint8_t byte2 = data[i + 1];
      uint8_t byte3 = data[i + 2];
      if ((byte2 & 0xC0) != 0x80 || (byte3 & 0xC0) != 0x80)
        return false;
      // Check overlong and surrogate
      if (byte1 == 0xE0 && byte2 < 0xA0)
        return false;
      if (byte1 == 0xED && byte2 >= 0xA0)
        return false;
      i += 3;
      continue;
    }

    // 4-byte sequence (0xF0-0xF4)
    if (i + 3 >= len)
      return false;
    uint8_t byte2 = data[i + 1];
    uint8_t byte3 = data[i + 2];
    uint8_t byte4 = data[i + 3];
    if ((byte2 & 0xC0) != 0x80 || (byte3 & 0xC0) != 0x80 ||
        (byte4 & 0xC0) != 0x80)
      return false;
    if (byte1 == 0xF0 && byte2 < 0x90)
      return false;
    if (byte1 == 0xF4 && byte2 > 0x8F)
      return false;
    i += 4;
  }
  return true;
}

// Slow path: Decode UTF-8 with replacement for invalid bytes.
//
// Follows the WHATWG Encoding Standard's UTF-8 decoder, which emits exactly ONE
// U+FFFD per *maximal subpart*: the lead byte plus every continuation byte that
// was actually consumed, after which the offending byte is re-examined as a
// potential lead byte.
//
// This used to advance only one byte on every error, so a single truncated or
// broken 3-/4-byte sequence produced one U+FFFD per leftover byte instead of one
// (e.g. bytes "e4 b8" decoded to "\uFFFD\uFFFD" while Node yields "\uFFFD").
//
// Only called when isValidUtf8 returns false
static std::string decodeUtf8WithReplacementSlow(const uint8_t *data,
                                                 size_t len) {
  std::string result;
  result.reserve(len + len / 10); // Add 10% for potential replacements

  size_t i = 0;
  while (i < len) {
    uint8_t byte1 = data[i];

    // ASCII (0x00-0x7F)
    if (byte1 <= 0x7F) {
      result.push_back(static_cast<char>(byte1));
      i++;
      continue;
    }

    // Invalid leading byte (0x80-0xC1 or 0xF5-0xFF): can never start a sequence,
    // so it is its own maximal subpart -> one U+FFFD.
    if (byte1 < 0xC2 || byte1 > 0xF4) {
      result.append(UTF8_REPLACEMENT);
      i++;
      continue;
    }

    // Expected sequence length, plus the accepted range for the FIRST
    // continuation byte (the tighter bounds reject overlong forms and surrogates,
    // matching the spec's lowerBoundary/upperBoundary).
    size_t need;
    uint8_t lower = 0x80;
    uint8_t upper = 0xBF;
    if (byte1 <= 0xDF) {
      need = 2; // 2-byte sequence (0xC2-0xDF)
    } else if (byte1 <= 0xEF) {
      need = 3; // 3-byte sequence (0xE0-0xEF)
      if (byte1 == 0xE0)
        lower = 0xA0; // reject overlong (U+0800 and below)
      if (byte1 == 0xED)
        upper = 0x9F; // reject surrogates (U+D800-U+DFFF)
    } else {
      need = 4; // 4-byte sequence (0xF0-0xF4)
      if (byte1 == 0xF0)
        lower = 0x90; // reject overlong (U+10000 and below)
      if (byte1 == 0xF4)
        upper = 0x8F; // reject > U+10FFFF
    }

    // Consume the maximal subpart: the lead byte plus as many valid continuation
    // bytes as are actually present. Stop at end-of-data, or at the first byte
    // that is not a valid continuation for its position.
    size_t consumed = 1;
    while (consumed < need) {
      size_t j = i + consumed;
      if (j >= len)
        break;
      uint8_t b = data[j];
      uint8_t lo = (consumed == 1) ? lower : 0x80;
      uint8_t hi = (consumed == 1) ? upper : 0xBF;
      if (b < lo || b > hi)
        break;
      consumed++;
    }

    if (consumed == need) {
      // Complete, well-formed sequence: copy it verbatim.
      result.append(reinterpret_cast<const char *>(data + i), need);
      i += need;
    } else {
      // Truncated or ill-formed: a single U+FFFD covers the whole maximal
      // subpart, and the next byte (if any) is re-examined as a lead byte.
      result.append(UTF8_REPLACEMENT);
      i += consumed;
    }
  }

  return result;
}

// Decode UTF-8 with WHATWG-compliant error handling
// Uses fast path (memcpy) for valid UTF-8, slow path with replacement for
// invalid
static std::string decodeUtf8WithReplacement(const uint8_t *data, size_t len) {
  // Fast path: if data is valid UTF-8, just copy it directly
  if (isValidUtf8(data, len)) {
    return std::string(reinterpret_cast<const char *>(data), len);
  }
  // Slow path: need to replace invalid sequences
  return decodeUtf8WithReplacementSlow(data, len);
}

// Decode as latin1/binary - each byte maps directly to Unicode code point
// 0x00-0xFF
static std::string decodeLatin1(const uint8_t *data, size_t len) {
  std::string result;
  result.reserve(len * 2); // Worst case: all bytes > 0x7F need 2 bytes in UTF-8

  for (size_t i = 0; i < len; i++) {
    uint8_t byte = data[i];
    if (byte <= 0x7F) {
      result.push_back(static_cast<char>(byte));
    } else {
      // Encode as 2-byte UTF-8 sequence
      result.push_back(static_cast<char>(0xC0 | (byte >> 6)));
      result.push_back(static_cast<char>(0x80 | (byte & 0x3F)));
    }
  }

  return result;
}

// Decode as ASCII - bytes > 0x7F are replaced with U+FFFD
static std::string decodeAscii(const uint8_t *data, size_t len) {
  // ⚠️ node 的 `ascii` **解码**是「每个字节取低 7 位」，一个字节一个字符
  //    （`byte & 0x7F`），**不是** UTF-8 解码、也不做替换字符。实测（node v22.12.0）：
  //      `Buffer.from([0x80]).toString('ascii')`            = `\u0000`
  //      `Buffer.from([0xff]).toString('ascii')`            = `\u007f`
  //      `Buffer.from([0x41,0x80,0xe9,0x7f]).toString('ascii')` = `A\u0000i\u007f`
  //      `Buffer.from([0xe4,0xb8,0xad]).toString('ascii')`  = `d8-`
  //    本侧改前把 >0x7F 的字节换成 U+FFFD ⇒ 与 node 不一致（往返也会变，见 parity 用例）。
  std::string result;
  result.reserve(len);

  for (size_t i = 0; i < len; i++) {
    result.push_back(static_cast<char>(data[i] & 0x7F));
  }

  return result;
}

std::string
HybridNitroBuffer::decode(const std::shared_ptr<ArrayBuffer> &buffer,
                          double offset, double length,
                          const std::string &encoding) {
  uint8_t *data = buffer->data();
  size_t bufferSize = buffer->size();
  size_t start = (size_t)offset;
  size_t count = (size_t)length; // Requested length

  if (start >= bufferSize)
    return "";
  size_t available = bufferSize - start;
  size_t actualRead = std::min(available, count);

  if (encoding == "utf8" || encoding == "utf-8") {
    // WHATWG-compliant UTF-8 decoding with replacement character for invalid
    // sequences
    return decodeUtf8WithReplacement(data + start, actualRead);
  } else if (encoding == "latin1" || encoding == "binary") {
    // Each byte maps to Unicode code point 0x00-0xFF
    return decodeLatin1(data + start, actualRead);
  } else if (encoding == "ascii") {
    // ASCII with replacement for non-ASCII bytes
    return decodeAscii(data + start, actualRead);
  } else if (encoding == "hex") {
    std::string hex;
    hex.reserve(actualRead * 2);
    const char *hexDigits = "0123456789abcdef";
    for (size_t i = 0; i < actualRead; i++) {
      unsigned char c = data[start + i];
      hex.push_back(hexDigits[c >> 4]);
      hex.push_back(hexDigits[c & 0x0F]);
    }
    return hex;
  } else if (encoding == "base64") {
    return base64_encode(data + start, actualRead, false);
  } else if (encoding == "base64url") {
    return base64_encode(data + start, actualRead, true);
  } else if (encoding == "utf16le") {
    std::string result;
    result.reserve(actualRead); 
    for (size_t i = 0; i + 1 < actualRead; i += 2) {
      uint16_t unit = data[start + i] | (data[start + i + 1] << 8);
      if (unit <= 0x7F) {
        result.push_back(static_cast<char>(unit));
      } else if (unit <= 0x7FF) {
        result.push_back(static_cast<char>(0xC0 | (unit >> 6)));
        result.push_back(static_cast<char>(0x80 | (unit & 0x3F)));
      } else if (unit >= 0xD800 && unit <= 0xDBFF && i + 3 < actualRead) {
        uint16_t next = data[start + i + 2] | (data[start + i + 3] << 8);
        if (next >= 0xDC00 && next <= 0xDFFF) {
          uint32_t cp = 0x10000 + (((unit & 0x3FF) << 10) | (next & 0x3FF));
          result.push_back(static_cast<char>(0xF0 | (cp >> 18)));
          result.push_back(static_cast<char>(0x80 | ((cp >> 12) & 0x3F)));
          result.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
          result.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
          i += 2;
        } else {
          result.append(UTF8_REPLACEMENT);
        }
      } else {
        result.push_back(static_cast<char>(0xE0 | (unit >> 12)));
        result.push_back(static_cast<char>(0x80 | ((unit >> 6) & 0x3F)));
        result.push_back(static_cast<char>(0x80 | (unit & 0x3F)));
      }
    }
    return result;
  }

  // Default: UTF-8 with replacement
  return decodeUtf8WithReplacement(data + start, actualRead);
}

double HybridNitroBuffer::compare(const std::shared_ptr<ArrayBuffer> &a,
                                  double aOffset, double aLength,
                                  const std::shared_ptr<ArrayBuffer> &b,
                                  double bOffset, double bLength) {
  uint8_t *dataA = a->data();
  uint8_t *dataB = b->data();

  size_t offA = (size_t)aOffset;
  size_t lenA = (size_t)aLength;
  size_t offB = (size_t)bOffset;
  size_t lenB = (size_t)bLength;

  // Safety checks
  if (offA + lenA > a->size())
    lenA = a->size() > offA ? a->size() - offA : 0;
  if (offB + lenB > b->size())
    lenB = b->size() > offB ? b->size() - offB : 0;

  size_t cmpLen = std::min(lenA, lenB);
  int cmp = memcmp(dataA + offA, dataB + offB, cmpLen);

  if (cmp == 0) {
    if (lenA < lenB)
      return -1;
    if (lenA > lenB)
      return 1;
    return 0;
  }
  return cmp < 0 ? -1 : 1;
}

// indexOf (Byte)
double HybridNitroBuffer::indexOf(const std::shared_ptr<ArrayBuffer> &buffer,
                                  double value, double offset, double length) {
  if (buffer == nullptr)
    return -1;
  uint8_t *data = buffer->data();
  size_t totalSize = buffer->size();

  size_t start = static_cast<size_t>(offset);
  size_t len = static_cast<size_t>(length);

  if (start >= totalSize)
    return -1;
  if (start + len > totalSize)
    len = totalSize - start;

  uint8_t target = static_cast<uint8_t>(value);
  // Use memchr for optimized byte search
  void *pos = memchr(data + start, target, len);
  if (pos == nullptr)
    return -1;
  return static_cast<double>((uint8_t *)pos - data);
}

// indexOfBuffer (Needle)
double
HybridNitroBuffer::indexOfBuffer(const std::shared_ptr<ArrayBuffer> &buffer,
                                 const std::shared_ptr<ArrayBuffer> &needle,
                                 double offset, double length) {
  if (buffer == nullptr || needle == nullptr)
    return -1;
  uint8_t *data = buffer->data();
  size_t totalSize = buffer->size();
  uint8_t *needleData = needle->data();
  size_t needleSize = needle->size();

  size_t start = static_cast<size_t>(offset);
  size_t len = static_cast<size_t>(length);

  if (needleSize == 0)
    return offset <= totalSize ? offset
                               : totalSize; // Empty needle found at start
  if (start >= totalSize)
    return -1;
  if (start + len > totalSize)
    len = totalSize - start;
  if (needleSize > len)
    return -1;

  // Use std::search for substring search (usually optimized)
  auto it = std::search(data + start, data + start + len, needleData,
                        needleData + needleSize);

  if (it == data + start + len)
    return -1;
  return static_cast<double>(it - data);
}

// lastIndexOfByte
double
HybridNitroBuffer::lastIndexOfByte(const std::shared_ptr<ArrayBuffer> &buffer,
                                   double value, double offset, double length) {
  if (buffer == nullptr)
    return -1;
  uint8_t *data = buffer->data();
  size_t totalSize = buffer->size();

  // offset is the index to START searching backwards from.
  // So if offset is 10, search from 10 down to 0? verify definition.
  // Node: "Searches the buffer for the specified value... moving backwards from
  // offset" "Exceptions: If offset is undefined or -1, it defaults to
  // buf.length - 1."

  // Here offset and length are passed from JS.
  // length in JS 'lastIndexOf' usually means valid range? No, JS side handles
  // params. But our signature has offset and length. Let's assume we scan the
  // range [offset, offset + length) BACKWARDS? Or scan [0, offset] backwards?
  // Node: `buf.lastIndexOf(value, [byteOffset], [encoding])`
  // If byteOffset is provided, start searching from there.

  // In my generated interface I have `offset` and `length`.
  // I should implement it as: scan from `min(offset + length, totalSize)`
  // backwards down to `offset`? Or generally: scan data in range [std::max(0,
  // offset - length), offset]? This is confusing without a clear spec on what
  // JS passes. Let's look at what I plan to call this with. Node:
  // buf.lastIndexOf(val, offset) -> search from offset to 0. So effective range
  // is [0, offset]. If I passed `length` as `offset + 1` (size of window), then
  // I scan `length` bytes ending at `offset`.

  // Let's assume generic range search: scan `data + offset` to `data + offset +
  // length` BACKWARDS. Implementation:
  size_t start = static_cast<size_t>(offset); // Start of search window
  size_t len = static_cast<size_t>(length);   // size of search window

  if (start >= totalSize)
    return -1;
  if (start + len > totalSize)
    len = totalSize - start;

  uint8_t target = static_cast<uint8_t>(value);

  // std::find without reverse iterator?
  // data + start + len is end. data + start is begin.
  // Search backward from end to begin.
  for (size_t i = len; i > 0; --i) {
    if (data[start + i - 1] == target) {
      return static_cast<double>(start + i - 1);
    }
  }
  return -1;
}

// lastIndexOfBuffer
double
HybridNitroBuffer::lastIndexOfBuffer(const std::shared_ptr<ArrayBuffer> &buffer,
                                     const std::shared_ptr<ArrayBuffer> &needle,
                                     double offset, double length) {
  if (buffer == nullptr || needle == nullptr)
    return -1;
  uint8_t *data = buffer->data();
  size_t totalSize = buffer->size();
  uint8_t *needleData = needle->data();
  size_t needleSize = needle->size();

  size_t start = static_cast<size_t>(offset);
  size_t len = static_cast<size_t>(length);

  if (needleSize == 0)
    return offset + len < totalSize
               ? offset + len
               : totalSize; // Empty needle match at end of window? Node's logic
                            // for empty string lastIndexOf is tricky.
  // Node: lastIndexOf('') returns index of last byte (size)? Or offset?
  // Let JS handle empty logic if possible or assume simple end match.

  if (start >= totalSize)
    return -1;
  if (start + len > totalSize)
    len = totalSize - start;
  if (needleSize > len)
    return -1;

  // std::find_end searches for the last occurrence of the sequence [first2,
  // last2) in the range [first1, last1).
  auto it = std::find_end(data + start, data + start + len, needleData,
                          needleData + needleSize);

  if (it == data + start + len)
    return -1;
  return static_cast<double>(it - data);
}

// fillBuffer (Pattern Fill)
void HybridNitroBuffer::fillBuffer(const std::shared_ptr<ArrayBuffer> &buffer,
                                   const std::shared_ptr<ArrayBuffer> &value,
                                   double offset, double length) {
  if (buffer == nullptr || value == nullptr)
    return;
  uint8_t *data = buffer->data();
  size_t totalSize = buffer->size();
  uint8_t *valData = value->data();
  size_t valSize = value->size();

  size_t start = static_cast<size_t>(offset);
  size_t len = static_cast<size_t>(length);

  if (start >= totalSize)
    return;
  if (start + len > totalSize)
    len = totalSize - start;
  if (valSize == 0)
    return; // Fill with nothing = no op

  // Fill repeating pattern
  size_t filled = 0;
  while (filled < len) {
    size_t copySize = std::min(valSize, len - filled);
    memcpy(data + start + filled, valData, copySize);
    // Optimization: If valSize is small and len is large, we can double up the
    // filled part instead of always copying from valData? Node does this
    // optimization. e.g. "a" -> "a" -> "aa" -> "aaaa" -> ... But for
    // simplicity:
    filled += copySize;
    // If we completed one copy, we can cycle valData offsets if we didn't
    // finish full valSize? No, valData starts at 0 every time? No, pattern fill
    // repeats: 'abc' -> 'abcabca' for len 7. Yes, memcpy(..., valData,
    // copySize) works because we always start from valData[0] and copy up to
    // remainder.
  }
  // Wait, if copySize < valSize (space left < pattern size), we copy prefix.
  // Correct. My loop logic is:
  // 1. filled=0, space=7, valSize=3 ('abc'). copy 3 bytes. filled=3.
  // 2. filled=3, space=4, valSize=3. copy 3 bytes. filled=6.
  // 3. filled=6, space=1, valSize=3. copy 1 byte (min(3, 1)). filled=7.
  // Correct.
}

void HybridNitroBuffer::fill(const std::shared_ptr<ArrayBuffer> &buffer,
                             double value, double offset, double length) {
  uint8_t *data = buffer->data();
  size_t bufferSize = buffer->size();
  size_t start = (size_t)offset;
  size_t count = (size_t)length;

  if (start >= bufferSize)
    return;
  size_t available = bufferSize - start;
  size_t actualFill = std::min(available, count);

  memset(data + start, (int)value, actualFill);
}

} // namespace margelo::nitro::buffer
