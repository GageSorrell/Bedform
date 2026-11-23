// Offscreen D3D12 clear/copy/readback qualification; no client, account or visible window.
// Copyright (c) 2026 Gage Sorrell. Licensed under MIT.
#include <windows.h>
#include <d3d12.h>
#include <dxgi1_6.h>
#include <wrl/client.h>
#include <iostream>
#include <stdexcept>
#include <string>

using Microsoft::WRL::ComPtr;

static void Check(HRESULT result)
{
    if (FAILED(result)) throw std::runtime_error("D3D12 HRESULT " + std::to_string(result));
}

int main()
{
    try
    {
        DWORD_PTR allowed = 0, system = 0;
        if (!GetProcessAffinityMask(GetCurrentProcess(), &allowed, &system)) return 2;
        DWORD_PTR bounded = 0;
        for (unsigned bit = 0, count = 0; bit < sizeof(allowed) * 8 && count < 2; ++bit)
            if (allowed & (DWORD_PTR(1) << bit)) { bounded |= DWORD_PTR(1) << bit; ++count; }
        if (!SetProcessAffinityMask(GetCurrentProcess(), bounded)) return 3;
        ComPtr<IDXGIFactory4> factory;
        Check(CreateDXGIFactory1(IID_PPV_ARGS(&factory)));
        ComPtr<IDXGIAdapter1> adapter;
        ComPtr<ID3D12Device> device;
        bool software = false;
        for (UINT index = 0; factory->EnumAdapters1(index, &adapter) != DXGI_ERROR_NOT_FOUND; ++index)
        {
            DXGI_ADAPTER_DESC1 description{};
            Check(adapter->GetDesc1(&description));
            if (!(description.Flags & DXGI_ADAPTER_FLAG_SOFTWARE) &&
                SUCCEEDED(D3D12CreateDevice(adapter.Get(), D3D_FEATURE_LEVEL_12_0, IID_PPV_ARGS(&device)))) break;
            adapter.Reset();
        }
        if (!device)
        {
            software = true;
            Check(factory->EnumWarpAdapter(IID_PPV_ARGS(&adapter)));
            Check(D3D12CreateDevice(adapter.Get(), D3D_FEATURE_LEVEL_12_0, IID_PPV_ARGS(&device)));
        }
        DXGI_ADAPTER_DESC1 description{};
        Check(adapter->GetDesc1(&description));
        D3D12_COMMAND_QUEUE_DESC queueDescription{};
        ComPtr<ID3D12CommandQueue> queue;
        Check(device->CreateCommandQueue(&queueDescription, IID_PPV_ARGS(&queue)));
        ComPtr<ID3D12CommandAllocator> allocator;
        Check(device->CreateCommandAllocator(D3D12_COMMAND_LIST_TYPE_DIRECT, IID_PPV_ARGS(&allocator)));
        ComPtr<ID3D12GraphicsCommandList> commands;
        Check(device->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, allocator.Get(), nullptr,
            IID_PPV_ARGS(&commands)));
        D3D12_RESOURCE_DESC textureDescription{};
        textureDescription.Dimension = D3D12_RESOURCE_DIMENSION_TEXTURE2D;
        textureDescription.Width = textureDescription.Height = 1;
        textureDescription.DepthOrArraySize = textureDescription.MipLevels = 1;
        textureDescription.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
        textureDescription.SampleDesc.Count = 1;
        textureDescription.Flags = D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET;
        D3D12_HEAP_PROPERTIES gpuHeap{};
        gpuHeap.Type = D3D12_HEAP_TYPE_DEFAULT;
        ComPtr<ID3D12Resource> texture;
        Check(device->CreateCommittedResource(&gpuHeap, D3D12_HEAP_FLAG_NONE, &textureDescription,
            D3D12_RESOURCE_STATE_RENDER_TARGET, nullptr, IID_PPV_ARGS(&texture)));
        D3D12_DESCRIPTOR_HEAP_DESC rtvDescription{};
        rtvDescription.Type = D3D12_DESCRIPTOR_HEAP_TYPE_RTV;
        rtvDescription.NumDescriptors = 1;
        ComPtr<ID3D12DescriptorHeap> rtv;
        Check(device->CreateDescriptorHeap(&rtvDescription, IID_PPV_ARGS(&rtv)));
        auto handle = rtv->GetCPUDescriptorHandleForHeapStart();
        device->CreateRenderTargetView(texture.Get(), nullptr, handle);
        const float color[] = { 1, 0, 0.5f, 1 };
        commands->ClearRenderTargetView(handle, color, 0, nullptr);
        D3D12_RESOURCE_BARRIER barrier{};
        barrier.Type = D3D12_RESOURCE_BARRIER_TYPE_TRANSITION;
        barrier.Transition.pResource = texture.Get();
        barrier.Transition.Subresource = D3D12_RESOURCE_BARRIER_ALL_SUBRESOURCES;
        barrier.Transition.StateBefore = D3D12_RESOURCE_STATE_RENDER_TARGET;
        barrier.Transition.StateAfter = D3D12_RESOURCE_STATE_COPY_SOURCE;
        commands->ResourceBarrier(1, &barrier);
        D3D12_PLACED_SUBRESOURCE_FOOTPRINT footprint{};
        UINT64 size = 0;
        device->GetCopyableFootprints(&textureDescription, 0, 1, 0, &footprint, nullptr, nullptr, &size);
        D3D12_RESOURCE_DESC bufferDescription{};
        bufferDescription.Dimension = D3D12_RESOURCE_DIMENSION_BUFFER;
        bufferDescription.Width = size;
        bufferDescription.Height = bufferDescription.DepthOrArraySize = bufferDescription.MipLevels = 1;
        bufferDescription.SampleDesc.Count = 1;
        bufferDescription.Layout = D3D12_TEXTURE_LAYOUT_ROW_MAJOR;
        D3D12_HEAP_PROPERTIES cpuHeap{};
        cpuHeap.Type = D3D12_HEAP_TYPE_READBACK;
        ComPtr<ID3D12Resource> readback;
        Check(device->CreateCommittedResource(&cpuHeap, D3D12_HEAP_FLAG_NONE, &bufferDescription,
            D3D12_RESOURCE_STATE_COPY_DEST, nullptr, IID_PPV_ARGS(&readback)));
        D3D12_TEXTURE_COPY_LOCATION source{}, destination{};
        source.pResource = texture.Get();
        source.Type = D3D12_TEXTURE_COPY_TYPE_SUBRESOURCE_INDEX;
        destination.pResource = readback.Get();
        destination.Type = D3D12_TEXTURE_COPY_TYPE_PLACED_FOOTPRINT;
        destination.PlacedFootprint = footprint;
        commands->CopyTextureRegion(&destination, 0, 0, 0, &source, nullptr);
        Check(commands->Close());
        ID3D12CommandList* lists[] = { commands.Get() };
        queue->ExecuteCommandLists(1, lists);
        ComPtr<ID3D12Fence> fence;
        Check(device->CreateFence(0, D3D12_FENCE_FLAG_NONE, IID_PPV_ARGS(&fence)));
        Check(queue->Signal(fence.Get(), 1));
        HANDLE event = CreateEventW(nullptr, FALSE, FALSE, nullptr);
        if (!event) return 4;
        Check(fence->SetEventOnCompletion(1, event));
        DWORD wait = WaitForSingleObject(event, 30000);
        CloseHandle(event);
        if (wait != WAIT_OBJECT_0) return 5;
        void* mapped = nullptr;
        D3D12_RANGE range{ 0, 4 };
        Check(readback->Map(0, &range, &mapped));
        auto pixel = static_cast<const unsigned char*>(mapped);
        const bool verified = pixel[0] == 255 && pixel[1] == 0 &&
            (pixel[2] == 127 || pixel[2] == 128) && pixel[3] == 255;
        std::cout << "{\"backend\":\"D3D12\",\"software\":" << (software ? "true" : "false")
            << ",\"vendorId\":" << description.VendorId << ",\"deviceId\":" << description.DeviceId
            << ",\"pixel\":[" << unsigned(pixel[0]) << "," << unsigned(pixel[1]) << ","
            << unsigned(pixel[2]) << "," << unsigned(pixel[3]) << "],\"verified\":"
            << (verified ? "true" : "false") << "}\n";
        D3D12_RANGE written{ 0, 0 };
        readback->Unmap(0, &written);
        return verified ? 0 : 6;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << "\n";
        return 1;
    }
}
