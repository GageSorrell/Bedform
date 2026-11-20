cmake_minimum_required(VERSION 3.30)

# Inspect the checked target before probing compilers or resolving any SDK libraries.
project(CinnabarNativeAbiProbe LANGUAGES NONE)
file(READ "${CMAKE_CURRENT_LIST_DIR}/../compatibility.json" compatibility)
string(JSON target_bds GET "${compatibility}" bedformBdsVersion)
string(JSON sdk_bds GET "${compatibility}" sdkBdsVersion)
string(JSON codec_bds GET "${compatibility}" importedServerVersion)
string(JSON qualification GET "${compatibility}" status)
if(NOT target_bds STREQUAL sdk_bds OR NOT target_bds STREQUAL codec_bds
   OR NOT qualification STREQUAL "qualified")
    message(FATAL_ERROR
        "Native feasibility unrun: required BDS ${target_bds}, SDK BDS ${sdk_bds}, "
        "codec/assets BDS ${codec_bds}, qualification ${qualification}. "
        "Resolve Bedform-8ww.1 before linking or loading this probe. No older BDS fallback.")
endif()
if(NOT WIN32 OR NOT CMAKE_HOST_SYSTEM_PROCESSOR MATCHES "AMD64|amd64|x86_64")
    message(FATAL_ERROR "The native feasibility probe requires Windows x64.")
endif()

# Dependencies must be explicitly supplied; configuration never installs or downloads them.
set(LEVILAMINA_INCLUDE_DIRECTORY "" CACHE PATH "Qualified LeviLamina include directory")
set(LEVILAMINA_IMPORT_LIBRARY "" CACHE FILEPATH "Qualified LeviLamina import library")
set(BEDROCK_IMPORT_LIBRARY "" CACHE FILEPATH "Qualified Bedrock import library")
foreach(required IN ITEMS LEVILAMINA_INCLUDE_DIRECTORY LEVILAMINA_IMPORT_LIBRARY BEDROCK_IMPORT_LIBRARY)
    if(NOT EXISTS "${${required}}")
        message(FATAL_ERROR "Native feasibility unrun: missing explicit ${required}.")
    endif()
endforeach()
enable_language(CXX)
if(NOT MSVC OR NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
    message(FATAL_ERROR "The native feasibility probe requires the Windows x64 MSVC ABI.")
endif()

# A link-only probe, deliberately without a loader entrypoint or install target.
add_library(CinnabarNativeAbiProbe MODULE AbiProbe.cpp)
target_compile_features(CinnabarNativeAbiProbe PRIVATE cxx_std_20)
target_include_directories(CinnabarNativeAbiProbe PRIVATE "${LEVILAMINA_INCLUDE_DIRECTORY}")
target_link_libraries(CinnabarNativeAbiProbe PRIVATE
    "${LEVILAMINA_IMPORT_LIBRARY}" "${BEDROCK_IMPORT_LIBRARY}")
