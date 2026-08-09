import { access } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import type * as acp from "@agentclientprotocol/sdk";
import { GrokClient } from "../acp/grokClient.js";
import type {
  ConnectionState,
  GrokEvent,
  PermissionMode,
  PromptAttachment,
} from "../acp/types.js";
import { PERMISSION_MODES } from "../acp/types.js";
import { cliOptions, runGrokCli } from "./cliRunner.js";
import { EditReviewService } from "./editReviewService.js";
import { resolveGrokExecutable } from "./executablePath.js";
import { discoverGrokModels } from "./grokModels.js";
import { buildGrokLaunchArguments } from "./launchConfiguration.js";
import { selectAutomaticPermissionOption } from "./permissionPolicy.js";
import {
  deleteSessionViaCli,
  exportSessionMarkdown,
  listLocalSessions,
  type GrokSessionSummary,
} from "./sessionService.js";
import { TerminalHost } from "./terminalHost.js";
import { WorkspaceHost } from "./workspaceHost.js";

interface PendingPermission {
  event: Extract<GrokEvent, { type: "permission_request" }>;
  resolve: (response: acp.RequestPermissionResponse) => void;
}

export class GrokController implements vscode.Disposable {
  private readonly listeners = new Set<(event: GrokEvent) => void>();
  private readonly pendingPermissions = new Map<string, PendingPermission>();
  private readonly editReview = new EditReviewService();
  private readonly terminalHost = new TerminalHost();
  private readonly seenDiffs = new Set<string>();
  private client: GrokClient | undefined;
  private unsubscribeClient: (() => void) | undefined;
  private state: ConnectionState = "disconnected";
  private stateDetail: string | undefined;
  private contextEvent: Extract<GrokEvent, { type: "context" }> | undefined;
  private runtimeEvent: Extract<GrokEvent, { type: "runtime" }> | undefined;
  private sessionEvent: Extract<GrokEvent, { type: "session" }> | undefined;
  private modelCatalogEvent: Extract<GrokEvent, { type: "model_catalog" }> | undefined;
  private sessionConfigEvent: Extract<GrokEvent, { type: "session_config" }> | undefined;
  private sessionModesEvent: Extract<GrokEvent, { type: "session_modes" }> | undefined;
  private currentModeEvent: Extract<GrokEvent, { type: "current_mode" }> | undefined;
  private usageEvent: Extract<GrokEvent, { type: "usage" }> | undefined;
  private cliStatusEvent: Extract<GrokEvent, { type: "cli_status" }> | undefined;
  private permissionSequence = 0;
  private resumeSessionId: string | undefined;

  constructor(private readonly output: vscode.OutputChannel) {}

  get connectionState(): ConnectionState {
    return this.state;
  }

  get activeSessionId(): string | undefined {
    return this.sessionEvent?.sessionId ?? this.client?.sessionId;
  }

  get initialEvents(): GrokEvent[] {
    const stateEvent: GrokEvent = this.stateDetail
      ? { type: "state", state: this.state, detail: this.stateDetail }
      : { type: "state", state: this.state };
    return [
      stateEvent,
      ...(this.contextEvent ? [this.contextEvent] : []),
      ...(this.cliStatusEvent ? [this.cliStatusEvent] : []),
      ...(this.runtimeEvent ? [this.runtimeEvent] : []),
      ...(this.sessionEvent ? [this.sessionEvent] : []),
      ...(this.modelCatalogEvent ? [this.modelCatalogEvent] : []),
      ...(this.sessionConfigEvent ? [this.sessionConfigEvent] : []),
      ...(this.sessionModesEvent ? [this.sessionModesEvent] : []),
      ...(this.currentModeEvent ? [this.currentModeEvent] : []),
      ...(this.usageEvent ? [this.usageEvent] : []),
      ...Array.from(this.pendingPermissions.values(), (pending) => pending.event),
    ];
  }

  onEvent(listener: (event: GrokEvent) => void): vscode.Disposable {
    this.listeners.add(listener);
    return new vscode.Disposable(() => this.listeners.delete(listener));
  }

  async connect(resumeSessionId?: string): Promise<void> {
    if (this.client?.connectionState === "connected" || this.client?.connectionState === "running") {
      return;
    }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      this.handleClientEvent({
        type: "state",
        state: "workspace_required",
        detail: "Open a folder to continue",
      });
      return;
    }

    if (this.client) {
      await this.client.stop();
      this.unsubscribeClient?.();
    }
    this.cancelPendingPermissions();
    this.seenDiffs.clear();
    this.resumeSessionId = resumeSessionId ?? this.resumeSessionId;

    const folder = folders[0]!;
    const config = vscode.workspace.getConfiguration("grokBuild");
    const executable = resolveGrokExecutable(config.get<string>("executablePath", "grok"));
    const grokEnvironment = {
      GROK_HOME: process.env.GROK_HOME || path.join(os.homedir(), ".grok"),
    };

    const cliOk = await this.probeExecutable(executable);
    if (!cliOk) {
      this.handleClientEvent({
        type: "cli_status",
        available: false,
        detail: `Grok CLI not found at '${executable}'. Install with: irm https://x.ai/cli/install.ps1 | iex`,
      });
      this.handleClientEvent({
        type: "state",
        state: "error",
        detail: `Grok CLI not found. Set grokBuild.executablePath or install the CLI.`,
      });
      return;
    }
    this.handleClientEvent({
      type: "cli_status",
      available: true,
      detail: executable,
    });

    const extraArguments = config.get<string[]>("extraArguments", []);
    const model = config.get<string>("model", "").trim();
    const reasoningEffort = config.get<string>("reasoningEffort", "").trim();
    const permissionMode = config.get<PermissionMode>("permissionMode", "ask");
    const sandbox = config.get<string>("sandbox", "").trim();
    const tools = config.get<string>("tools", "").trim();
    const deniedTools = config.get<string>("deniedTools", "").trim();
    const worktree = config.get<string>("worktree", "").trim();
    const worktreeRef = config.get<string>("worktreeRef", "").trim();
    const experimentalMemory = config.get<boolean>("experimentalMemory", false);
    const disableWebSearch = config.get<boolean>("disableWebSearch", false);
    const rules = config.get<string>("rules", "").trim();
    const maxTurns = config.get<number>("maxTurns", 0);
    const enableTerminal = config.get<boolean>("enableTerminal", true);

    this.refreshContext(this.formatWorkspaceName(folders));
    const catalog = await discoverGrokModels({
      executable,
      cwd: folder.uri.fsPath,
      environment: grokEnvironment,
    });
    this.handleClientEvent({
      type: "model_catalog",
      currentModel: model || catalog.defaultModel || "Default model",
      ...(catalog.defaultModel ? { defaultModel: catalog.defaultModel } : {}),
      models: catalog.models,
    });

    const additionalDirectories = folders.slice(1).map((item) => item.uri.fsPath);
    this.client = new GrokClient(
      {
        executable,
        arguments: buildGrokLaunchArguments({
          extraArguments,
          model,
          reasoningEffort,
          permissionMode,
          sandbox,
          tools,
          deniedTools,
          worktree,
          worktreeRef,
          experimentalMemory,
          disableWebSearch,
          rules,
          ...(maxTurns > 0 ? { maxTurns } : {}),
        }),
        cwd: folder.uri.fsPath,
        additionalDirectories,
        environment: grokEnvironment,
        enableTerminal,
        ...(this.resumeSessionId ? { resumeSessionId: this.resumeSessionId } : {}),
        mcpServers: [],
      },
      this.createHost(),
    );
    this.unsubscribeClient = this.client.onEvent((event) => this.handleClientEvent(event));

    try {
      await this.client.start();
      this.resumeSessionId = undefined;
    } catch (error) {
      this.output.appendLine(
        `[connect] ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async disconnect(): Promise<void> {
    this.cancelPendingPermissions();
    await this.client?.stop();
    this.unsubscribeClient?.();
    this.unsubscribeClient = undefined;
    this.client = undefined;
    this.handleClientEvent({ type: "state", state: "disconnected", detail: "Disconnected" });
  }

  async newSession(): Promise<void> {
    this.cancelPendingPermissions();
    this.seenDiffs.clear();
    this.resumeSessionId = undefined;
    if (!this.client || this.client.connectionState === "error") {
      await this.connect();
      return;
    }
    await this.client.newSession();
  }

  async resumeSession(sessionId: string): Promise<void> {
    this.resumeSessionId = sessionId;
    if (this.client && this.client.connectionState !== "error") {
      try {
        await this.client.loadSession(sessionId);
        this.resumeSessionId = undefined;
        return;
      } catch (error) {
        this.output.appendLine(
          `[resume] loadSession failed, reconnecting with --resume: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    await this.disconnect();
    await this.connect(sessionId);
  }

  async loadSession(sessionId: string): Promise<void> {
    return this.resumeSession(sessionId);
  }

  async listLocalSessions(): Promise<GrokSessionSummary[]> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return listLocalSessions(cwd ? { cwd } : {});
  }

  async prompt(text: string, attachments: PromptAttachment[] = []): Promise<void> {
    if (!this.client || this.client.connectionState === "error") {
      await this.connect();
    }
    const client = this.client;
    // "running" means a turn is in flight — webview should queue; reject clearly if it races.
    if (
      !client ||
      (client.connectionState !== "connected" && client.connectionState !== "running")
    ) {
      throw new Error("Grok Build could not connect.");
    }
    if (client.connectionState === "running") {
      throw new Error(
        "A turn is already running. The chat UI queues follow-ups and sends them when free.",
      );
    }
    const allowOutsideWorkspace = vscode.workspace
      .getConfiguration("grokBuild")
      .get<boolean>("allowOutsideWorkspace", false);
    for (const attachment of attachments) {
      if (attachment.data && attachment.mimeType) {
        continue;
      }
      const uri = vscode.Uri.parse(attachment.uri);
      if (uri.scheme !== "file") {
        throw new Error(`Unsupported attachment URI: ${attachment.uri}`);
      }
      if (!allowOutsideWorkspace && !vscode.workspace.getWorkspaceFolder(uri)) {
        throw new Error(`Attachment is outside the open workspace: ${uri.fsPath}`);
      }
    }
    await client.prompt(text, attachments);
  }

  async cancel(): Promise<void> {
    this.cancelPendingPermissions();
    await this.client?.cancel();
  }

  clearConversation(): void {
    this.broadcast({ type: "clear_conversation", reason: "manual" });
  }

  async setPermissionMode(mode: PermissionMode): Promise<void> {
    if (!PERMISSION_MODES.includes(mode)) {
      throw new Error(`Unsupported permission mode: ${mode}`);
    }
    await vscode.workspace
      .getConfiguration("grokBuild")
      .update("permissionMode", mode, vscode.ConfigurationTarget.Workspace);
    this.refreshContext();
  }

  async setSessionConfigOption(configId: string, value: string | boolean): Promise<void> {
    if (!this.client) {
      throw new Error("Connect Grok Build before changing a session option.");
    }
    await this.client.setSessionConfigOption(configId, value);
  }

  async setSessionMode(modeId: string): Promise<void> {
    if (!this.client) {
      throw new Error("Connect Grok Build before changing its mode.");
    }
    await this.client.setSessionMode(modeId);
  }

  async setModel(model: string): Promise<void> {
    if (this.state === "running") {
      throw new Error("Stop the active Grok Build turn before changing model.");
    }
    if (this.modelCatalogEvent?.models.length && !this.modelCatalogEvent.models.includes(model)) {
      throw new Error(`Grok Build did not report model '${model}' as available.`);
    }
    const reconnect = Boolean(this.client);
    await vscode.workspace
      .getConfiguration("grokBuild")
      .update("model", model, vscode.ConfigurationTarget.Workspace);
    this.refreshContext();
    if (reconnect) {
      await this.disconnect();
      await this.connect();
    }
  }

  async setReasoningEffort(effort: string): Promise<void> {
    if (this.state === "running") {
      throw new Error("Stop the active Grok Build turn before changing reasoning effort.");
    }
    const reconnect = Boolean(this.client);
    await vscode.workspace
      .getConfiguration("grokBuild")
      .update("reasoningEffort", effort, vscode.ConfigurationTarget.Workspace);
    this.refreshContext();
    if (reconnect) {
      await this.disconnect();
      await this.connect();
    }
  }

  resolvePermission(requestId: string, optionId?: string): void {
    const pending = this.pendingPermissions.get(requestId);
    if (!pending) {
      return;
    }
    this.pendingPermissions.delete(requestId);
    const valid = optionId
      ? pending.event.options.some((option) => option.optionId === optionId)
      : false;
    pending.resolve(
      valid && optionId
        ? { outcome: { outcome: "selected", optionId } }
        : { outcome: { outcome: "cancelled" } },
    );
    this.broadcast({
      type: "permission_resolved",
      requestId,
      ...(valid && optionId ? { optionId } : { cancelled: true }),
      automatic: false,
    });
  }

  async openFile(filePath: string, line?: number): Promise<void> {
    await this.editReview.followFile(filePath, line);
  }

  async reviewChange(changeId: string): Promise<void> {
    await this.editReview.review(changeId);
  }

  async listSessions(limit = 30): Promise<GrokSessionSummary[]> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    return listLocalSessions({
      ...(folder ? { cwd: folder.uri.fsPath } : {}),
      limit,
      grokHome: process.env.GROK_HOME || path.join(os.homedir(), ".grok"),
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration("grokBuild");
    const executable = resolveGrokExecutable(config.get<string>("executablePath", "grok"));
    const folder = vscode.workspace.workspaceFolders?.[0];
    await deleteSessionViaCli({
      executable,
      sessionId,
      ...(folder ? { cwd: folder.uri.fsPath } : {}),
      environment: {
        GROK_HOME: process.env.GROK_HOME || path.join(os.homedir(), ".grok"),
      },
    });
  }

  async exportActiveSession(): Promise<void> {
    const sessionId = this.activeSessionId;
    if (!sessionId) {
      throw new Error("No active session to export.");
    }
    const config = vscode.workspace.getConfiguration("grokBuild");
    const executable = resolveGrokExecutable(config.get<string>("executablePath", "grok"));
    const folder = vscode.workspace.workspaceFolders?.[0];
    const markdown = await exportSessionMarkdown({
      executable,
      sessionId,
      ...(folder ? { cwd: folder.uri.fsPath } : {}),
      environment: {
        GROK_HOME: process.env.GROK_HOME || path.join(os.homedir(), ".grok"),
      },
    });
    const doc = await vscode.workspace.openTextDocument({
      content: markdown,
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  async runCli(args: string[], timeoutMs = 30_000): Promise<string> {
    const config = vscode.workspace.getConfiguration("grokBuild");
    const executable = resolveGrokExecutable(config.get<string>("executablePath", "grok"));
    const folder = vscode.workspace.workspaceFolders?.[0];
    const result = await runGrokCli(cliOptions({
      executable,
      args,
      cwd: folder?.uri.fsPath,
      environment: {
        GROK_HOME: process.env.GROK_HOME || path.join(os.homedir(), ".grok"),
      },
      timeoutMs,
    }));
    const output = (result.stdout || result.stderr).trim();
    if ((result.code ?? 1) !== 0 && !output) {
      throw new Error(`grok ${args.join(" ")} failed`);
    }
    return output;
  }

  getExecutable(): string {
    return resolveGrokExecutable(
      vscode.workspace.getConfiguration("grokBuild").get<string>("executablePath", "grok"),
    );
  }

  configurationChanged(): void {
    this.refreshContext();
  }

  dispose(): void {
    void this.disconnect();
    this.editReview.dispose();
    this.terminalHost.dispose();
    this.listeners.clear();
  }

  private createHost(): WorkspaceHost & {
    createTerminal: TerminalHost["createTerminal"];
    terminalOutput: TerminalHost["terminalOutput"];
    releaseTerminal: TerminalHost["releaseTerminal"];
    waitForTerminalExit: TerminalHost["waitForExit"];
    killTerminal: TerminalHost["killTerminal"];
  } {
    const workspaceHost = new WorkspaceHost({
      requestPermission: (request) => this.requestPermission(request),
      onFileWrite: (change) => this.handleFilesystemWrite(change),
    });
    return Object.assign(workspaceHost, {
      createTerminal: (request: acp.CreateTerminalRequest) =>
        this.terminalHost.createTerminal(request),
      terminalOutput: (request: acp.TerminalOutputRequest) =>
        this.terminalHost.terminalOutput(request),
      releaseTerminal: (request: acp.ReleaseTerminalRequest) =>
        this.terminalHost.releaseTerminal(request),
      waitForTerminalExit: (request: acp.WaitForTerminalExitRequest) =>
        this.terminalHost.waitForExit(request),
      killTerminal: (request: acp.KillTerminalRequest) => this.terminalHost.killTerminal(request),
    });
  }

  private async probeExecutable(executable: string): Promise<boolean> {
    if (path.isAbsolute(executable) || executable.includes(path.sep) || executable.includes("/")) {
      try {
        await access(executable);
        return true;
      } catch {
        return false;
      }
    }
    const result = await runGrokCli({
      executable,
      args: ["--version"],
      timeoutMs: 8_000,
    });
    return (result.code ?? 1) === 0 || /grok/i.test(result.stdout + result.stderr);
  }

  private requestPermission(
    request: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    const permissionMode = vscode.workspace
      .getConfiguration("grokBuild")
      .get<PermissionMode>("permissionMode", "ask");
    const toolKind = request.toolCall.kind ?? undefined;
    const automaticOption = selectAutomaticPermissionOption(
      permissionMode,
      toolKind,
      request.options,
    );
    if (automaticOption) {
      const requestId = `permission-${Date.now()}-${++this.permissionSequence}`;
      this.broadcast({
        type: "permission_resolved",
        requestId,
        optionId: automaticOption.optionId,
        automatic: true,
      });
      return Promise.resolve({
        outcome: { outcome: "selected", optionId: automaticOption.optionId },
      });
    }

    const requestId = `permission-${Date.now()}-${++this.permissionSequence}`;
    const event: Extract<GrokEvent, { type: "permission_request" }> = {
      type: "permission_request",
      requestId,
      toolCallId: request.toolCall.toolCallId,
      title: request.toolCall.title ?? "Grok Build action",
      ...(toolKind ? { kind: toolKind } : {}),
      ...(request.toolCall.locations?.length
        ? {
            locations: request.toolCall.locations.map((location) => ({
              path: location.path,
              ...(location.line !== undefined && location.line !== null
                ? { line: location.line }
                : {}),
            })),
          }
        : {}),
      options: request.options.map((option) => ({
        optionId: option.optionId,
        name: option.name,
        kind: option.kind,
      })),
    };
    return new Promise((resolve) => {
      this.pendingPermissions.set(requestId, { event, resolve });
      this.broadcast(event);
    });
  }

  private async handleFilesystemWrite(change: {
    path: string;
    oldText?: string;
    newText: string;
  }): Promise<void> {
    const reveal = vscode.workspace
      .getConfiguration("grokBuild")
      .get<boolean>("openDiffOnEdit", true);
    const changeId = await this.editReview.recordChange(change, reveal);
    this.handleClientEvent({
      type: "workspace_edit",
      changeId,
      path: change.path,
      source: "filesystem",
    });
  }

  private handleClientEvent(event: GrokEvent): void {
    if (event.type === "state") {
      if (event.state === this.state && event.detail === this.stateDetail) {
        return;
      }
      this.state = event.state;
      this.stateDetail = event.detail;
      const connected = event.state === "connected" || event.state === "running";
      void vscode.commands.executeCommand("setContext", "grokBuild.connected", connected);
      this.output.appendLine(`[state] ${event.state}${event.detail ? ` — ${event.detail}` : ""}`);
    } else if (event.type === "context") {
      this.contextEvent = event;
    } else if (event.type === "runtime") {
      this.runtimeEvent = event;
    } else if (event.type === "session") {
      this.sessionEvent = event;
      this.usageEvent = undefined;
    } else if (event.type === "model_catalog") {
      this.modelCatalogEvent = event;
    } else if (event.type === "session_config") {
      this.sessionConfigEvent = event;
    } else if (event.type === "session_modes") {
      this.sessionModesEvent = event;
    } else if (event.type === "current_mode") {
      this.currentModeEvent = event;
    } else if (event.type === "usage") {
      this.usageEvent = event;
    } else if (event.type === "cli_status") {
      this.cliStatusEvent = event;
    }
    if (event.type === "tool" || event.type === "tool_update") {
      void this.followToolEvent(event).catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        this.output.appendLine(`[follow] ${detail}`);
      });
    }
    // Fresh auto-open budget at turn start/end so multi-file reviews do not pile up forever.
    if (
      event.type === "turn_complete" ||
      event.type === "session" ||
      (event.type === "state" && event.state === "running")
    ) {
      this.editReview.resetTurnOpenBudget();
    }
    this.broadcast(event);
  }

  private async followToolEvent(
    event: Extract<GrokEvent, { type: "tool" | "tool_update" }>,
  ): Promise<void> {
    const firstLocation = event.locations?.[0];
    if (firstLocation) {
      await this.editReview.followFile(firstLocation.path, firstLocation.line);
    }
    for (const diff of event.diffs ?? []) {
      const fingerprint = `${event.toolCallId}:${diff.path}:${diff.newText.length}:${diff.newText.slice(-32)}`;
      if (this.seenDiffs.has(fingerprint)) {
        continue;
      }
      this.seenDiffs.add(fingerprint);
      const reveal = vscode.workspace
        .getConfiguration("grokBuild")
        .get<boolean>("openDiffOnEdit", true);
      const changeId = await this.editReview.recordChange(diff, reveal);
      this.broadcast({
        type: "workspace_edit",
        changeId,
        path: diff.path,
        source: "acp_diff",
      });
    }
  }

  private formatWorkspaceName(folders: readonly vscode.WorkspaceFolder[]): string {
    if (folders.length === 1) {
      return folders[0]!.name;
    }
    return `${folders[0]!.name} +${folders.length - 1}`;
  }

  private refreshContext(workspaceName?: string): void {
    const folders = vscode.workspace.workspaceFolders;
    const config = vscode.workspace.getConfiguration("grokBuild");
    this.handleClientEvent({
      type: "context",
      workspaceName:
        workspaceName ?? (folders?.length ? this.formatWorkspaceName(folders) : "No workspace"),
      model: config.get<string>("model", "").trim() || "Default model",
      reasoningEffort:
        config.get<string>("reasoningEffort", "").trim() || "Default effort",
      showReasoning: config.get<boolean>("showReasoning", true),
      permissionMode: config.get<PermissionMode>("permissionMode", "ask"),
      allowOutsideWorkspace: config.get<boolean>("allowOutsideWorkspace", false),
      followAgentFiles: config.get<boolean>("followAgentFiles", true),
      openDiffOnEdit: config.get<boolean>("openDiffOnEdit", true),
      showToolDetails: config.get<boolean>("showToolDetails", true),
      voiceInput: config.get<boolean>("voiceInput", false),
      sandbox: config.get<string>("sandbox", "").trim() || "off",
      experimentalMemory: config.get<boolean>("experimentalMemory", false),
      enableTerminal: config.get<boolean>("enableTerminal", true),
    });
  }

  private cancelPendingPermissions(): void {
    for (const [requestId, pending] of this.pendingPermissions) {
      pending.resolve({ outcome: { outcome: "cancelled" } });
      this.broadcast({
        type: "permission_resolved",
        requestId,
        automatic: true,
        cancelled: true,
      });
    }
    this.pendingPermissions.clear();
  }

  private broadcast(event: GrokEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
