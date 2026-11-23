#pragma once

#include <algorithm>
#include <charconv>
#include <cstdlib>
#include <filesystem>
#include <memory>
#include <nlohmann/json.hpp>
#include <string_view>

namespace bedform::native {
using Json = nlohmann::json;
inline constexpr std::uint64_t MaxSafeInt = 9007199254740991;

struct Refusal { std::string_view code; std::string_view message; bool retryable = false; };
[[noreturn]] inline void reject(std::string_view code, std::string_view message, bool retryable = false) {
    throw Refusal{code, message, retryable};
}

inline Json parse(std::string_view text) {
    auto value = Json::parse(text, [](int depth, Json::parse_event_t, Json&) {
        if (depth > 24) reject("Malformed", "JSON nesting exceeds the control limit");
        return true;
    }, false);
    if (value.is_discarded() || !value.is_object()) reject("Malformed", "Expected a JSON object");
    return value;
}

inline void shape(Json const& value, std::initializer_list<std::string_view> fields,
    std::initializer_list<std::string_view> optional = {}) {
    if (!value.is_object()) reject("Malformed", "Expected an object");
    for (auto field : fields) if (!value.contains(field)) reject("Malformed", "Missing protocol field");
    for (auto entry = value.begin(); entry != value.end(); ++entry)
        if (std::ranges::find(fields, entry.key()) == fields.end() &&
            std::ranges::find(optional, entry.key()) == optional.end()) reject("Malformed", "Unexpected protocol field");
}

inline std::string text(Json const& value, std::size_t max = 128) {
    if (!value.is_string()) reject("Malformed", "Expected a string");
    auto result = value.get<std::string>();
    if (result.empty() || result.size() > max) reject("Malformed", "String length outside bounds");
    return result;
}

inline std::string id(Json const& value) {
    auto result = text(value);
    constexpr auto alnum = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    if (std::string_view(alnum).find(result.front()) == std::string_view::npos ||
        result.find_first_not_of("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-") != std::string::npos)
        reject("Malformed", "Invalid identifier");
    return result;
}

inline std::uint64_t uint(Json const& value, std::uint64_t max = MaxSafeInt) {
    if (!value.is_number_unsigned() || value.get<std::uint64_t>() > max) reject("Malformed", "Integer outside bounds");
    return value.get<std::uint64_t>();
}

inline std::int64_t entityId(Json const& value) {
    auto number = text(value, 20);
    std::int64_t parsed{};
    auto result = std::from_chars(number.data(), number.data() + number.size(), parsed);
    if (result.ec != std::errc{} || result.ptr != number.data() + number.size() || std::to_string(parsed) != number)
        reject("Malformed", "Invalid signed native entity ID");
    return parsed;
}

inline std::string optionalEnv(char const* name) {
    char* value = nullptr;
    std::size_t length = 0;
    if (_dupenv_s(&value, &length, name) != 0) return {};
    std::unique_ptr<char, decltype(&std::free)> owner(value, std::free);
    return value ? std::string(value) : std::string{};
}

inline std::filesystem::path utf8Path(std::string_view path) {
    return std::filesystem::path(std::u8string(path.begin(), path.end()));
}

} // namespace bedform::native
