#include "HybridNitroBuffer.hpp"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <iostream>
#include <vector>

namespace margelo::nitro::buffer {

static const char base64_chars[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static inline bool is_base64(unsigned char c) {
  return (isalnum(c) || (c == '+') || (c == '/'));
}

std::string base64_encode(const unsigned char *bytes_to_encode,
                          unsigned int in_len) {
  std::string ret;
  size_t output_len = 4 * ((in_len + 2) / 3);
  ret.resize(output_len);

  size_t i = 0;
  size_t j = 0;
  char *out = &ret[0];

  while (i + 2 < in_len) {
    uint32_t octet_a = bytes_to_encode[i++];
    uint32_t octet_b = bytes_to_encode[i++];
    uint32_t octet_c = bytes_to_encode[i++];

    uint32_t triple = (octet_a << 16) + (octet_b << 8) + octet_c;

    out[j++] = base64_chars[(triple >> 18) & 0x3F];
    out[j++] = base64_chars[(triple >> 12) & 0x3F];
    out[j++] = base64_chars[(triple >> 6) & 0x3F];
    out[j++] = base64_chars[triple & 0x3F];
  }

  if (i < in_len) {
    uint32_t octet_a = bytes_to_encode[i++];
    uint32_t octet_b = (i < in_len) ? bytes_to_encode[i++] : 0;
    uint32_t octet_c = 0; // Always 0 for the last one if we are here

    uint32_t triple = (octet_a << 16) + (octet_b << 8) + octet_c;

    out[j++] = base64_chars[(triple >> 18) & 0x3F];
    out[j++] = base64_chars[(triple >> 12) & 0x3F];

    if (in_len % 3 == 1) {
      // One byte remaining, two paddings
      out[j++] = '=';
      out[j++] = '=';
    } else {
      // Two bytes remaining, one padding
      out[j++] = base64_chars[(triple >> 6) & 0x3F];
      out[j++] = '=';
    }
  }

  return ret;
}
// Reverse lookup table for base64 decoding (255 = invalid)
static const unsigned char base64_decode_table[256] = {
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 62,  255,
    255, 255, 63,  52,  53,  54,  55,  56,  57,  58,  59,  60,  61,  255, 255,
    255, 255, 255, 255, 255, 0,   1,   2,   3,   4,   5,   6,   7,   8,   9,
    10,  11,  12,  13,  14,  15,  16,  17,  18,  19,  20,  21,  22,  23,  24,
    25,  255, 255, 255, 255, 255, 255, 26,  27,  28,  29,  30,  31,  32,  33,
    34,  35,  36,  37,  38,  39,  40,  41,  42,  43,  44,  45,  46,  47,  48,
    49,  50,  51,  255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255};

std::vector<unsigned char> base64_decode(std::string const &encoded_string) {
  size_t in_len = encoded_string.size();
  if (in_len == 0)
    return {};

  // Calculate output size
  size_t padding = 0;
  if (in_len > 0 && encoded_string[in_len - 1] == '=')
    padding++;
  if (in_len > 1 && encoded_string[in_len - 2] == '=')
    padding++;
  size_t output_len = (in_len * 3) / 4 - padding;

  std::vector<unsigned char> ret;
  ret.reserve(output_len);

  const unsigned char *in =
      reinterpret_cast<const unsigned char *>(encoded_string.data());
  size_t i = 0;

  while (i + 3 < in_len) {
    unsigned char a = base64_decode_table[in[i++]];
    unsigned char b = base64_decode_table[in[i++]];
    unsigned char c = base64_decode_table[in[i++]];
    unsigned char d = base64_decode_table[in[i++]];

    if (a == 255 || b == 255)
      break;

    ret.push_back((a << 2) | (b >> 4));
    if (c != 255) {
      ret.push_back((b << 4) | (c >> 2));
      if (d != 255) {
        ret.push_back((c << 6) | d);
      }
    }
  }

  // Handle remaining bytes
  if (i < in_len) {
    unsigned char a = base64_decode_table[in[i++]];
    unsigned char b = (i < in_len) ? base64_decode_table[in[i++]] : 255;
    unsigned char c = (i < in_len) ? base64_decode_table[in[i++]] : 255;
    unsigned char d = (i < in_len) ? base64_decode_table[in[i++]] : 255;

    if (a != 255 && b != 255) {
      ret.push_back((a << 2) | (b >> 4));
      if (c != 255) {
        ret.push_back((b << 4) | (c >> 2));
        if (d != 255) {
          ret.push_back((c << 6) | d);
        }
      }
    }
  }

  return ret;
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
  if (encoding == "hex") {
    return string.length() / 2;
  } else if (encoding == "base64") {
    size_t len = string.length();
    if (len == 0)
      return 0;
    size_t padding = 0;
    if (len > 0 && string[len - 1] == '=')
      padding++;
    if (len > 1 && string[len - 2] == '=')
      padding++;
    return (len * 3) / 4 - padding;
  }
  // utf8 (default)
  return string.length();
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
    memcpy(data + start, string.c_str(), actualWrite);
    return actualWrite;
  } else if (encoding == "hex") {
    size_t strLen = string.length();
    size_t bytesCount = strLen / 2;
    size_t actualWrite = std::min(toWrite, bytesCount);
    for (size_t i = 0; i < actualWrite; i++) {
      std::string byteString = string.substr(i * 2, 2);
      unsigned char byte =
          (unsigned char)strtol(byteString.c_str(), nullptr, 16);
      data[start + i] = byte;
    }
    return actualWrite;
  } else if (encoding == "base64") {
    std::vector<unsigned char> decoded = base64_decode(string);
    size_t actualWrite = std::min(toWrite, decoded.size());
    memcpy(data + start, decoded.data(), actualWrite);
    return actualWrite;
  }

  // Fallback utf8
  size_t strLen = string.length();
  size_t actualWrite = std::min(toWrite, strLen);
  memcpy(data + start, string.c_str(), actualWrite);
  return actualWrite;
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

// Slow path: Decode UTF-8 with replacement for invalid bytes
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

    // Invalid leading byte (0x80-0xBF or 0xF8-0xFF)
    if (byte1 < 0xC2 || byte1 > 0xF4) {
      result.append(UTF8_REPLACEMENT);
      i++;
      continue;
    }

    // 2-byte sequence (0xC2-0xDF)
    if (byte1 <= 0xDF) {
      if (i + 1 >= len || (data[i + 1] & 0xC0) != 0x80) {
        result.append(UTF8_REPLACEMENT);
        i++;
        continue;
      }
      result.push_back(static_cast<char>(byte1));
      result.push_back(static_cast<char>(data[i + 1]));
      i += 2;
      continue;
    }

    // 3-byte sequence (0xE0-0xEF)
    if (byte1 <= 0xEF) {
      if (i + 2 >= len) {
        result.append(UTF8_REPLACEMENT);
        i++;
        continue;
      }
      uint8_t byte2 = data[i + 1];
      uint8_t byte3 = data[i + 2];
      if ((byte2 & 0xC0) != 0x80 || (byte3 & 0xC0) != 0x80 ||
          (byte1 == 0xE0 && byte2 < 0xA0) || (byte1 == 0xED && byte2 >= 0xA0)) {
        result.append(UTF8_REPLACEMENT);
        i++;
        continue;
      }
      result.push_back(static_cast<char>(byte1));
      result.push_back(static_cast<char>(byte2));
      result.push_back(static_cast<char>(byte3));
      i += 3;
      continue;
    }

    // 4-byte sequence (0xF0-0xF4)
    if (i + 3 >= len) {
      result.append(UTF8_REPLACEMENT);
      i++;
      continue;
    }
    uint8_t byte2 = data[i + 1];
    uint8_t byte3 = data[i + 2];
    uint8_t byte4 = data[i + 3];
    if ((byte2 & 0xC0) != 0x80 || (byte3 & 0xC0) != 0x80 ||
        (byte4 & 0xC0) != 0x80 || (byte1 == 0xF0 && byte2 < 0x90) ||
        (byte1 == 0xF4 && byte2 > 0x8F)) {
      result.append(UTF8_REPLACEMENT);
      i++;
      continue;
    }
    result.push_back(static_cast<char>(byte1));
    result.push_back(static_cast<char>(byte2));
    result.push_back(static_cast<char>(byte3));
    result.push_back(static_cast<char>(byte4));
    i += 4;
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
  std::string result;
  result.reserve(len);

  for (size_t i = 0; i < len; i++) {
    uint8_t byte = data[i];
    if (byte <= 0x7F) {
      result.push_back(static_cast<char>(byte));
    } else {
      result.append(UTF8_REPLACEMENT);
    }
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
    return base64_encode(data + start, (unsigned int)actualRead);
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
