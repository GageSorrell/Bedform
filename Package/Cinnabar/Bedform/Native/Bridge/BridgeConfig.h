#pragma once

#include "ContractRead.h"
#include <map>

namespace bedform::native {

struct Pack {
    Json meta;
    std::string archive;
};

struct Config {
    std::string token;
    Json compatibility;
    std::uint16_t port;
    std::map<std::pair<std::string, std::string>, Pack> packs;

    static Config load(std::filesystem::path const& path);
};
} // namespace bedform::native
