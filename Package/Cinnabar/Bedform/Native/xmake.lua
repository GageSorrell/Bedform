set_project("CinnabarNativeFeasibility")
set_xmakever("3.0.0")
set_allowedplats("windows")
set_allowedarchs("windows|x64")
add_rules("mode.release")
set_runtimes("MD")

add_repositories("levimc-repo https://github.com/LiteLDev/xmake-repo.git")
add_requires("levilamina 26.60.8", {configs = {target_type = "server"}})
add_requires("bedrockdata v26.60.6-server.16")
add_requires("levibuildscript 0.6.1")

rule("cinnabar.native_probe")
    on_load(function (target)
        import("core.base.json")
        local compatibility = json.loadfile(path.join(os.scriptdir(), "../compatibility.json"))
        assert(compatibility.status == "aligned"
            and compatibility.bedformBdsVersion == compatibility.sdkBdsVersion
            and compatibility.bedformBdsVersion == compatibility.importedServerVersion
            and compatibility.loaderVersion == "26.60.8"
            and compatibility.sdkVersion == "26.60.6-server.16",
            "Native feasibility requires the aligned LeviLamina and Bedrock SDK versions.")
    end)
rule_end()

set_kind("shared")
set_languages("c++20")
set_toolchains("clang-cl")
add_defines("NOMINMAX", "UNICODE", "_HAS_CXX23=1")
set_exceptions("none")
add_cxflags("/EHa", "/utf-8", "-Wno-invalid-offsetof")

target("CinnabarNativeAbiProbe")
    set_default(false)
    add_rules("cinnabar.native_probe", "@levibuildscript/linkrule")
    add_packages("levilamina", "bedrockdata")
    add_files("AbiProbe.cpp")

target("CinnabarNativeIdentityProbe")
    add_rules("cinnabar.native_probe", "@levibuildscript/linkrule")
    add_packages("levilamina", "bedrockdata")
    add_files("IdentityProbe.cpp")
