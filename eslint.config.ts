/**
 * Monorepo-wide ESLint configuration.
 *
 * @file      eslint.config.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 */

import { defineConfig, globalIgnores } from "eslint/config";

import JavaScript from "@eslint/js";
import Jsdoc from "eslint-plugin-jsdoc";
import Sorrell from "@sorrell/eslint-plugin";
import Stylistic from "@stylistic/eslint-plugin";
import TsPlugin from "@typescript-eslint/eslint-plugin";
import Tsdoc from "eslint-plugin-tsdoc";
import TypeScriptEslint from "typescript-eslint";
import { createRequire } from "node:module";
import unicorn from "eslint-plugin-unicorn";

const require = createRequire(import.meta.url);
const minecraftLinting = require("eslint-plugin-minecraft-linting");
const tsParser = require("@typescript-eslint/parser");

export default defineConfig(
    {
        files: [
            "Package/Deprecated/BDSIntellisense/Source/Schema/Generated/**/*.ts",
            "Package/Bedform/Source/Config.ts",
            "Package/Deprecated/Blockbench/types/generated/**/*.ts"
        ],
        linterOptions: { reportUnusedDisableDirectives: "off" }
    },
    {
        /* Entry modules of @bedform/* mirrors emitted by Script/sync-minecraft-mirrors.mts. *
         * Hand-written entries (Bedform, Effect and extended mirrors) keep the report.     */
        files: [ "Package/*/Source/index.ts" ],
        ignores: [ "Package/{Bedform,Effect,Server}/**" ],
        linterOptions: { reportUnusedDisableDirectives: "off" }
    },
    {
        files: [ "Addon/**/Script/**/*.{ts,mts,tsx}", "Addon/**/GameTest/**/*.{ts,mts,tsx}" ],
        languageOptions:
        {
            ecmaVersion: "latest",
            parser: tsParser
        },
        plugins: {
            "@typescript-eslint": TypeScriptEslint.plugin,
            "minecraft-linting": minecraftLinting,
            unicorn
        },
        rules: {
            ...(TsPlugin.configs.recommended.rules ?? {}),
            "minecraft-linting/avoid-unnecessary-command": "error",
            "no-restricted-imports": [ "error", {
                paths: [ "@minecraft/server-gametest" ],
                patterns: [ "**/GameTest/**", "**/Test/**" ]
            } ]
        }
    },
    {
        files: [ "Addon/**/GameTest/**/*.{ts,mts}" ],
        rules: { "no-restricted-imports": "off" }
    },
    {
        files: [ "Addon/**/Tool/**/*.mts", "Addon/**/Test/**/*.mts" ],
        languageOptions:
        {
            ecmaVersion: "latest",
            sourceType: "module"
        },
        rules:
        {
            "no-constant-condition": "error",
            "no-unreachable": "error"
        }
    },
    globalIgnores(
        [
            "**/Distribution/*",
            "**/node_modules/*",
            "**/dist/*",
            "**/Intermediate/*"
        ]
    ),
    {
        extends:
        [
            JavaScript.configs.recommended,
            TypeScriptEslint.configs.recommended
        ],
        files:
        [
            "**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}",
            "*.ts",
            "**/*.{ts,mts}"
        ],
        languageOptions:
        {
            /* eslint-disable-next-line unicorn/numeric-separators-style */
            ecmaVersion: 2022,
            parserOptions:
            {
                ecmaFeatures:
                {
                    jsx: true
                }
            },
            sourceType: "module"
        },
        plugins:
        {
            "@sorrell": Sorrell,
            "@stylistic": Stylistic,
            jsdoc: Jsdoc,
            tsdoc: Tsdoc,
            unicorn
        },
        rules:
        {
            "jsdoc/check-access": "error",
            "jsdoc/check-alignment": "error",
            "jsdoc/check-indentation": "off",
            "jsdoc/check-line-alignment": "error",
            "jsdoc/check-param-names": "error",
            "jsdoc/check-property-names": "error",
            "jsdoc/check-syntax": "error",
            "jsdoc/check-tag-names":
            [
                "error",
                {
                    definedTags: [ "note" ],
                    // This was previously set to `true` to address
                    // an issue of which I no longer remember the
                    // details. I have now set it to `false` so that
                    // `@property` works on JSDoc comments of types.
                    typed: false
                    // typed: true
                }
            ],
            "jsdoc/check-template-names": "error",
            "jsdoc/check-types": "error",
            "jsdoc/check-values": "error",
            "jsdoc/convert-to-jsdoc-comments": "off",
            "jsdoc/empty-tags": "error",
            "jsdoc/escape-inline-tags": "error",
            "jsdoc/implements-on-classes": "error",
            "jsdoc/imports-as-dependencies": "error",
            "jsdoc/informative-docs": "error",
            // Module headers immediately follow an executable's shebang.
            "jsdoc/lines-before-block": [ "error", { excludedTags: [ "type", "module" ] } ],
            "jsdoc/match-description": "error",
            "jsdoc/match-name": "off",
            "jsdoc/multiline-blocks": "error",
            "jsdoc/no-bad-blocks": "error",
            "jsdoc/no-blank-block-descriptions": "error",
            "jsdoc/no-blank-blocks": "error",
            "jsdoc/no-defaults": "error",
            "jsdoc/no-missing-syntax": "off",
            "jsdoc/no-multi-asterisks": "error",
            "jsdoc/no-restricted-syntax": "off",
            "jsdoc/no-types": "off",
            "jsdoc/no-undefined-types": "off",
            "jsdoc/prefer-import-tag": "error",
            "jsdoc/reject-any-type": "error",
            "jsdoc/reject-function-type": "error",
            "jsdoc/require-asterisk-prefix": "error",
            "jsdoc/require-description":
            [
                "error",
                {
                    checkGetters: false
                }
            ],
            "jsdoc/require-description-complete-sentence": "off",
            "jsdoc/require-example": "off",
            "jsdoc/require-file-overview": "error",
            "jsdoc/require-hyphen-before-param-description":
            [
                "error",
                "always"
            ],
            "jsdoc/require-jsdoc":
            [
                "error",
                {
                    contexts:
                    [
                        "ExportNamedDeclaration > TSTypeAliasDeclaration",
                        "ExportNamedDeclaration > TSInterfaceDeclaration",
                        "ExportNamedDeclaration > TSEnumDeclaration",
                        "ExportNamedDeclaration:has(> VariableDeclaration)",
                        "ExportNamedDeclaration > FunctionDeclaration",
                        "ExportNamedDeclaration > ClassDeclaration"
                    ]
                }
            ],
            "jsdoc/require-next-description": "error",
            "jsdoc/require-next-type": "error",
            "jsdoc/require-param": "off",
            "jsdoc/require-param-description": "error",
            "jsdoc/require-param-name": "off",
            "jsdoc/require-param-type": "off",
            "jsdoc/require-property": "error",
            "jsdoc/require-property-description": "error",
            "jsdoc/require-property-name": "error",
            "jsdoc/require-property-type": "error",
            "jsdoc/require-rejects": "off",
            "jsdoc/require-returns": "off",
            "jsdoc/require-returns-check": "error",
            "jsdoc/require-returns-description": "error",
            "jsdoc/require-returns-type": "error",
            "jsdoc/require-tags": "off",
            "jsdoc/require-template": "off",
            "jsdoc/require-template-description": "off",
            "jsdoc/require-throws": "error",
            "jsdoc/require-throws-description": "error",
            "jsdoc/require-throws-type": "error",
            "jsdoc/require-yields": "error",
            "jsdoc/require-yields-check": "error",
            "jsdoc/require-yields-description": "error",
            "jsdoc/require-yields-type": "error",
            "jsdoc/sort-tags":
            [
                "error",
                {
                    reportIntraTagGroupSpacing: false,
                    reportTagGroupSpacing: false,
                    tagSequence:
                    [
                        {
                            tags:
                            [
                                "file",
                                "author",
                                "copyright",
                                "license"
                            ]
                        }
                    ]
                }
            ],
            "jsdoc/tag-lines": "off",
            "jsdoc/text-escaping": "off",
            "jsdoc/ts-method-signature-style": "error",
            "jsdoc/ts-no-empty-object-type": "error",
            "jsdoc/ts-no-unnecessary-template-expression": "error",
            "jsdoc/ts-prefer-function-type": "error",
            "jsdoc/type-formatting": "off",
            "jsdoc/valid-types": "error",

            "one-var": [ "error", "never" ],

            "@sorrell/jsdoc-file-name": "error",
            "@sorrell/jsdoc-module-name-package": "error",
            "@sorrell/jsdoc-package-license": "error",

            "@stylistic/array-bracket-spacing":
            [
                "error",
                "always"
            ],
            "@stylistic/arrow-parens":
            [
                "error",
                "always"
            ],
            "@stylistic/arrow-spacing":
            [
                "error",
                {
                    after: true,
                    before: true
                }
            ],
            "@stylistic/brace-style":
            [
                "error",
                "allman",
                {
                    allowSingleLine: true
                }
            ],
            "@stylistic/comma-dangle":
            [
                "error",
                "never"
            ],
            "@stylistic/comma-spacing":
            [
                "error",
                {
                    after: true,
                    before: false
                }
            ],
            "@stylistic/dot-location":
            [
                "error",
                "property"
            ],
            "@stylistic/eol-last":
            [
                "error",
                "always"
            ],
            "@stylistic/function-call-spacing":
            [
                "error",
                "never"
            ],
            "@stylistic/indent":
            [
                "error",
                4
            ],
            "@stylistic/jsx-curly-spacing":
            [
                "error",
                {
                    when: "always"
                }
            ],
            "@stylistic/jsx-max-props-per-line":
            [
                "error",
                {
                    maximum: 1
                }
            ],
            "@stylistic/keyword-spacing":
            [
                "error",
                {
                    after: true,
                    before: true
                }
            ],
            "@stylistic/max-len":
            [
                "error",
                {
                    code: 110,
                    /* Ignore the end of import statements *
                     * because the path might be long.     */
                    ignorePattern: "\\{[^,]*\\bfrom\\b\\s*\"[^\"]*\";"
                }
            ],
            "@stylistic/max-statements-per-line":
            [
                "error",
                {
                    max: 1
                }
            ],
            "@stylistic/no-trailing-spaces": [ "error", { ignoreComments: true } ],
            "@stylistic/object-property-newline": [ "error", { allowAllPropertiesOnSameLine: false } ],
            "@stylistic/padding-line-between-statements":
            [
                "error",
                {
                    blankLine: "always",
                    next: "*",
                    prev: "block-like"
                }
            ],
            "@stylistic/semi": [ "error", "always" ],
            "@stylistic/space-infix-ops": "error",

            "@typescript-eslint/array-type":
            [
                "error",
                {
                    default: "generic"
                }
            ],
            "@typescript-eslint/consistent-type-imports": "off",
            // [
            //     "error",
            //     {
            //         prefer: "type-imports"
            //     }
            // ],
            "@typescript-eslint/naming-convention":
            [
                "error",
                {
                    filter:
                    {
                        match: true,
                        regex: "^_"
                    },
                    format:
                    [
                        "PascalCase",
                        "UPPER_CASE"
                    ],
                    leadingUnderscore: "require",
                    selector: "typeAlias"
                },
                {
                    custom:
                    {
                        match: true,
                        regex: "^(?:[A-Z][a-z].*|[A-Z][A-Z0-9_]*)$"
                    },
                    format:
                    [
                        "PascalCase",
                        "UPPER_CASE"
                    ],
                    selector: "typeAlias"
                },
                {
                    custom:
                    {
                        match: true,
                        regex: "^(?:[AEKRS]|[A-Z][a-z].+)$"
                    },
                    format:
                    [
                        "PascalCase"
                    ],
                    selector: "typeParameter"
                },
                {
                    custom:
                    {
                        match: true,
                        regex: "^[A-Z][a-z].+"
                    },
                    format:
                    [
                        "PascalCase"
                    ],
                    leadingUnderscore: "allow",
                    selector: "typeLike"
                },
                {
                    format:
                    [
                        "PascalCase",
                        "camelCase"
                    ],
                    leadingUnderscore: "allow",
                    selector: "parameter"
                },
                {
                    format:
                    [
                        "PascalCase",
                        "camelCase"
                    ],
                    leadingUnderscore: "allow",
                    selector: "variableLike"
                }
            ],
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-namespace": "off",
            "@typescript-eslint/no-unused-vars":
            [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_$"
                }
            ],
            "@typescript-eslint/typedef":
            [
                "error",
                {
                    arrayDestructuring: false,
                    arrowParameter: true,
                    memberVariableDeclaration: true,
                    objectDestructuring: false,
                    parameter: true,
                    propertyDeclaration: true,
                    variableDeclaration: false,
                    variableDeclarationIgnoreFunction: true
                }
            ],

            curly:
            [
                "error",
                "all"
            ],
            "no-console": [ "error", { allow: [ "warn", "error" ] } ],
            "no-multiple-empty-lines":
            [
                "error",
                {
                    max: 1,
                    maxBOF: 0,
                    maxEOF: 1
                }
            ],
            "quote-props":
            [
                "error",
                "as-needed"
            ],
            quotes:
            [
                "error",
                "double"
            ],
            "require-yield": "off",
            "sort-imports":
            [
                "error",
                {
                    ignoreCase: false,
                    ignoreDeclarationSort: false,
                    ignoreMemberSort: false,
                    memberSyntaxSortOrder:
                    [
                        "none",
                        "all",
                        "multiple",
                        "single"
                    ]
                }
            ],
            "sort-keys":
            [
                "error",
                "asc",
                {
                    allowLineSeparatedGroups: true,
                    caseSensitive: true,
                    minKeys: 2,
                    natural: false
                }
            ]
        },
        settings:
        {
            jsdoc:
            {
                mode: "typescript"
            }
        }
    },
    {
        rules:
        {
            "@sorrell/jsdoc-file-name": "error",
            "@typescript-eslint/no-require-imports": "off",
            "jsdoc/no-blank-block-descriptions": "off",
            "jsdoc/sort-tags":
            [
                "error",
                {
                    reportIntraTagGroupSpacing: false,
                    reportTagGroupSpacing: false,
                    tagSequence:
                    [
                        {
                            tags:
                            [
                                "module",
                                "internal",
                                "file",
                                "author",
                                "copyright",
                                "license"
                            ]
                        }
                    ]
                }
            ]
        }
    },
    {
        files: [ "Script/Deprecated/Demonstration/{Source,Test}/**/*.mts" ],
        languageOptions:
        {
            globals:
            {
                Buffer: "readonly",
                URL: "readonly",
                clearTimeout: "readonly",
                console: "readonly",
                fetch: "readonly",
                process: "readonly",
                setTimeout: "readonly"
            }
        },
        rules:
        {
            /* Strict tooling compiler checks inferred callback parameter types. */
            "@typescript-eslint/typedef": "off",
            "no-console": "off"
        }
    },
    {
        files: [ "Package/Deprecated/BedrockServerManager/Test/**/*.mts" ],
        languageOptions:
        {
            globals:
            {
                URL: "readonly",
                process: "readonly"
            }
        },
        rules: { "@typescript-eslint/typedef": "off" }
    },
    {
        files:
        [
            "*.ts",
            "*.js",
            "*.mjs",
            "**/*.ts",
            "**/*.js",
            "**/*.mjs"
        ],
        rules:
        {
            "unicorn/numeric-separators-style":
            [
                "error",
                {
                    number:
                    {
                        groupLength: 3,
                        minimumDigits: 4
                    },
                    onlyIfContainsSeparator: false
                }
            ]
        }
    },
    {
        files: [ "Addon/**/Tool/**/*.mts", "Script/**/*.mts" ],
        rules: { "no-console": "off" }
    },
    {
        files: [ "Script/bump-version.mts", "Script/sync-minecraft-mirrors.mts", "Script/WorldFixture.mts" ],
        rules:
        {
            // These root tools use the package's file-reference license, checked by the Sorrell rule.
            "jsdoc/check-values": [ "error", { allowedLicenses: true } ]
        }
    },
    {
        /* A test or tool that covers only MIT modules may say MIT; one *
         * that spans the package keeps its combined license.          */
        files: [ "Package/Effect/**/*.mts" ],
        rules:
        {
            "@sorrell/jsdoc-package-license":
            [
                "error",
                { aliases: { "MIT AND BSD-3-Clause": [ "MIT", "MIT AND BSD-3-Clause" ] } }
            ]
        }
    },
    {
        files: [ "Package/Effect/**/*.ts" ],
        rules:
        {
            /* The Unit and rational modules derive from BSD-3-Clause *
             * `effect-units`.  The rest of the package is MIT.       */
            "@sorrell/jsdoc-package-license":
            [
                "error",
                {
                    aliases: { "MIT AND BSD-3-Clause": [ "MIT" ] },
                    overrides:
                    {
                        "BSD-3-Clause":
                        [
                            "Source/Unit.ts",
                            "Source/Unit/**",
                            "Source/BigRational.ts",
                            "Source/Rational.ts",
                            "Source/Internal/valueObject.ts"
                        ]
                    }
                }
            ],
            "@typescript-eslint/naming-convention":
            [
                "error",
                /* Preserve pinned upstream protocol names and keyword-escape aliases. */
                {
                    filter: { match: true,
                        regex: "^(?:unifySymbol|typeSymbol|ignoreSymbol)$" },
                    format: null,
                    selector: "typeAlias"
                },
                {
                    filter: { match: true,
                        regex: "^(?:unassigned|unhandled)$" },
                    format: null,
                    selector: "interface"
                },
                {
                    filter: { match: true,
                        regex: "^(?:let_|try_|void_|Array_)$" },
                    format: [ "PascalCase", "camelCase" ],
                    selector: "variableLike",
                    trailingUnderscore: "allow"
                },
                {
                    filter:
                    {
                        match: true,
                        regex: "^_"
                    },
                    format:
                    [
                        "PascalCase",
                        "UPPER_CASE"
                    ],
                    leadingUnderscore: "require",
                    selector: "typeAlias",
                    trailingUnderscore: "allow"
                },
                {
                    custom:
                    {
                        match: true,
                        regex: "^(?:[A-Z][a-z].*|[A-Z][A-Z0-9_]*)$"
                    },
                    format:
                    [
                        "PascalCase",
                        "UPPER_CASE"
                    ],
                    selector: "typeAlias",
                    trailingUnderscore: "allow"
                },
                {
                    custom:
                    {
                        match: true,
                        regex: "^[A-Z][A-Za-z0-9]*$"
                    },
                    format:
                    [
                        "PascalCase"
                    ],
                    selector: "typeParameter"
                },
                {
                    custom:
                    {
                        match: true,
                        regex: "^[A-Z][a-z].+"
                    },
                    format:
                    [
                        "PascalCase"
                    ],
                    leadingUnderscore: "allow",
                    selector: "typeLike"
                },
                {
                    format:
                    [
                        "PascalCase",
                        "camelCase"
                    ],
                    leadingUnderscore: "allow",
                    selector: "parameter"
                },
                {
                    format:
                    [
                        "PascalCase",
                        "camelCase"
                    ],
                    leadingUnderscore: "allow",
                    selector: "variableLike"
                }
            ]
        }
    }
);
