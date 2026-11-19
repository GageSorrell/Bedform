/**
 * Console composition and injectable Ink rendering boundary.
 *
 * @module bedrock-server-manager/console-frame
 *
 * @file      console-frame.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Box, Text, render, useInput } from "ink";
import type { Key, RenderOptions } from "ink";
import type { ConsoleState } from "./console-state.js";
import type { ReactNode } from "react";

/** Controlled presentation slots; editor and output models own their behavior. */
interface ConsoleFrameProps
{
    instance: string;
    focus: ConsoleState["focus"];
    output: ReactNode;
    prompt: ReactNode;
    assistance?: ReactNode;
    onInput: (input: string, key: Key) => void;
}

/** Compose the output, assistance, prompt and persistent mode indicator. */
const ConsoleFrame = ({ instance, focus, output, prompt, assistance, onInput }: ConsoleFrameProps) =>
{
    useInput(onInput);
    return (
        <Box flexDirection="column">
            <Box flexDirection="column">{ output }</Box>
            { assistance }
            <Box>
                <Text>{ `BDS › ${instance} › ` }</Text>
                { prompt }
            </Box>
            <Text>{ focus === "input" ? "INPUT" : "OUTPUT" }</Text>
        </Box>
    );
};

/** Caller-supplied streams keep rendering isolated from global process I/O. */
interface ConsoleTerminal
{
    stdin: NodeJS.ReadStream;
    stdout: NodeJS.WriteStream;
    stderr: NodeJS.WriteStream;
}

/** Mount a foreground console; lifecycle handling remains the session owner's job. */
const renderConsole = (node: ReactNode, terminal: ConsoleTerminal, mount: typeof render = render) =>
{
    const options: RenderOptions = {
        ...terminal,
        alternateScreen: true,
        exitOnCtrlC: false,
        patchConsole: false
    };
    return mount(node, options);
};

export { ConsoleFrame, renderConsole };
export type { ConsoleFrameProps, ConsoleTerminal };
