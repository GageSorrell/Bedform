/**
 * Registers version-aware `server.properties` IntelliSense with VS Code.
 *
 * Both the *Bedrock Dedicated Server Intellisense* and *Bedform Companion* extensions call
 * {@link RegisterServerPropertiesIntellisense}, each with its own configuration section and command
 * prefix.  The registration provides the following:
 *
 * - Completion of property names and values, triggered by typing or by `=`.
 * - Hover documentation for properties, including disabled `# key=` assignments.
 * - Diagnostics, refreshed as the document changes, and quick fixes for them.
 * - A status bar item that names the release whose schema applies and how it was chosen.
 * - Commands to choose a schema version by hand and to detect the server version again.
 *
 * Each file's schema is resolved by {@link ResolveSchema} from the extension's settings and any
 * version chosen by hand in this session.  Detection results are cached per server folder.  The
 * folder's executable and pack folders are watched, so open files follow server updates.
 *
 * @module bds-intellisense/VSCode/index
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Analysis from "../Analysis.js";
import * as Path from "node:path";
import * as Version from "../Version.js";
import * as vscode from "vscode";
import { BundledCatalog, BundledReleaseRange } from "../Schema/index.js";
import { Command, DiagnosticCode, DiagnosticSource, Setting } from "../Keys.js";
import { CreateDetectionCache,
    type DetectionCache,
    ResolveSchema,
    type ResolvedSchema } from "../Resolution.js";
import { type SchemaCatalog, SchemaForSetting } from "../Schema/Catalog.js";
import { clearTimeout, setTimeout } from "node:timers";
import type { BdsVersion } from "../Version.js";
import { ParseDocument } from "../Parser.js";
import type { ServerPropertiesSchema } from "../Schema/Types.js";
import type { TextSpan } from "../Parser.js";

/**
 * How an extension registers the IntelliSense.
 *
 * @category Types
 * @since 1.0.0
 */
export interface RegistrationOptions
{
    /** The schemas to use; the bundled catalog when omitted. */
    readonly Catalog?: SchemaCatalog;
    /** Prefixes the command names of {@link Command}, as in `bdsIntellisense.selectSchemaVersion`. */
    readonly CommandPrefix: string;
    /** The section holding the settings of {@link Setting}, as in `bdsIntellisense.detectVersion`. */
    readonly ConfigurationSection: string;
}

/**
 * The files the IntelliSense applies to: any file named `server.properties`.
 *
 * Matching by name rather than by language keeps the built-in `properties` highlighting.
 *
 * @category Constants
 * @since 1.0.0
 */
export const DocumentSelector: vscode.DocumentFilter = Object.freeze({ pattern: "**/server.properties" });

/** How long typing must pause before diagnostics are refreshed. */
const ValidationDelay: number = 200;

/** Server files whose changes can change the detected version, relative to the server folder. */
const WatchedPattern: string = "{bedrock_server.exe,behavior_packs/*,resource_packs/*}";

/** Severity names of the core analysis, mapped to VS Code's. */
const SeverityMap: Readonly<Record<Analysis.Severity, vscode.DiagnosticSeverity>> = Object.freeze({
    Error: vscode.DiagnosticSeverity.Error,
    Hint: vscode.DiagnosticSeverity.Hint,
    Information: vscode.DiagnosticSeverity.Information,
    Warning: vscode.DiagnosticSeverity.Warning
});

/**
 * A quick-pick entry of the schema-version command; without a version, it clears the manual choice.
 */
interface VersionPick extends vscode.QuickPickItem
{
    readonly Version?: BdsVersion;
}

/**
 * Converts a core span to a VS Code range.
 */
function ToRange(span: TextSpan): vscode.Range
{
    return new vscode.Range(span.Line, span.Start, span.Line, span.End);
}

/**
 * Describes the releases a schema applies to, such as `BDS 1.21.0 up to 1.21.40`.
 */
function DescribeSchema(catalog: SchemaCatalog, schema: ServerPropertiesSchema): string
{
    const index: number = catalog.Schemas.indexOf(schema);
    const next: ServerPropertiesSchema | undefined = catalog.Schemas[index + 1];
    return next === undefined
        ? `BDS ${Version.Format(schema.Version)} and later`
        : `BDS ${Version.Format(schema.Version)} up to ${Version.Format(next.Version)}`;
}

/**
 * The state and providers of one registration.
 */
class Registration implements vscode.Disposable
{
    private readonly cache: DetectionCache = CreateDetectionCache();

    private readonly catalog: SchemaCatalog;

    private readonly diagnostics: vscode.DiagnosticCollection;

    private readonly disposables: Array<vscode.Disposable> = [];

    /** Versions chosen by hand in this session, by document URI. */
    private readonly manual: Map<string, BdsVersion> = new Map<string, BdsVersion>();

    private readonly options: RegistrationOptions;

    /** Pending schema resolutions, by document URI. */
    private readonly resolutions: Map<string, Promise<ResolvedSchema>> =
        new Map<string, Promise<ResolvedSchema>>();

    private readonly status: vscode.StatusBarItem;

    /** Pending debounced validations, by document URI. */
    private readonly timers: Map<string, ReturnType<typeof setTimeout>> =
        new Map<string, ReturnType<typeof setTimeout>>();

    /** Fallback settings already warned about, so that each warning appears once. */
    private readonly warned: Set<string> = new Set<string>();

    /** Watchers of server folders, by folder path. */
    private readonly watchers: Map<string, vscode.FileSystemWatcher> =
        new Map<string, vscode.FileSystemWatcher>();

    /**
     * Creates the providers, commands and listeners, and checks the documents already open.
     */
    public constructor(options: RegistrationOptions)
    {
        this.options = options;
        this.catalog = options.Catalog ?? BundledCatalog;
        this.diagnostics = vscode.languages.createDiagnosticCollection(options.ConfigurationSection);
        this.status = vscode.window.createStatusBarItem(
            `${options.CommandPrefix}.schemaVersion`,
            vscode.StatusBarAlignment.Right,
            100);

        this.status.name = "server.properties Schema Version";
        this.status.command = this.CommandId(Command.SelectSchemaVersion);
        this.disposables.push(this.diagnostics, this.status);
        this.RegisterProviders();
        this.RegisterCommands();
        this.RegisterListeners();

        vscode.workspace.textDocuments.forEach((document: vscode.TextDocument) => this.Refresh(document));
        void this.UpdateStatus();
    }

    /**
     * Removes every provider, command, listener, watcher and diagnostic.
     */
    public dispose(): void
    {
        this.timers.forEach((timer: ReturnType<typeof setTimeout>) => clearTimeout(timer));
        this.watchers.forEach((watcher: vscode.FileSystemWatcher) => watcher.dispose());
        this.disposables.forEach((disposable: vscode.Disposable) => disposable.dispose());
        this.timers.clear();
        this.watchers.clear();
    }

    /**
     * The full identifier of one of this registration's commands.
     */
    private CommandId(command: string): string
    {
        return `${this.options.CommandPrefix}.${command}`;
    }

    /**
     * Whether a document is a `server.properties` file.
     */
    private Matches(document: vscode.TextDocument): boolean
    {
        return vscode.languages.match(DocumentSelector, document) > 0;
    }

    /**
     * The registration's settings for a document.
     */
    private Configuration(document: vscode.TextDocument): vscode.WorkspaceConfiguration
    {
        return vscode.workspace.getConfiguration(this.options.ConfigurationSection, document.uri);
    }

    /**
     * The folder of a document on disk, or `undefined` for documents elsewhere.
     */
    private ServerDirectory(document: vscode.TextDocument): string | undefined
    {
        return document.uri.scheme === "file" ? Path.dirname(document.uri.fsPath) : undefined;
    }

    /**
     * Resolves the schema of a document, reusing a resolution already made.
     */
    private async Resolve(document: vscode.TextDocument): Promise<ResolvedSchema>
    {
        const key: string = document.uri.toString();
        let resolution: Promise<ResolvedSchema> | undefined = this.resolutions.get(key);
        if (resolution === undefined)
        {
            const configuration: vscode.WorkspaceConfiguration = this.Configuration(document);
            const directory: string | undefined = this.ServerDirectory(document);
            const manual: BdsVersion | undefined = this.manual.get(key);
            if (directory !== undefined)
            {
                this.Watch(directory);
            }

            resolution = ResolveSchema(this.catalog, {
                DetectVersion: configuration.get<boolean>(Setting.DetectVersion, true),
                FallbackVersion: configuration.get<string>(Setting.FallbackVersion, "latest"),
                ...manual === undefined ? {} : { ManualVersion: manual }
            }, async () => directory === undefined ? undefined : await this.cache.Detect(directory));

            this.resolutions.set(key, resolution);
            void resolution.then((resolved: ResolvedSchema) => this.WarnAboutFallback(document, resolved));
        }

        return await resolution;
    }

    /**
     * Warns once per value when a fallback setting cannot be read.
     */
    private WarnAboutFallback(document: vscode.TextDocument, resolved: ResolvedSchema): void
    {
        const fallback: string = this.Configuration(document).get<string>(Setting.FallbackVersion, "latest");
        if (resolved.Origin !== "Fallback" || SchemaForSetting(this.catalog, fallback) !== undefined ||
            this.warned.has(fallback))
        {
            return;
        }

        this.warned.add(fallback);
        void vscode.window.showWarningMessage(
            `${this.options.ConfigurationSection}.${Setting.FallbackVersion} is "${fallback}", which is ` +
            "neither \"latest\" nor a version such as 1.21.0. The latest server.properties schema is used.");
    }

    /**
     * Watches a server folder, so that open files in it follow changes to the server.
     */
    private Watch(directory: string): void
    {
        if (this.watchers.has(directory))
        {
            return;
        }

        const watcher: vscode.FileSystemWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(vscode.Uri.file(directory), WatchedPattern));

        const changed: () => void = () => this.InvalidateDirectory(directory);
        watcher.onDidChange(changed);
        watcher.onDidCreate(changed);
        watcher.onDidDelete(changed);
        this.watchers.set(directory, watcher);
    }

    /**
     * Stops watching a server folder once no open file belongs to it.
     */
    private Unwatch(directory: string): void
    {
        const open: boolean = vscode.workspace.textDocuments.some((document: vscode.TextDocument) =>
            this.Matches(document) && this.ServerDirectory(document) === directory);

        if (!open)
        {
            this.watchers.get(directory)?.dispose();
            this.watchers.delete(directory);
        }
    }

    /**
     * Forgets the resolutions of files in a server folder and checks them again.
     */
    private InvalidateDirectory(directory: string): void
    {
        for (const document of vscode.workspace.textDocuments)
        {
            if (this.Matches(document) && this.ServerDirectory(document) === directory)
            {
                this.resolutions.delete(document.uri.toString());
                this.Refresh(document);
            }
        }
    }

    /**
     * Forgets every resolution and checks every open file again.
     */
    private InvalidateAll(): void
    {
        this.resolutions.clear();
        vscode.workspace.textDocuments.forEach((document: vscode.TextDocument) => this.Refresh(document));
    }

    /**
     * Validates a document now, and updates the status bar if it is the active one.
     */
    private Refresh(document: vscode.TextDocument): void
    {
        if (!this.Matches(document))
        {
            return;
        }

        void this.UpdateDiagnostics(document);
        if (vscode.window.activeTextEditor?.document === document)
        {
            void this.UpdateStatus();
        }
    }

    /**
     * Validates a document after typing pauses.
     */
    private Schedule(document: vscode.TextDocument): void
    {
        const key: string = document.uri.toString();
        const pending: ReturnType<typeof setTimeout> | undefined = this.timers.get(key);
        if (pending !== undefined)
        {
            clearTimeout(pending);
        }

        this.timers.set(key, setTimeout(() =>
        {
            this.timers.delete(key);
            void this.UpdateDiagnostics(document);
        }, ValidationDelay));
    }

    /**
     * Computes and publishes a document's diagnostics, unless diagnostics are turned off for it.
     */
    private async UpdateDiagnostics(document: vscode.TextDocument): Promise<void>
    {
        if (!this.Configuration(document).get<boolean>(Setting.DiagnosticsEnabled, true))
        {
            this.diagnostics.delete(document.uri);
            return;
        }

        const resolved: ResolvedSchema = await this.Resolve(document);
        if (document.isClosed)
        {
            return;
        }

        const found: Array<Analysis.Diagnostic> =
            Analysis.Validate(ParseDocument(document.getText()), resolved.Schema, this.catalog);

        this.diagnostics.set(document.uri, found.map((diagnostic: Analysis.Diagnostic) =>
        {
            const converted: vscode.Diagnostic = new vscode.Diagnostic(
                ToRange(diagnostic.Span),
                diagnostic.Message,
                SeverityMap[diagnostic.Severity]);

            converted.code = diagnostic.Code;
            converted.source = DiagnosticSource;
            return converted;
        }));
    }

    /**
     * Shows the active file's schema version in the status bar, or hides the item for other files.
     */
    private async UpdateStatus(): Promise<void>
    {
        const document: vscode.TextDocument | undefined = vscode.window.activeTextEditor?.document;
        if (document === undefined || !this.Matches(document))
        {
            this.status.hide();
            return;
        }

        const resolved: ResolvedSchema = await this.Resolve(document);
        if (vscode.window.activeTextEditor?.document !== document)
        {
            return;
        }

        const origin: string = resolved.Origin.toLowerCase();
        const fallback: string = this.Configuration(document).get<string>(Setting.FallbackVersion, "latest");
        const invalid: boolean = resolved.Origin === "Fallback" &&
            SchemaForSetting(this.catalog, fallback) === undefined;

        this.status.text = `${invalid ? "$(warning)" : "$(server-environment)"} ` +
            `BDS ${Version.Format(resolved.Version)} (${origin})`;

        const tooltip: vscode.MarkdownString = new vscode.MarkdownString(
            `**server.properties schema:** ${DescribeSchema(this.catalog, resolved.Schema)}\n\n` +
            resolved.Notes.map((note: string) => `- ${note.replace(/[\\`*_[\]]/gu, "\\$&")}`).join("\n") +
            "\n\nClick to choose a schema version.");

        this.status.tooltip = tooltip;
        this.status.show();
    }

    /**
     * Registers completion, hover and quick-fix providers.
     */
    private RegisterProviders(): void
    {
        this.disposables.push(vscode.languages.registerCompletionItemProvider(DocumentSelector, {
            provideCompletionItems: async (document: vscode.TextDocument, position: vscode.Position) =>
                await this.ProvideCompletions(document, position)
        }, "="));

        this.disposables.push(vscode.languages.registerHoverProvider(DocumentSelector, {
            provideHover: async (document: vscode.TextDocument, position: vscode.Position) =>
            {
                const resolved: ResolvedSchema = await this.Resolve(document);
                const hover: Analysis.HoverResult | undefined = Analysis.Hover(
                    ParseDocument(document.getText()),
                    {
                        Character: position.character,
                        Line: position.line
                    },
                    resolved.Schema,
                    this.catalog);

                return hover === undefined
                    ? undefined
                    : new vscode.Hover(new vscode.MarkdownString(hover.Markdown), ToRange(hover.Span));
            }
        }));

        this.disposables.push(vscode.languages.registerCodeActionsProvider(DocumentSelector, {
            provideCodeActions: async (
                document: vscode.TextDocument,
                _range: vscode.Range,
                context: vscode.CodeActionContext) => await this.ProvideCodeActions(document, context)
        }, { providedCodeActionKinds: [ vscode.CodeActionKind.QuickFix ] }));
    }

    /**
     * Converts the core's completion proposals.
     */
    private async ProvideCompletions(
        document: vscode.TextDocument,
        position: vscode.Position): Promise<Array<vscode.CompletionItem> | undefined>
    {
        const resolved: ResolvedSchema = await this.Resolve(document);
        const result: Analysis.CompletionResult | undefined = Analysis.Complete(
            ParseDocument(document.getText()),
            {
                Character: position.character,
                Line: position.line
            },
            resolved.Schema);

        if (result === undefined)
        {
            return undefined;
        }

        // VS Code requires the replaced range to contain the cursor, which may sit in whitespace.
        const range: vscode.Range = new vscode.Range(
            position.line,
            Math.min(result.Span.Start, position.character),
            position.line,
            Math.max(result.Span.End, position.character));

        return result.Items.map((proposal: Analysis.CompletionItem) =>
        {
            const item: vscode.CompletionItem = new vscode.CompletionItem(
                proposal.Label,
                proposal.Kind === "Property"
                    ? vscode.CompletionItemKind.Property
                    : vscode.CompletionItemKind.Value);

            item.insertText = proposal.IsSnippet
                ? new vscode.SnippetString(proposal.InsertText)
                : proposal.InsertText;
            item.range = range;
            item.sortText = proposal.SortText;
            item.detail = proposal.Detail;
            if (proposal.Documentation !== undefined)
            {
                item.documentation = new vscode.MarkdownString(proposal.Documentation);
            }

            return item;
        });
    }

    /**
     * Offers fixes for this registration's diagnostics in the requested range.  The suggestions
     * are recomputed, because VS Code passes back copies of the diagnostics it was given.
     */
    private async ProvideCodeActions(
        document: vscode.TextDocument,
        context: vscode.CodeActionContext): Promise<Array<vscode.CodeAction>>
    {
        const ours: Array<vscode.Diagnostic> = context.diagnostics.filter((diagnostic: vscode.Diagnostic) =>
            diagnostic.source === DiagnosticSource);

        if (ours.length === 0)
        {
            return [];
        }

        const resolved: ResolvedSchema = await this.Resolve(document);
        const found: Array<Analysis.Diagnostic> =
            Analysis.Validate(ParseDocument(document.getText()), resolved.Schema, this.catalog);

        const actions: Array<vscode.CodeAction> = [];
        for (const diagnostic of ours)
        {
            const match: Analysis.Diagnostic | undefined = found.find((candidate: Analysis.Diagnostic) =>
                candidate.Code === diagnostic.code && ToRange(candidate.Span).isEqual(diagnostic.range));

            if (match !== undefined)
            {
                actions.push(...this.FixesFor(document, diagnostic, match));
            }
        }

        return actions;
    }

    /**
     * The fixes for one diagnostic: its replacement suggestions, removal of a duplicate line, or a
     * schema choice for a property of another release.
     */
    private FixesFor(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic,
        match: Analysis.Diagnostic): Array<vscode.CodeAction>
    {
        const actions: Array<vscode.CodeAction> = match.Suggestions.map((suggestion: string, index: number) =>
        {
            const action: vscode.CodeAction = new vscode.CodeAction(
                suggestion === "" ? "Clear the value" : `Change to '${suggestion}'`,
                vscode.CodeActionKind.QuickFix);

            action.diagnostics = [ diagnostic ];
            action.isPreferred = index === 0;
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, diagnostic.range, suggestion);
            return action;
        });

        if (match.Code === DiagnosticCode.DuplicateProperty)
        {
            const action: vscode.CodeAction = new vscode.CodeAction(
                "Remove this duplicate line",
                vscode.CodeActionKind.QuickFix);

            action.diagnostics = [ diagnostic ];
            action.edit = new vscode.WorkspaceEdit();
            action.edit.delete(document.uri, document.lineAt(match.Span.Line).rangeIncludingLineBreak);
            actions.push(action);
        }

        if (match.Code === DiagnosticCode.UnsupportedProperty)
        {
            const action: vscode.CodeAction = new vscode.CodeAction(
                "Choose the server.properties schema version…",
                vscode.CodeActionKind.QuickFix);

            action.diagnostics = [ diagnostic ];
            action.command = {
                arguments: [ document.uri ],
                command: this.CommandId(Command.SelectSchemaVersion),
                title: "Choose the server.properties schema version"
            };
            actions.push(action);
        }

        return actions;
    }

    /**
     * Registers the schema-version and re-detection commands.
     */
    private RegisterCommands(): void
    {
        this.disposables.push(vscode.commands.registerCommand(
            this.CommandId(Command.SelectSchemaVersion),
            async (uri?: vscode.Uri) => await this.SelectSchemaVersion(uri)));

        this.disposables.push(vscode.commands.registerCommand(
            this.CommandId(Command.RedetectVersion),
            async () => await this.RedetectVersion()));
    }

    /**
     * Finds the `server.properties` document a command applies to: the given one, or the active one.
     */
    private CommandDocument(uri?: vscode.Uri): vscode.TextDocument | undefined
    {
        const document: vscode.TextDocument | undefined = uri === undefined
            ? vscode.window.activeTextEditor?.document
            : vscode.workspace.textDocuments.find((candidate: vscode.TextDocument) =>
                candidate.uri.toString() === uri.toString());

        return document !== undefined && this.Matches(document) ? document : undefined;
    }

    /**
     * Lets the user choose a schema version for a file, or return it to detection and fallback.
     */
    private async SelectSchemaVersion(uri?: vscode.Uri): Promise<void>
    {
        const document: vscode.TextDocument | undefined = this.CommandDocument(uri);
        if (document === undefined)
        {
            void vscode.window.showInformationMessage(
                "Open a server.properties file to choose its schema version.");
            return;
        }

        const resolved: ResolvedSchema = await this.Resolve(document);
        const key: string = document.uri.toString();
        const automatic: VersionPick = {
            description: this.manual.has(key) ? undefined : "current",
            detail: "Detect the server version, or use the fallback version setting when that fails.",
            label: "$(sync) Use detection and fallback"
        };

        const separator: VersionPick = {
            kind: vscode.QuickPickItemKind.Separator,
            label: `Bundled schemas (BDS ${Version.Format(BundledReleaseRange.Oldest)} to ` +
                `${Version.Format(BundledReleaseRange.Latest)})`
        };

        const versions: Array<VersionPick> = [ ...this.catalog.Schemas ].reverse().map(
            (schema: ServerPropertiesSchema): VersionPick => ({
                Version: schema.Version,
                description: [
                    schema === this.catalog.Latest ? "latest" : undefined,
                    schema === resolved.Schema ? "current" : undefined
                ].filter((part: string | undefined) => part !== undefined).join(", "),
                detail: DescribeSchema(this.catalog, schema),
                label: Version.Format(schema.Version)
            }));

        const picked: VersionPick | undefined = await vscode.window.showQuickPick(
            [ automatic, separator, ...versions ],
            {
                placeHolder: `Schema for ${vscode.workspace.asRelativePath(document.uri)}`,
                title: "server.properties Schema Version"
            });

        if (picked === undefined)
        {
            return;
        }

        if (picked.Version === undefined)
        {
            this.manual.delete(key);
        }
        else
        {
            this.manual.set(key, picked.Version);
        }

        this.resolutions.delete(key);
        this.Refresh(document);
    }

    /**
     * Forgets every detection result, checks every file again, and reports the active file's result.
     */
    private async RedetectVersion(): Promise<void>
    {
        this.cache.Clear();
        this.InvalidateAll();
        const document: vscode.TextDocument | undefined = this.CommandDocument();
        if (document === undefined)
        {
            return;
        }

        const resolved: ResolvedSchema = await this.Resolve(document);
        const message: string = resolved.Detected === undefined
            ? "No Bedrock Dedicated Server version was detected; using the " +
                `${resolved.Origin.toLowerCase()} schema for ` +
                `${DescribeSchema(this.catalog, resolved.Schema)}.`
            : `Detected BDS ${Version.Format(resolved.Detected.Version)}; using the schema for ` +
                `${DescribeSchema(this.catalog, resolved.Schema)}.`;

        void vscode.window.showInformationMessage(message);
    }

    /**
     * Registers listeners for document, editor and configuration changes.
     */
    private RegisterListeners(): void
    {
        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => this.Refresh(document)),
            vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) =>
            {
                if (this.Matches(event.document) && event.contentChanges.length > 0)
                {
                    this.Schedule(event.document);
                }
            }),
            vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) =>
            {
                const key: string = document.uri.toString();
                this.diagnostics.delete(document.uri);
                this.resolutions.delete(key);
                const timer: ReturnType<typeof setTimeout> | undefined = this.timers.get(key);
                if (timer !== undefined)
                {
                    clearTimeout(timer);
                    this.timers.delete(key);
                }

                const directory: string | undefined = this.ServerDirectory(document);
                if (directory !== undefined && this.Matches(document))
                {
                    this.Unwatch(directory);
                }
            }),
            vscode.window.onDidChangeActiveTextEditor(() => void this.UpdateStatus()),
            vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) =>
            {
                if (event.affectsConfiguration(this.options.ConfigurationSection))
                {
                    this.InvalidateAll();
                    void this.UpdateStatus();
                }
            }));
    }
}

/**
 * Registers `server.properties` IntelliSense, and adds the registration to the extension's
 * subscriptions so that it is removed when the extension deactivates.
 *
 * The returned disposable removes it earlier.
 *
 * @category Functions
 * @since 1.0.0
 */
export function RegisterServerPropertiesIntellisense(
    context: vscode.ExtensionContext,
    options: RegistrationOptions): vscode.Disposable
{
    const registration: Registration = new Registration(options);
    context.subscriptions.push(registration);
    return registration;
}

