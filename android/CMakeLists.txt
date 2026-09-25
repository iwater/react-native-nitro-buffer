cmake_minimum_required(VERSION 3.10)
project(NitroBuffer)

set(CMAKE_CXX_STANDARD 20)

# Add custom implementation and JNI adapter
add_library(NitroBuffer SHARED
    OnLoad.cpp
    ../cpp/HybridNitroBuffer.cpp
    ../cpp/simdutf.cpp
)

# Force both hash styles (sysv and gnu) for Android loader compatibility
target_link_options(NitroBuffer PRIVATE "-Wl,--hash-style=both")

# Include paths for our headers
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/../cpp
)

# Include the Nitrogen-generated CMake file (handles defines, sources, and linking)
include(${CMAKE_CURRENT_SOURCE_DIR}/../nitrogen/generated/android/NitroBuffer+autolinking.cmake)

# Link additional libraries
find_library(LOG_LIB log)
target_link_libraries(
    NitroBuffer
    ${LOG_LIB}
)

# Android 15 16KB page size alignment
if(ANDROID_ABI STREQUAL "arm64-v8a" OR ANDROID_ABI STREQUAL "x86_64")
    set(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} -Wl,-z,max-page-size=16384")
endif()
