#include "NitroBufferOnLoad.hpp"
#include <NitroModules/NitroDefines.hpp>
#include <jni.h>

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *reserved) {
  return margelo::nitro::buffer::initialize(vm);
}
