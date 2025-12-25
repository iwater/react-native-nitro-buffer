#pragma once
#include "HybridNitroBufferSpec.hpp"
#include <NitroModules/ArrayBuffer.hpp>

namespace margelo::nitro::buffer {

class HybridNitroBuffer : public HybridNitroBufferSpec {
public:
  HybridNitroBuffer() : HybridObject(TAG), HybridNitroBufferSpec() {}

  // Allocation
  std::shared_ptr<ArrayBuffer> alloc(double size) override;
  std::shared_ptr<ArrayBuffer> allocUnsafe(double size) override;

  // Operations

  double byteLength(const std::string &string,
                    const std::string &encoding) override;
  double write(const std::shared_ptr<ArrayBuffer> &buffer,
               const std::string &string, double offset, double length,
               const std::string &encoding) override;
  std::string decode(const std::shared_ptr<ArrayBuffer> &buffer, double offset,
                     double length, const std::string &encoding) override;
  double compare(const std::shared_ptr<ArrayBuffer> &a, double aOffset,
                 double aLength, const std::shared_ptr<ArrayBuffer> &b,
                 double bOffset, double bLength) override;
  void fill(const std::shared_ptr<ArrayBuffer> &buffer, double value,
            double offset, double length) override;
  double indexOf(const std::shared_ptr<ArrayBuffer> &buffer, double value,
                 double offset, double length) override;
  double indexOfBuffer(const std::shared_ptr<ArrayBuffer> &buffer,
                       const std::shared_ptr<ArrayBuffer> &needle,
                       double offset, double length) override;
  double lastIndexOfByte(const std::shared_ptr<ArrayBuffer> &buffer,
                         double value, double offset, double length) override;
  double lastIndexOfBuffer(const std::shared_ptr<ArrayBuffer> &buffer,
                           const std::shared_ptr<ArrayBuffer> &needle,
                           double offset, double length) override;
  void fillBuffer(const std::shared_ptr<ArrayBuffer> &buffer,
                  const std::shared_ptr<ArrayBuffer> &value, double offset,
                  double length) override;
};

} // namespace margelo::nitro::buffer
