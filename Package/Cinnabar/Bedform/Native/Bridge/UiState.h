#pragma once

#include "mc/network/packet/SetTitlePacket.h"
#include <algorithm>
#include <map>
#include <optional>
#include <string>

namespace bedform::native {

// Track the renderer-visible UI that BDS addressed to an existing actor before attach.
class UiState {
    struct Entry { std::string packet; std::uint64_t expires; };
    std::map<int, Entry> entries;
    unsigned titleTicks = 100;

public:
    static bool applies(Packet const& packet) {
        switch (packet.getId()) {
        case MinecraftPacketIds::SetHudPacket:
        case MinecraftPacketIds::SetTitle:
        case MinecraftPacketIds::ShowModalForm:
        case MinecraftPacketIds::ClientboundDataDrivenUIShowScreen:
        case MinecraftPacketIds::ClientboundDataDrivenUICloseScreen: return true;
        default: return false;
        }
    }

    std::optional<int> update(Packet const& packet) {
        switch (packet.getId()) {
        case MinecraftPacketIds::SetHudPacket: return 10;
        case MinecraftPacketIds::ShowModalForm: return 11;
        case MinecraftPacketIds::ClientboundDataDrivenUIShowScreen: return 12;
        case MinecraftPacketIds::ClientboundDataDrivenUICloseScreen: entries.erase(12); return std::nullopt;
        case MinecraftPacketIds::SetTitle: {
            auto const& title = static_cast<SetTitlePacket const&>(packet);
            auto kind = static_cast<int>(title.mType);
            if (kind == 0 || kind == 1) {
                std::erase_if(entries, [](auto const& entry) { return entry.first < 10; });
                if (kind == 1) titleTicks = 100;
                return std::nullopt;
            }
            if (kind == 5) {
                titleTicks = static_cast<unsigned>(std::clamp(title.mFadeInTime, 0, 12000) +
                    std::clamp(title.mStayTime, 0, 12000) + std::clamp(title.mFadeOutTime, 0, 12000));
                return 0;
            }
            return kind >= 2 && kind <= 8 ? std::optional<int>(kind) : std::nullopt;
        }
        default: return std::nullopt;
        }
    }

    void remember(int key, std::string const& bytes, std::uint64_t tick) {
        if (bytes.size() <= 64 * 1024)
            entries[key] = {bytes, key > 0 && key < 10 ? tick + titleTicks : 0};
        else entries.erase(key);
    }

    void close(MinecraftPacketIds packet) {
        if (packet == MinecraftPacketIds::ModalFormResponse) entries.erase(11);
        if (packet == MinecraftPacketIds::ServerboundDataDrivenScreenClosed) entries.erase(12);
    }

    template<class Emit>
    void replay(std::uint64_t tick, Emit emit) const {
        for (auto const& [key, entry] : entries)
            if (entry.expires == 0 || tick < entry.expires) emit(entry.packet);
    }
};
} // namespace bedform::native
