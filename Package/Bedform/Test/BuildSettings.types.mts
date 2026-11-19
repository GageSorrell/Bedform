/**
 * Published build settings remain directly assignable to bundler options.
 *
 * @module bedform/Test/BuildSettings.types
 *
 * @file      BuildSettings.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { BuildOptions } from "esbuild";
import type { BuildSettings } from "../Source/Build/Settings.js";

declare const Settings: BuildSettings;
const Bundle: BuildOptions = Settings.bundle;
const Mode: "react-jsx" | "react-jsxdev" = Settings.typescript.jsx;
const Source: "bedform/DDUI" = Settings.typescript.jsxImportSource;
void [ Bundle, Mode, Source ];
