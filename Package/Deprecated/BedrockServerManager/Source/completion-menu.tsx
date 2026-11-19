/**
 * Controlled, bounded command-completion menu with descriptions and selected usage.
 *
 * @module bedrock-server-manager/completion-menu
 *
 * @file      completion-menu.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Box, Text } from "ink";
import type { CompletionState } from "./command-completion.js";
import { completionMenuRows } from "./completion-view.js";

/** Menu input is dispatched by the console before editor/submission handlers. */
interface CompletionMenuProps
{
    state: CompletionState;
    columns: number;
    maxRows?: number;
}

/** Selection remains visible as the bounded candidate window scrolls. */
const CompletionMenu = ({ state, columns, maxRows = 6 }: CompletionMenuProps) =>
{
    const rows = completionMenuRows(state, columns, maxRows);
    if (rows.length === 0)
    {
        return null;
    }
    return (
        <Box flexDirection="column"
            width={ Math.max(0, Math.floor(columns)) }>
            { rows.map((row: { kind: string; selected: boolean; text: string }, index: number) => (
                <Text key={ index }
                    wrap="truncate"
                    inverse={ row.selected }
                    dimColor={ row.kind === "usage" }
                    color={ row.kind === "candidate" ? "cyan" : undefined }>
                    { row.text }
                </Text>
            )) }
        </Box>
    );
};

export { CompletionMenu };
export type { CompletionMenuProps };
