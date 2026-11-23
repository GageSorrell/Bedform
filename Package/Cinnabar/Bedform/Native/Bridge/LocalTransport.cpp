#include "LocalTransport.h"
#include "../../Contract/AutomationContract.h"

#include <windows.h>
#include <bcrypt.h>
#include <algorithm>
#include <array>
#include <charconv>
#include <cstring>
#include <fstream>
#include <span>
#include <stdexcept>
#include <vector>

namespace bedform::native {
namespace {
constexpr int TickIoBytes = 128 * 1024;
constexpr std::size_t HeaderBytes = 8192;

std::string hex(std::span<unsigned char const> bytes) {
    constexpr std::string_view digits = "0123456789abcdef";
    std::string output;
    output.reserve(bytes.size() * 2);
    for (auto byte : bytes) {
        output += digits[byte >> 4];
        output += digits[byte & 15];
    }
    return output;
}

bool nonblocking(Socket const& socket) {
    u_long mode = 1;
    return ioctlsocket(socket.value, FIONBIO, &mode) == 0;
}

std::filesystem::path imagePath(HMODULE module) {
    std::wstring path(32768, L'\0');
    auto length = GetModuleFileNameW(module, path.data(), static_cast<DWORD>(path.size()));
    if (!length || length >= path.size()) throw std::runtime_error("Cannot resolve loaded image path");
    path.resize(length);
    return path;
}

template<class Record>
Record readPe(std::string_view bytes, std::size_t offset) {
    if (offset > bytes.size() || sizeof(Record) > bytes.size() - offset) throw std::runtime_error("Truncated PE image");
    Record record;
    std::memcpy(&record, bytes.data() + offset, sizeof(record));
    return record;
}

std::string_view textSection(std::string_view bytes) {
    auto dos = readPe<IMAGE_DOS_HEADER>(bytes, 0);
    if (dos.e_magic != IMAGE_DOS_SIGNATURE || dos.e_lfanew < 0) return {};
    auto header = readPe<IMAGE_NT_HEADERS64>(bytes, dos.e_lfanew);
    if (header.Signature != IMAGE_NT_SIGNATURE || header.FileHeader.Machine != IMAGE_FILE_MACHINE_AMD64) return {};
    auto first = static_cast<std::size_t>(dos.e_lfanew) + offsetof(IMAGE_NT_HEADERS64, OptionalHeader) + header.FileHeader.SizeOfOptionalHeader;
    for (std::size_t index = 0; index < header.FileHeader.NumberOfSections; ++index) {
        auto section = readPe<IMAGE_SECTION_HEADER>(bytes, first + index * sizeof(IMAGE_SECTION_HEADER));
        if (std::memcmp(section.Name, ".text\0\0\0", 8) != 0) continue;
        if (section.PointerToRawData > bytes.size() || section.SizeOfRawData > bytes.size() - section.PointerToRawData) return {};
        return bytes.substr(section.PointerToRawData, section.SizeOfRawData);
    }
    return {};
}
} // namespace

Socket& Socket::operator=(Socket&& other) noexcept {
    if (this != &other) {
        close();
        value = std::exchange(other.value, INVALID_SOCKET);
    }
    return *this;
}

void Socket::close() {
    if (*this) closesocket(std::exchange(value, INVALID_SOCKET));
}

Socket Socket::listen(std::uint16_t port) {
    Socket socket(::socket(AF_INET, SOCK_STREAM, IPPROTO_TCP));
    if (!socket || !nonblocking(socket)) return {};
    BOOL exclusive = TRUE;
    if (setsockopt(socket.value, SOL_SOCKET, SO_EXCLUSIVEADDRUSE,
        reinterpret_cast<char const*>(&exclusive), sizeof(exclusive)) != 0) return {};
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (::bind(socket.value, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) != 0 ||
        ::listen(socket.value, SOMAXCONN) != 0) return {};
    return socket;
}

Socket Socket::accept() const {
    Socket peer(::accept(value, nullptr, nullptr));
    if (!peer || !nonblocking(peer)) return {};
    BOOL enabled = TRUE;
    setsockopt(peer.value, IPPROTO_TCP, TCP_NODELAY, reinterpret_cast<char const*>(&enabled), sizeof(enabled));
    return peer;
}

std::uint16_t Socket::port() const {
    sockaddr_in addr{};
    int length = sizeof(addr);
    if (getsockname(value, reinterpret_cast<sockaddr*>(&addr), &length) != 0) return 0;
    return ntohs(addr.sin_port);
}

bool Channel::read(std::size_t limit) {
    std::array<char, 16384> data;
    for (int budget = TickIoBytes; budget > 0;) {
        int count = recv(socket.value, data.data(), std::min(budget, static_cast<int>(data.size())), 0);
        if (count == SOCKET_ERROR) return WSAGetLastError() == WSAEWOULDBLOCK;
        if (count == 0) return false;
        if (inbound.size() + count > limit) throw std::length_error("Receive limit exceeded");
        inbound.append(data.data(), count);
        budget -= count;
        progress = Clock::now();
    }
    return true;
}

bool Channel::send(std::string bytes, std::size_t limit) {
    if (queued + bytes.size() > limit) return false;
    if (outbound.empty()) progress = Clock::now();
    queued += bytes.size();
    outbound.push_back(std::move(bytes));
    return true;
}

bool Channel::write() {
    for (int budget = TickIoBytes; !outbound.empty() && budget > 0;) {
        auto const& next = outbound.front();
        int count = ::send(socket.value, next.data() + offset,
            static_cast<int>(std::min<std::size_t>(budget, next.size() - offset)), 0);
        if (count == SOCKET_ERROR) return WSAGetLastError() == WSAEWOULDBLOCK;
        if (count == 0) return false;
        offset += count;
        queued -= count;
        budget -= count;
        progress = Clock::now();
        if (offset == next.size()) {
            offset = 0;
            outbound.pop_front();
        }
    }
    return true;
}

std::optional<std::string> Channel::popFrame(std::size_t limit) {
    if (inbound.size() < 4) return std::nullopt;
    auto size = readWord(inbound);
    if (!size || size > limit) throw std::length_error("Invalid frame length");
    if (inbound.size() < 4 + size) return std::nullopt;
    auto result = inbound.substr(4, size);
    inbound.erase(0, 4 + size);
    return result;
}

bool validToken(std::string_view token) {
    return token.size() == 64 && token.find_first_not_of("0123456789abcdef") == std::string_view::npos;
}

bool tokenMatches(std::string_view first, std::string_view second) {
    if (first.size() != second.size() || first.empty()) return false;
    unsigned diff = 0;
    for (std::size_t index = 0; index < first.size(); ++index) diff |= first[index] ^ second[index];
    return diff == 0;
}

std::string randomToken() {
    std::array<unsigned char, 32> bytes{};
    if (BCryptGenRandom(nullptr, bytes.data(), bytes.size(), BCRYPT_USE_SYSTEM_PREFERRED_RNG) != 0)
        throw std::runtime_error("Windows random generation failed");
    return hex(bytes);
}

std::string sha256(std::string_view bytes) {
    std::array<unsigned char, 32> digest{};
    BCRYPT_ALG_HANDLE algorithm{};
    if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) != 0)
        throw std::runtime_error("SHA-256 provider failed");
    auto result = BCryptHash(algorithm, nullptr, 0,
        reinterpret_cast<PUCHAR>(const_cast<char*>(bytes.data())), static_cast<ULONG>(bytes.size()), digest.data(), digest.size());
    BCryptCloseAlgorithmProvider(algorithm, 0);
    if (result != 0) throw std::runtime_error("SHA-256 failed");
    return hex(digest);
}

bool executableMatches() {
    auto path = imagePath(nullptr);
    DWORD unused = 0;
    auto size = GetFileVersionInfoSizeW(path.c_str(), &unused);
    if (!size) return false;
    std::vector<char> data(size);
    if (!GetFileVersionInfoW(path.c_str(), 0, size, data.data())) return false;
    void* value = nullptr;
    UINT versionSize = 0;
    if (!VerQueryValueW(data.data(), L"\\", &value, &versionSize) || versionSize < sizeof(VS_FIXEDFILEINFO)) return false;
    auto const& version = *static_cast<VS_FIXEDFILEINFO const*>(value);
    if (version.dwFileVersionMS != MAKELONG(26, 1) || version.dwFileVersionLS != MAKELONG(6, 60)) return false;
    auto preLoader = GetModuleHandleW(L"PreLoader.dll");
    if (!preLoader) return false;
    // The PreLoader import patch leaves BDS's executable section byte-identical to stock build 52886189.
    auto image = readFile(path, 512 * 1024 * 1024);
    auto text = textSection(image);
    return !text.empty() && sha256(text) == "e099004d5786bd0cbcc9360bb28d0abe94ec37834ffff793ce914acb3f065fcf" &&
        sha256(readFile(imagePath(preLoader), SessionFrameBytes)) == "5cab8d82f3c26012b4baa5a70822035b7c4474f13aa3d42135aaac609232874f" &&
        sha256(readFile(path.parent_path() / "bedrock_runtime_data", SessionFrameBytes)) == "6c3243839ccbf9a9971831463006b1d4b0f656032321e605a568bf1473e8297c";
}

std::string readFile(std::filesystem::path const& path, std::size_t limit) {
    std::ifstream input(path, std::ios::binary | std::ios::ate);
    auto size = input.tellg();
    if (!input || size < 0 || static_cast<std::uint64_t>(size) > limit) throw std::runtime_error("Invalid input file size");
    std::string bytes(static_cast<std::size_t>(size), '\0');
    input.seekg(0);
    if (!input.read(bytes.data(), static_cast<std::streamsize>(bytes.size()))) throw std::runtime_error("Input file read failed");
    return bytes;
}

void appendWord(std::string& output, std::uint32_t value) {
    for (int shift = 24; shift >= 0; shift -= 8) output += static_cast<char>((value >> shift) & 255);
}

std::uint32_t readWord(std::string_view bytes) {
    std::uint32_t value = 0;
    for (unsigned char byte : bytes.substr(0, 4)) value = (value << 8) | byte;
    return value;
}

void appendVaruint(std::string& output, std::uint32_t value) {
    for (; value >= 128; value >>= 7) output += static_cast<char>((value & 127) | 128);
    output += static_cast<char>(value);
}

std::optional<std::uint32_t> readVaruint(std::string_view& data) {
    std::uint32_t value = 0;
    for (int shift = 0; shift <= 28 && !data.empty(); shift += 7) {
        auto byte = static_cast<unsigned char>(data.front());
        data.remove_prefix(1);
        if (shift == 28 && byte > 15) return std::nullopt;
        value |= static_cast<std::uint32_t>(byte & 127) << shift;
        if (byte < 128) return value;
    }
    return std::nullopt;
}

std::string frame(std::string payload) {
    std::string result;
    result.reserve(4 + payload.size());
    appendWord(result, static_cast<std::uint32_t>(payload.size()));
    result += payload;
    return result;
}

std::optional<HttpRequest> parseHttp(std::string_view data) {
    auto end = data.find("\r\n\r\n");
    if (end == data.npos && data.size() <= HeaderBytes) return std::nullopt;
    if (end > HeaderBytes) throw std::length_error("HTTP headers exceed limit");
    auto headers = data.substr(0, end);
    auto first = headers.find("\r\n");
    if (headers.substr(0, first) != std::string("POST ") + std::string(automation::ControlPath) + " HTTP/1.1")
        throw std::invalid_argument("Invalid control request line");
    headers.remove_prefix(first == headers.npos ? headers.size() : first + 2);
    std::optional<std::size_t> length;
    std::optional<std::string_view> token;
    while (!headers.empty()) {
        auto next = headers.find("\r\n");
        auto field = headers.substr(0, next);
        headers.remove_prefix(next == headers.npos ? headers.size() : next + 2);
        auto colon = field.find(':');
        if (colon == 0 || colon == field.npos) throw std::invalid_argument("Invalid HTTP header");
        std::string name(field.substr(0, colon));
        for (char& c : name) if (c >= 'A' && c <= 'Z') c += 'a' - 'A';
        auto value = field.substr(colon + 1);
        value.remove_prefix(std::min(value.size(), value.find_first_not_of(" \t")));
        if (name == "content-length") {
            std::size_t bytes = 0;
            auto parsed = std::from_chars(value.data(), value.data() + value.size(), bytes);
            if (length || parsed.ec != std::errc{} || parsed.ptr != value.data() + value.size())
                throw std::invalid_argument("Invalid HTTP content length");
            if (bytes > automation::ControlBytes) throw std::length_error("HTTP body exceeds limit");
            length = bytes;
        } else if (name == "authorization") {
            if (token) throw std::invalid_argument("Duplicate HTTP authorization");
            token = value.starts_with("Bearer ") ? value.substr(7) : std::string_view{};
        } else if (name == "transfer-encoding") {
            throw std::invalid_argument("Unsupported HTTP framing");
        }
    }
    if (!length) throw std::invalid_argument("Missing HTTP content length");
    auto body = data.substr(end + 4);
    if (body.size() < *length) return std::nullopt;
    if (body.size() != *length) throw std::invalid_argument("Trailing HTTP data");
    return HttpRequest{std::string(token.value_or("")), std::string(body)};
}

std::string httpResponse(int status, std::string const& text) {
    auto reason = status == 200 ? "OK" : status == 413 ? "Payload Too Large" : "Bad Request";
    return "HTTP/1.1 " + std::to_string(status) + " " + reason + "\r\nConnection: close\r\n"
        "Content-Type: application/json\r\nContent-Length: " + std::to_string(text.size()) + "\r\n\r\n" + text;
}
} // namespace bedform::native
