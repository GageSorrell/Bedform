/**
 * Blockbench io API declarations.
 *
 * @module blockbench-types/custom/io
 *
 * @file      io.d.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

declare global {
    function setupDragHandlers(): void;
    function loadModelFile(file: any, args?: any): void;
    function loadImages(files: any, event?: Event): Promise<void>;
    function unsupportedFileFormatMessage(file_name: string): void;
    namespace Extruder {
        function drawImage(file: any): void;
        function startConversion(formResult: any): void;
    }
}

export {};
