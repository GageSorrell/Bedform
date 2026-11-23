// Uses the Windows SDK JSON reader to exercise the C++ boundary without BDS or an SDK loader.
#include "AutomationContract.h"

#include <algorithm>
#include <charconv>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <iterator>
#include <limits>
#include <string>
#include <winrt/Windows.Data.Json.h>
#include <winrt/Windows.Foundation.Collections.h>

void require(bool condition, std::string_view message) {
    if (!condition) {
        std::cerr << message << '\n';
        std::exit(1);
    }
}

template<class Integer>
Integer parse_id(winrt::hstring const& value) {
    auto text = winrt::to_string(value);
    Integer result{};
    auto end = text.data() + text.size();
    auto parsed = std::from_chars(text.data(), end, result);
    require(parsed.ec == std::errc{} && parsed.ptr == end, "Invalid decimal native ID");
    return result;
}

int main(int argc, char** argv) {
    using namespace bedform::automation;
    using winrt::Windows::Data::Json::JsonObject;
    require(argc == 2, "Supply vectors.json");
    winrt::init_apartment();
    std::ifstream file(argv[1], std::ios::binary);
    require(file.is_open(), "Unable to open vectors.json");
    std::string source(std::istreambuf_iterator<char>{file}, {});
    auto vectors = JsonObject::Parse(winrt::to_hstring(source));
    auto request = vectors.GetNamedObject(L"request");
    require(request.GetNamedNumber(L"v") == Version, "Wire version drift");
    require(winrt::to_string(request.GetNamedString(L"op")) == OperationCapabilities, "Operation drift");

    auto session = vectors.GetNamedObject(L"session");
    require(session.GetNamedNumber(L"generation") == 1, "Generation drift");
    auto player = session.GetNamedObject(L"player");
    auto entity = parse_id<std::int64_t>(player.GetNamedString(L"entityId"));
    auto runtime = parse_id<std::uint64_t>(player.GetNamedString(L"runtimeId"));
    require(entity == std::numeric_limits<std::int64_t>::min(), "Native unique ID drift");
    require(runtime == std::numeric_limits<std::uint64_t>::max(), "Native runtime ID drift");

    for (auto const& entry : vectors.GetNamedArray(L"input")) {
        auto vector = entry.GetObject();
        auto input = vector.GetNamedObject(L"command").GetNamedObject(L"input");
        auto action = winrt::to_string(input.GetNamedString(L"action"));
        auto recognized = std::ranges::find(Actions, action) != Actions.end();
        require(recognized == vector.GetNamedBoolean(L"valid"), "Action registry drift");
    }
}
