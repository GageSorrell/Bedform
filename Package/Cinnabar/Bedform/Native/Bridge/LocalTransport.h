#pragma once

#include <winsock2.h>
#include <chrono>
#include <cstdint>
#include <deque>
#include <filesystem>
#include <optional>
#include <string>
#include <string_view>
#include <utility>

namespace bedform::native {

using Clock = std::chrono::steady_clock;
inline constexpr std::size_t SessionFrameBytes = 64 * 1024 * 1024;
inline constexpr std::size_t PacketInputBytes = 1024 * 1024;
inline constexpr std::uint8_t BatchKind = 2;
inline constexpr std::uint8_t HandoffKind = 3;
inline constexpr std::uint8_t PackKind = 4;
inline constexpr std::uint8_t DisconnectKind = 6;
inline constexpr std::size_t PackChunkBytes = 4 * 1024 * 1024;

struct Socket {
    SOCKET value = INVALID_SOCKET;
    Socket() = default;
    explicit Socket(SOCKET socket) : value(socket) {}
    Socket(Socket const&) = delete;
    Socket& operator=(Socket const&) = delete;
    Socket(Socket&& other) noexcept : value(std::exchange(other.value, INVALID_SOCKET)) {}
    Socket& operator=(Socket&& other) noexcept;
    ~Socket() { close(); }
    explicit operator bool() const { return value != INVALID_SOCKET; }
    void close();
    static Socket listen(std::uint16_t port = 0);
    Socket accept() const;
    std::uint16_t port() const;
};

struct Channel {
    Socket socket;
    explicit Channel(Socket peer) : socket(std::move(peer)) {}
    std::string inbound;
    std::deque<std::string> outbound;
    std::size_t offset = 0;
    std::size_t queued = 0;
    Clock::time_point progress = Clock::now();

    bool read(std::size_t limit);
    bool send(std::string bytes, std::size_t limit = SessionFrameBytes);
    bool write();
    std::optional<std::string> popFrame(std::size_t limit);
};

struct HttpRequest {
    std::string token;
    std::string body;
};

bool validToken(std::string_view token);
bool tokenMatches(std::string_view first, std::string_view second);
std::string randomToken();
std::string sha256(std::string_view bytes);
bool executableMatches();
std::string readFile(std::filesystem::path const& path, std::size_t limit);
void appendWord(std::string& output, std::uint32_t value);
std::uint32_t readWord(std::string_view bytes);
void appendVaruint(std::string& output, std::uint32_t value);
std::optional<std::uint32_t> readVaruint(std::string_view& data);
std::string frame(std::string payload);
std::optional<HttpRequest> parseHttp(std::string_view data);
std::string httpResponse(int status, std::string const& text = {});

} // namespace bedform::native
