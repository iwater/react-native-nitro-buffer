cmake_minimum_required(VERSION 3.10)
project(NitroBuffer)

set(CMAKE_CXX_STANDARD 20)

# Add custom implementation and JNI adapter
add_library(NitroBuffer SHARED
    OnLoad.cpp
    ../cpp/HybridNitroBuffer.cpp
)

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
