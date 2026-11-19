/**
 * Applies repository lint rules to host JavaScript feasibility tools.
 *
 * @file      eslint.config.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import Repository from "../../eslint.config.ts";

export default [ ...Repository, {
    files: [ "**/*.mjs" ],
    languageOptions: { globals: { Buffer: "readonly",
        URL: "readonly",
        console: "readonly",
        process: "readonly",
        structuredClone: "readonly" } },
    rules: {
        // JavaScript cannot contain TypeScript parameter annotations.
        "@typescript-eslint/typedef": "off",
        "no-console": "off"
    }
} ];
