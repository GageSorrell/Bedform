/**
 * Prepares the independent Canvas archive for normal, pure and packed Bedform distributions.
 *
 * @module bedform/Tool/PrepareCanvas
 *
 * @file      PrepareCanvas.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Build } from "../../../Addon/BedformCanvas/Tool/Build.mjs";
import { fileURLToPath } from "node:url";

// Only source-workspace preparation invokes Canvas's independent builder.
await Build(fileURLToPath(new URL("../Asset/", import.meta.url)));
