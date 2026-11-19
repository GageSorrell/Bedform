/**
 * Prepares the standalone common pack artifact for Bedform npm distribution.
 *
 * @module bedform/Tool/PrepareCommon
 *
 * @file      PrepareCommon.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Build } from "../../../Addon/BedformCommon/Tool/Build.mjs";
import { fileURLToPath } from "node:url";

// Preparation runs only in the source workspace. Installed consumers read the packaged archive.
await Build(fileURLToPath(new URL("../Asset/", import.meta.url)));
