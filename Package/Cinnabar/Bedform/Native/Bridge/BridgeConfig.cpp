#include "BridgeConfig.h"
#include "LocalTransport.h"
#include "../../Contract/AutomationContract.h"
#include "ll/api/Versions.h"

namespace bedform::native {
Config Config::load(std::filesystem::path const& path) {
    auto raw = parse(readFile(path, automation::ControlBytes));
    shape(raw, {"token", "port"}, {"packs"});
    auto pinsBytes = readFile(path.parent_path() / "compatibility.json", automation::ControlBytes);
    auto pins = parse(pinsBytes);
    if (pins.at("platform") != "windows-x64" || pins.at("status") != "aligned" ||
        pins.at("bedformBdsVersion") != "1.26.60.6" || pins.at("sdkBdsVersion") != "1.26.60.6" ||
        pins.at("loaderVersion") != "26.60.8" || pins.at("sdkVersion") != "26.60.6-server.16" ||
        pins.at("preLoaderVersion") != "1.16.8" || pins.at("wireProtocol") != 2225 ||
        ll::getLoaderVersion().to_string() != "26.60.8" || ll::getNetworkProtocolVersion() != 2225 ||
        !executableMatches()) reject("Incompatible", "Loaded BDS or loader does not match the pinned tuple");
    Config result{text(raw.at("token"), 64), {
        {"platform", "windows-x64"}, {"bdsVersion", "1.26.60.6"}, {"bdsBuild", 52886189}, {"wireProtocol", 2225},
        {"loaderVersion", "26.60.8"}, {"sdkVersion", "26.60.6-server.16"}, {"preLoaderVersion", "1.16.8"},
        {"compatibilitySha256", sha256(pinsBytes)}
    }, static_cast<std::uint16_t>(uint(raw.at("port"), 65535))};
    if (!validToken(result.token) || !result.port) reject("Malformed", "Expected a private token and a nonzero port");
    auto archives = raw.value("packs", Json::array());
    if (!archives.is_array() || archives.size() > 64) reject("Malformed", "Invalid pack archive catalog");
    std::size_t total = 0;
    for (auto const& entry : archives) {
        shape(entry, {"uuid", "version", "archive", "sha256"}, {"contentKey", "subPack"});
        auto digest = text(entry.at("sha256"), 64);
        auto uuid = text(entry.at("uuid"), 36);
        auto version = text(entry.at("version"), 64);
        auto archive = utf8Path(text(entry.at("archive"), 32767));
        auto bytes = readFile(path.parent_path() / archive, SessionFrameBytes);
        total += bytes.size();
        if (total > 256 * 1024 * 1024 || !validToken(digest) || sha256(bytes) != digest || bytes.empty())
            reject("Incompatible", "Pack archive failed its verified size or hash checks");
        auto hash = Json::array();
        for (std::size_t pos = 0; pos < digest.size(); pos += 2) {
            unsigned byte = 0;
            std::from_chars(digest.data() + pos, digest.data() + pos + 2, byte, 16);
            hash.push_back(byte);
        }
        if (!result.packs.emplace(std::pair{uuid, version}, Pack{{
            {"uuid", uuid}, {"version", version}, {"sub_pack", entry.value("subPack", "")},
            {"content_key", entry.value("contentKey", "")}, {"size", bytes.size()}, {"sha256", hash}
        }, std::move(bytes)}).second) reject("Malformed", "Duplicate resource-pack archive");
    }
    return result;
}
} // namespace bedform::native
