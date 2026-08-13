import { readFile } from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import type { GrokEvent, PermissionMode, PromptAttachment } from "../acp/types.js";
import { PERMISSION_MODES } from "../acp/types.js";
import { listMcpServers, runMcpCommand } from "./mcpService.js";
import { clearMemory, listPlugins, runDoctor, runLogin, runLogout, runPluginCommand } from "./pluginService.js";
import { GrokController } from "./grokController.js";
import type { LayoutModeService, GrokProductId } from "./layoutModeService.js";
import { PRODUCTS } from "./layoutModeService.js";
import { fetchAccountUsage } from "./usageService.js";
import { normalizeSafeExternalUrl } from "./externalUrlPolicy.js";
import { readSessionInfo, setSessionGeneratedTitle } from "./sessionService.js";
import { listWorktrees, removeWorktree } from "./worktreeService.js";

interface WebviewMessage {
  type:
    | "ready"
    | "connect"
    | "disconnect"
    | "newSession"
    | "send"
    | "cancel"
    | "settings"
    | "openCliConfig"
    | "openFolder"
    | "openExplorer"
    | "openIde"
    | "openGrokBuildIde"
    | "openGrokBuild"
    | "agentMode"
    | "addContext"
    | "layout"
    | "permissionResponse"
    | "setPermissionMode"
    | "setSessionConfig"
    | "setModel"
    | "setEffort"
    | "setSessionMode"
    | "openExternal"
    | "openFile"
    | "reviewChange"
    | "clearConversation"
    | "toolsHub"
    | "sessions"
    | "resumeSession"
    | "renameSession"
    | "exportHistorySession"
    | "deleteSession"
    | "mcp"
    | "worktree"
    | "plugins"
    | "exportSession"
    | "login"
    | "logout"
    | "doctor"
    | "refreshUsage"
    | "refreshSessionInfo"
    | "copyText"
    | "memoryClear";
  text?: string;
  requestId?: string;
  optionId?: string;
  mode?: PermissionMode;
  configId?: string;
  value?: string | boolean;
  modeId?: string;
  path?: string;
  line?: number;
  changeId?: string;
  sessionId?: string;
  title?: string;
  attachments?: PromptAttachment[];
}

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

export class ChatViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = "grokBuild.chat";

  private view: vscode.WebviewView | undefined;
  private readonly controllerSubscription: vscode.Disposable;
  private readonly productSubscription: vscode.Disposable | undefined;
  private usageRefresh: Promise<void> | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly controller: GrokController,
    private readonly layoutMode?: LayoutModeService,
  ) {
    this.controllerSubscription = controller.onEvent((event) => this.postEvent(event));
    this.productSubscription = layoutMode?.onDidChangeProduct((product) => {
      this.postProduct(product);
      this.syncViewTitle(product);
    });
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "media"),
        vscode.Uri.joinPath(this.extensionUri, "logo"),
      ],
    };
    view.webview.html = this.getHtml(view.webview);
    view.webview.onDidReceiveMessage((message: WebviewMessage) => {
      void this.handleMessage(message);
    });
    view.onDidDispose(() => {
      if (this.view === view) {
        this.view = undefined;
      }
    });
    const product = this.layoutMode?.currentProduct ?? "grok-build-ide";
    this.syncViewTitle(product);
  }

  dispose(): void {
    this.controllerSubscription.dispose();
    this.productSubscription?.dispose();
  }

  private syncViewTitle(product: GrokProductId): void {
    if (!this.view) {
      return;
    }
    // Distinct surface labels in the workbench chrome.
    this.view.title = product === "grok-build-ide" ? "Agent (IDE)" : "Grok Build";
    this.view.description =
      product === "grok-build-ide" ? "Grok Build IDE" : "Agent desktop";
  }

  private postProduct(product: GrokProductId): void {
    const d = PRODUCTS[product];
    void this.view?.webview.postMessage({
      type: "product",
      product,
      shortName: d.shortName,
      fullName: d.fullName,
      tagline: d.tagline,
    });
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    try {
      switch (message.type) {
        case "ready":
          this.postProduct(this.layoutMode?.currentProduct ?? "grok-build-ide");
          for (const event of this.controller.initialEvents) {
            this.postEvent(event);
          }
          await this.refreshSessionInfo();
          if (
            vscode.workspace.getConfiguration("grokBuild").get<boolean>("autoStart", true) &&
            this.controller.connectionState === "disconnected"
          ) {
            await this.controller.connect();
          }
          break;
        case "connect":
          await this.controller.connect();
          break;
        case "disconnect":
          await this.controller.disconnect();
          break;
        case "newSession":
          await this.controller.newSession();
          break;
        case "send":
          if (message.text || message.attachments?.length) {
            await this.controller.prompt(message.text ?? "", message.attachments ?? []);
          }
          break;
        case "cancel":
          await this.controller.cancel();
          break;
        case "settings":
          await vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "@ext:local-grok-workbench.grok-build-workbench",
          );
          break;
        case "openCliConfig":
          await vscode.commands.executeCommand("grokBuild.openCliConfig");
          break;
        case "openFolder":
          await vscode.commands.executeCommand("workbench.action.files.openFolder");
          break;
        case "openExplorer":
          await this.openExplorer();
          break;
        case "openIde":
        case "openGrokBuildIde":
          await this.openIde();
          break;
        case "openGrokBuild":
        case "agentMode":
          await this.enterAgentMode();
          break;
        case "addContext":
          await this.addContextFiles();
          break;
        case "layout":
          await this.showLayoutMenu();
          break;
        case "permissionResponse":
          if (message.requestId) {
            this.controller.resolvePermission(message.requestId, message.optionId);
          }
          break;
        case "setPermissionMode":
          if (message.mode && PERMISSION_MODES.includes(message.mode)) {
            await this.controller.setPermissionMode(message.mode);
          }
          break;
        case "setSessionConfig":
          if (message.configId && message.value !== undefined) {
            await this.controller.setSessionConfigOption(message.configId, message.value);
          }
          break;
        case "setModel":
          if (typeof message.value === "string" && message.value) {
            await this.controller.setModel(message.value);
          }
          break;
        case "setEffort":
          if (typeof message.value === "string") {
            await this.controller.setReasoningEffort(message.value);
          }
          break;
        case "setSessionMode":
          if (message.modeId) {
            await this.controller.setSessionMode(message.modeId);
          }
          break;
        case "openExternal":
          {
            const externalUrl = normalizeSafeExternalUrl(message.value, { allowHttp: true });
            if (externalUrl) await vscode.env.openExternal(vscode.Uri.parse(externalUrl));
          }
          break;
        case "openFile":
          if (message.path) {
            await this.controller.openFile(message.path, message.line);
          }
          break;
        case "reviewChange":
          if (message.changeId) {
            await this.controller.reviewChange(message.changeId);
          }
          break;
        case "clearConversation":
          this.controller.clearConversation();
          break;
        case "toolsHub":
          await this.showToolsHub();
          break;
        case "sessions":
          await this.refreshSessionsForWebview();
          break;
        case "resumeSession":
          if (message.sessionId) {
            await this.controller.resumeSession(message.sessionId);
            await vscode.commands.executeCommand("grokBuild.refreshSessionsTree");
            await this.refreshSessionsForWebview();
          }
          break;
        case "renameSession":
          if (message.sessionId) {
            await this.renameHistorySession(message.sessionId, message.title);
          }
          break;
        case "exportHistorySession":
          if (message.sessionId) await this.controller.exportSession(message.sessionId);
          break;
        case "deleteSession":
          if (message.sessionId) {
            await this.deleteHistorySession(message.sessionId, message.title);
          }
          break;
        case "mcp":
          await this.showMcpManager();
          break;
        case "worktree":
          await this.showWorktreeManager();
          break;
        case "plugins":
          await this.showPluginManager();
          break;
        case "exportSession":
          await this.controller.exportActiveSession();
          break;
        case "login":
          await this.runAndNotify(() => runLogin(this.cliContext()), "Login");
          break;
        case "logout":
          await this.runAndNotify(() => runLogout(this.cliContext()), "Logout");
          break;
        case "doctor":
          await this.runAndShowOutput(() => runDoctor(this.cliContext()), "Grok Doctor");
          break;
        case "refreshUsage":
          await this.refreshUsage();
          break;
        case "refreshSessionInfo":
          await this.refreshSessionInfo();
          break;
        case "copyText":
          if (typeof message.value === "string" && message.value) {
            await vscode.env.clipboard.writeText(message.value);
            await this.view?.webview.postMessage({ type: "copy_result", ok: true });
          }
          break;
        case "memoryClear":
          if (await this.confirmMemoryClear()) {
            await this.runAndNotify(() => clearMemory(this.cliContext()), "Memory");
          }
          break;
      }
    } catch (error) {
      this.postEvent({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async openExplorer(): Promise<void> {
    await vscode.commands.executeCommand("workbench.view.explorer");
  }

  async openIde(): Promise<void> {
    if (this.layoutMode) {
      await this.layoutMode.openGrokBuildIde();
      return;
    }
    await this.openExplorer();
  }

  async enterAgentMode(): Promise<void> {
    if (this.layoutMode) {
      await this.layoutMode.openGrokBuild();
      return;
    }
    await vscode.commands.executeCommand("workbench.view.extension.grokBuild");
  }

  private cliContext(): { executable: string; cwd?: string } {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return {
      executable: this.controller.getExecutable(),
      ...(cwd ? { cwd } : {}),
    };
  }

  private async refreshUsage(): Promise<void> {
    if (this.usageRefresh) {
      await this.usageRefresh;
      return;
    }
    this.usageRefresh = (async () => {
      await this.view?.webview.postMessage({ type: "account_usage", state: "loading" });
      const data = await fetchAccountUsage();
      await this.view?.webview.postMessage({ type: "account_usage", state: "ready", data });
    })();
    try {
      await this.usageRefresh;
    } finally {
      this.usageRefresh = undefined;
    }
  }

  private async refreshSessionInfo(): Promise<void> {
    await this.view?.webview.postMessage({ type: "session_info", state: "loading" });
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const sessionId = this.controller.activeSessionId;
    const data = await readSessionInfo({
      ...(sessionId ? { sessionId } : {}),
      ...(cwd ? { cwd } : {}),
    });
    const events = this.controller.initialEvents;
    const runtime = events.find(
      (event): event is Extract<GrokEvent, { type: "runtime" }> => event.type === "runtime",
    );
    const context = events.find(
      (event): event is Extract<GrokEvent, { type: "context" }> => event.type === "context",
    );
    await this.view?.webview.postMessage({
      type: "session_info",
      state: "ready",
      data: {
        ...data,
        state: this.controller.connectionState,
        shellVersion: runtime?.agentVersion || null,
        acpProtocol: runtime?.protocolVersion ?? null,
        model: data.model ?? context?.model ?? null,
        sandbox: data.sandbox ?? context?.sandbox ?? null,
        reasoningEffort: data.reasoningEffort ?? context?.reasoningEffort ?? null,
        permissionMode: context?.permissionMode ?? null,
      },
    });
  }

  async showToolsHub(): Promise<void> {
    const picked = await vscode.window.showQuickPick(
      [
        { label: "$(history) Sessions", action: "sessions" as const },
        { label: "$(server-process) MCP servers", action: "mcp" as const },
        { label: "$(git-branch) Worktrees", action: "worktree" as const },
        { label: "$(extensions) Plugins", action: "plugins" as const },
        { label: "$(export) Export active session", action: "exportSession" as const },
        { label: "$(clear-all) Clear conversation", action: "clearConversation" as const },
        { label: "$(account) Login", action: "login" as const },
        { label: "$(sign-out) Logout", action: "logout" as const },
        { label: "$(heart) Doctor", action: "doctor" as const },
        { label: "$(trash) Clear memory", action: "memoryClear" as const },
        { label: "$(settings-gear) Open CLI config", action: "openCliConfig" as const },
      ],
      { placeHolder: "Grok Build tools" },
    );
    if (!picked) {
      return;
    }
    if (picked.action === "sessions") {
      await this.showHistoryPanel();
      return;
    }
    await this.handleMessage({ type: picked.action });
  }

  async showHistoryPanel(): Promise<void> {
    await vscode.commands.executeCommand(`${ChatViewProvider.viewType}.focus`);
    this.view?.show(true);
    await this.view?.webview.postMessage({ type: "open_history" });
  }

  private async refreshSessionsForWebview(): Promise<void> {
    await this.view?.webview.postMessage({ type: "session_list", state: "loading" });
    try {
      const sessions = await this.controller.listSessions(80);
      await this.view?.webview.postMessage({
        type: "session_list",
        state: "ready",
        sessions,
        activeSessionId: this.controller.activeSessionId ?? null,
      });
    } catch (error) {
      await this.view?.webview.postMessage({
        type: "session_list",
        state: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async renameHistorySession(sessionId: string, currentTitle?: string): Promise<void> {
    const next = await vscode.window.showInputBox({
      title: "Rename Conversation",
      prompt: "Display title saved in the local Grok session summary",
      value: currentTitle || sessionId,
      placeHolder: "e.g. Improve session history and usage",
      ignoreFocusOut: true,
      validateInput: (value) => {
        const title = value.trim();
        if (!title) return "Title cannot be empty.";
        if (title.length > 200) return "Keep the title under 200 characters.";
        return undefined;
      },
    });
    if (next === undefined) return;
    await setSessionGeneratedTitle({ sessionId, title: next });
    await vscode.commands.executeCommand("grokBuild.refreshSessionsTree");
    await this.refreshSessionsForWebview();
  }

  private async deleteHistorySession(sessionId: string, title?: string): Promise<void> {
    if (sessionId === this.controller.activeSessionId) {
      void vscode.window.showWarningMessage("Start or open another conversation before deleting the active session.");
      return;
    }
    const confirm = await vscode.window.showWarningMessage(
      `Permanently delete “${title || sessionId}” from Grok history?`,
      { modal: true, detail: "This uses `grok sessions delete` and cannot be undone." },
      "Delete",
    );
    if (confirm !== "Delete") return;
    await this.controller.deleteSession(sessionId);
    await vscode.commands.executeCommand("grokBuild.refreshSessionsTree");
    await this.refreshSessionsForWebview();
  }

  async showMcpManager(): Promise<void> {
    const ctx = this.cliContext();
    const servers = await listMcpServers(ctx);
    const items = [
      { label: "$(add) Add MCP server…", action: "add" as const, server: undefined },
      ...servers.map((server) => ({
        label: `${server.enabled ? "$(check)" : "$(circle-slash)"} ${server.name}`,
        description: server.enabled ? "enabled" : "disabled",
        detail: server.detail,
        action: "manage" as const,
        server,
      })),
    ];
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: "Manage Grok MCP servers",
      matchOnDetail: true,
    });
    if (!picked) {
      return;
    }
    if (picked.action === "add") {
      const transport = await vscode.window.showQuickPick(
        [
          { label: "stdio", description: "Launch a local MCP process", value: "stdio" as const },
          { label: "http", description: "Connect to a Streamable HTTP endpoint", value: "http" as const },
          { label: "sse", description: "Connect to a Server-Sent Events endpoint", value: "sse" as const },
        ],
        { placeHolder: "MCP transport" },
      );
      if (!transport) {
        return;
      }
      const name = await vscode.window.showInputBox({
        prompt: "MCP server name",
        placeHolder: "github",
      });
      if (!name) {
        return;
      }
      const command = await vscode.window.showInputBox({
        prompt: transport.value === "stdio" ? "Command to launch" : `${transport.label.toUpperCase()} endpoint URL`,
        placeHolder: transport.value === "stdio" ? "npx" : "https://example.com/mcp",
      });
      if (!command) {
        return;
      }
      let args: string[];
      if (transport.value === "stdio") {
        const extra = await vscode.window.showInputBox({
          prompt: "Command arguments (space-separated, optional)",
          placeHolder: "-y @modelcontextprotocol/server-github",
        });
        args = ["add", name, "--", command, ...(extra ? extra.split(/\s+/).filter(Boolean) : [])];
      } else {
        args = ["add", "--transport", transport.value, name, command];
      }
      const output = await runMcpCommand({ ...ctx, args });
      void vscode.window.showInformationMessage(output || `Added MCP server ${name}`);
      return;
    }
    if (!picked.server) {
      return;
    }
    const manage = await vscode.window.showQuickPick(
      [
        {
          label: picked.server.enabled ? "$(debug-disconnect) Disable" : "$(play) Enable",
          action: picked.server.enabled ? "disable" : "enable",
        },
        { label: "$(trash) Remove", action: "remove" },
      ],
      { placeHolder: picked.server.name },
    );
    if (!manage) {
      return;
    }
    const output = await runMcpCommand({
      ...ctx,
      args: [manage.action, picked.server.name],
    });
    void vscode.window.showInformationMessage(output || `${manage.action} ${picked.server.name}`);
  }

  async showWorktreeManager(): Promise<void> {
    const ctx = this.cliContext();
    const trees = await listWorktrees(ctx);
    const picked = await vscode.window.showQuickPick(
      [
        {
          label: "$(git-branch) Start next session in a new worktree…",
          action: "start" as const,
        },
        {
          label: "$(clear-all) Clear worktree setting",
          action: "clear" as const,
        },
        ...trees.map((tree) => ({
          label: tree.name,
          description: tree.path,
          detail: tree.detail,
          action: "remove" as const,
          tree,
        })),
      ],
      { placeHolder: "Grok worktrees" },
    );
    if (!picked) {
      return;
    }
    if (picked.action === "start") {
      const name = await vscode.window.showInputBox({
        prompt: "Worktree name (optional — leave blank for auto name)",
        placeHolder: "feat-login",
      });
      if (name === undefined) {
        return;
      }
      const setting = name.trim() || "__auto__";
      await vscode.workspace
        .getConfiguration("grokBuild")
        .update("worktree", setting, vscode.ConfigurationTarget.Workspace);
      void vscode.window.showInformationMessage(
        name.trim()
          ? `Next connect will use --worktree ${name.trim()}`
          : "Next connect will use --worktree (auto name)",
      );
      return;
    }
    if (picked.action === "clear") {
      await vscode.workspace
        .getConfiguration("grokBuild")
        .update("worktree", "", vscode.ConfigurationTarget.Workspace);
      void vscode.window.showInformationMessage("Worktree launch setting cleared.");
      return;
    }
    if (picked.action === "remove" && "tree" in picked && picked.tree) {
      const output = await removeWorktree({
        ...ctx,
        name: picked.tree.name,
      });
      void vscode.window.showInformationMessage(output || `Removed ${picked.tree.name}`);
    }
  }

  async showPluginManager(): Promise<void> {
    const ctx = this.cliContext();
    const plugins = await listPlugins(ctx);
    const picked = await vscode.window.showQuickPick(
      [
        { label: "$(cloud-download) Install plugin from git URL…", action: "install" as const },
        { label: "$(sync) Update all plugins", action: "update" as const },
        ...plugins.map((plugin) => ({
          label: `${plugin.enabled ? "$(check)" : "$(circle-slash)"} ${plugin.name}`,
          detail: plugin.detail,
          action: "manage" as const,
          plugin,
        })),
      ],
      { placeHolder: "Grok plugins" },
    );
    if (!picked) {
      return;
    }
    if (picked.action === "install") {
      const source = await vscode.window.showInputBox({
        prompt: "Git URL or local path for the plugin",
      });
      if (!source) {
        return;
      }
      const confirm = await vscode.window.showWarningMessage(
        `Trust and install plugin from ${source}? Plugin hooks and MCP servers can run code.`,
        { modal: true },
        "Trust and Install",
      );
      if (confirm !== "Trust and Install") {
        return;
      }
      const output = await runPluginCommand({
        ...ctx,
        args: ["install", "--trust", source],
      });
      void vscode.window.showInformationMessage(output || "Plugin installed");
      return;
    }
    if (picked.action === "update") {
      const output = await runPluginCommand({ ...ctx, args: ["update"] });
      void vscode.window.showInformationMessage(output || "Plugins updated");
      return;
    }
    if (picked.action === "manage" && "plugin" in picked && picked.plugin) {
      const manage = await vscode.window.showQuickPick(
        [
          {
            label: picked.plugin.enabled ? "Disable" : "Enable",
            action: picked.plugin.enabled ? "disable" : "enable",
          },
          { label: "Uninstall", action: "uninstall" },
        ],
        { placeHolder: picked.plugin.name },
      );
      if (!manage) {
        return;
      }
      const output = await runPluginCommand({
        ...ctx,
        args: [manage.action, picked.plugin.name],
      });
      void vscode.window.showInformationMessage(output || `${manage.action} ${picked.plugin.name}`);
    }
  }

  private async addContextFiles(): Promise<void> {
    const defaultUri = vscode.window.activeTextEditor?.document.uri
      ?? vscode.workspace.workspaceFolders?.[0]?.uri;
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: true,
      ...(defaultUri ? { defaultUri } : {}),
      openLabel: "Add to Grok Prompt",
      title: "Add Files to Grok Prompt",
      filters: {
        "All files": ["*"],
        Images: ["png", "jpg", "jpeg", "gif", "webp", "bmp"],
      },
    });
    if (!selected?.length) {
      return;
    }
    const allowOutsideWorkspace = vscode.workspace
      .getConfiguration("grokBuild")
      .get<boolean>("allowOutsideWorkspace", false);
    const rejected: vscode.Uri[] = [];
    for (const uri of selected) {
      if (uri.scheme !== "file" || (!allowOutsideWorkspace && !vscode.workspace.getWorkspaceFolder(uri))) {
        rejected.push(uri);
        continue;
      }
      const ext = path.extname(uri.fsPath).toLowerCase();
      const mimeType = IMAGE_MIME[ext];
      if (mimeType) {
        const bytes = await readFile(uri.fsPath);
        const maxImageBytes = 5 * 1024 * 1024;
        if (bytes.byteLength > maxImageBytes) {
          void vscode.window.showWarningMessage(
            `Image "${path.basename(uri.fsPath)}" exceeds the 5MB attachment limit and was skipped.`,
          );
          continue;
        }
        this.postEvent({
          type: "attachment_added",
          uri: uri.toString(),
          name: path.basename(uri.fsPath),
          mimeType,
          data: bytes.toString("base64"),
        });
      } else {
        this.postEvent({
          type: "attachment_added",
          uri: uri.toString(),
          name: path.basename(uri.fsPath),
        });
      }
    }
    if (rejected.length > 0) {
      void vscode.window.showWarningMessage(
        `${rejected.length} selected file(s) were outside the allowed workspace scope.`,
      );
    }
  }

  async showLayoutMenu(): Promise<void> {
    const current = this.layoutMode?.currentProduct ?? "grok-build-ide";
    const selection = await vscode.window.showQuickPick(
      [
        {
          label: `$(rocket) Grok Build${current === "grok-build" ? "  $(check)" : ""}`,
          description: "Agent desktop — conversations, plans, reviews",
          command: "grokBuild.openGrokBuild",
        },
        {
          label: `$(window) Grok Build IDE${current === "grok-build-ide" ? "  $(check)" : ""}`,
          description: "Full IDE — Explorer, editor, terminal, SCM",
          command: "grokBuild.openGrokBuildIde",
        },
        {
          label: "$(layout) Toggle Grok Build ↔ Grok Build IDE",
          command: "grokBuild.toggleAgentIde",
        },
        {
          label: "$(move) Move agent view…",
          description: "Primary Sidebar, Secondary Sidebar, or Panel",
          command: "workbench.action.moveFocusedView",
        },
        {
          label: "$(layout-sidebar-left) Toggle Primary Sidebar left/right",
          command: "workbench.action.toggleSidebarPosition",
        },
        {
          label: "$(layout-sidebar-right) Toggle Secondary Sidebar",
          command: "workbench.action.toggleAuxiliaryBar",
        },
        {
          label: "$(multiple-windows) Separate Windows taskbar buttons…",
          description: "Open Taskbar settings and choose Never combine",
          command: "grokBuild.openTaskbarSettings",
        },
        {
          label: "$(discard) Reset all view locations",
          command: "workbench.action.resetViewLocations",
        },
      ],
      { placeHolder: "Switch product surface or layout" },
    );
    if (selection) {
      await vscode.commands.executeCommand(selection.command);
    }
  }

  private async runAndNotify(action: () => Promise<string>, title: string): Promise<void> {
    const output = await action();
    void vscode.window.showInformationMessage(`${title}: ${output.slice(0, 200)}`);
  }

  private async confirmMemoryClear(): Promise<boolean> {
    const choice = await vscode.window.showWarningMessage(
      "Clear Grok memory for the current workspace?",
      { modal: true },
      "Clear Workspace Memory",
    );
    return choice === "Clear Workspace Memory";
  }

  private async runAndShowOutput(action: () => Promise<string>, title: string): Promise<void> {
    const output = await action();
    const doc = await vscode.workspace.openTextDocument({
      content: `${title}\n\n${output}`,
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc, { preview: true });
  }

  private postEvent(event: GrokEvent): void {
    void this.view?.webview.postMessage({ type: "event", event });
    if (event.type === "session" || event.type === "turn_complete") {
      void this.refreshSessionInfo();
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const initialProduct = this.layoutMode?.currentProduct ?? "grok-build-ide";
    const initialDescriptor = PRODUCTS[initialProduct];
    const initialTag = initialProduct === "grok-build-ide" ? "IDE agent panel" : "Agent desktop";
    const timelineScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "timeline.js"),
    );
    const markdownScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "markdown.js"),
    );
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "main.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "styles.css"));
    const brandUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "logo", "grok-fluffy.png"),
    );

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: https:;">
  <link rel="stylesheet" href="${styleUri}">
  <title>${initialDescriptor.shortName}</title>
</head>
<body class="product-${initialProduct}" data-product="${initialProduct}">
  <div class="product-shell">
    <aside id="agentRail" class="agent-rail" aria-label="Grok Build navigation">
      <div class="rail-brand">
        <img class="brand-mark rail-mark" src="${brandUri}" alt="" aria-hidden="true">
        <div class="rail-brand-text">
          <strong id="railProductName">${initialDescriptor.shortName}</strong>
          <span id="railProductTag">${initialTag}</span>
        </div>
      </div>
      <nav class="rail-nav">
        <button id="railNewConversation" class="rail-item rail-primary" type="button" title="Start a new conversation">
          <span data-icon="plus"></span>
          <span>New Conversation</span>
        </button>
        <button id="railHistory" class="rail-item" type="button" title="Conversation history">
          <span data-icon="menu"></span>
          <span>Conversation History</span>
        </button>
        <button id="railProjects" class="rail-item" type="button" title="Open workspace / Explorer">
          <span data-icon="folder"></span>
          <span>Projects</span>
        </button>
      </nav>
      <div class="rail-footer">
        <button id="railOpenIde" class="rail-item rail-ide" type="button" title="Switch to Grok Build IDE">
          <span data-icon="panels"></span>
          <span>Open Grok Build IDE</span>
        </button>
        <button id="railSettings" class="rail-item" type="button" title="Settings">
          <span data-icon="settings"></span>
          <span>Settings</span>
        </button>
      </div>
    </aside>

  <main class="app">
    <header class="masthead">
      <div class="brand-lockup">
        <img class="brand-mark" src="${brandUri}" alt="" aria-hidden="true">
        <div class="brand-titles">
          <h1 id="productTitle">Grok Build</h1>
          <p id="productTagline" class="product-tagline">Agent desktop</p>
        </div>
      </div>
      <div class="masthead-actions">
        <button id="openIdeButton" class="open-ide-button" type="button" title="Open Grok Build IDE — Explorer, editor, terminal">
          <span data-icon="panels"></span>
          <span id="openIdeLabel">Open Grok Build IDE</span>
        </button>
        <button id="sessionsButton" class="icon-button" type="button" aria-label="Conversation history" title="Conversation history"><span data-icon="menu"></span></button>
        <button id="connectionButton" class="icon-button" type="button" aria-label="Connect to Grok Build" title="Connect"><span data-icon="plug"></span></button>
      </div>
    </header>

    <div id="status" class="status" role="status" aria-live="polite">
      <span class="status-dot" aria-hidden="true"></span>
      <span id="statusText">Disconnected</span>
    </div>

    <section class="context-panel" aria-label="Grok Build context">
      <div class="context-row">
        <button id="workspaceButton" class="context-chip context-workspace" type="button" title="Open Explorer">
          <span class="context-glyph" data-icon="folder"></span>
          <span id="workspaceName" class="truncate">No workspace</span>
        </button>
        <button id="settingsButton" class="context-chip" type="button" title="Open all Grok Build settings"><span class="settings-icon" data-icon="settings"></span><span class="context-chip-label">Settings</span></button>
        <button id="toolsButton" class="context-chip" type="button" title="MCP, worktree, plugins, doctor">Tools</button>
        <button id="layoutButton" class="compact-icon-button" type="button" aria-label="Switch product or layout" title="Switch product or layout"><span data-icon="panels"></span></button>
      </div>
      <div class="runtime-row">
        <button id="sessionInfo" class="runtime-session-button truncate" type="button" title="Open session information">No session</button>
        <span aria-hidden="true">·</span>
        <span id="runtimeInfo" class="truncate" title="ACP runtime">ACP</span>
      </div>
    </section>

    <div id="historyBackdrop" class="history-backdrop hidden" aria-hidden="true"></div>
    <aside id="historyPanel" class="history-panel hidden" role="dialog" aria-modal="true" aria-labelledby="historyTitle">
      <header class="history-head">
        <div>
          <strong id="historyTitle">Conversation history</strong>
          <span id="historySummary">Recent Grok CLI sessions in this workspace</span>
        </div>
        <button id="historyClose" class="history-icon-button" type="button" aria-label="Close conversation history" title="Close"><span data-icon="x"></span></button>
      </header>
      <div class="history-toolbar">
        <label class="history-search" for="historySearch">
          <span data-icon="search"></span>
          <input id="historySearch" type="search" placeholder="Search titles, model or session ID" autocomplete="off" spellcheck="false">
        </label>
        <button id="historyRefresh" class="history-icon-button" type="button" aria-label="Refresh conversation history" title="Refresh"><span data-icon="refreshCw"></span></button>
      </div>
      <div id="historyList" class="history-list" aria-live="polite"></div>
      <footer class="history-footer">
        <button id="historyNew" class="history-new-button" type="button"><span data-icon="plus"></span><span>New conversation</span></button>
        <span>Stored by Grok CLI 1.0.3</span>
      </footer>
    </aside>

    <section id="planDock" class="plan-dock hidden" aria-label="Active plan"></section>

    <section id="messages" class="messages" aria-label="Conversation" aria-live="polite">
      <div id="emptyState" class="empty-state">
        <div class="empty-mark" aria-hidden="true">&gt;_</div>
        <h2 id="emptyTitle">Grok Build</h2>
        <p id="emptyDescription">Agent desktop for Grok (still runs on a Code-OSS shell — chrome is simplified). Describe a change; diffs open in the editor beside chat. <strong>Open Grok Build IDE</strong> restores full Explorer / Activity Bar.</p>
        <button id="emptyConnect" class="secondary-button" type="button" data-action="connect">Connect agent</button>
      </div>
    </section>

    <footer class="composer-shell">
      <div class="composer-card" id="composerCard">
        <label class="sr-only" for="prompt">Message Grok Build</label>
        <textarea id="prompt" rows="2" placeholder="Ask anything…" spellcheck="true"></textarea>
        <div id="attachments" class="composer-attachments hidden" aria-label="Files attached to the prompt"></div>
        <div id="promptQueueBar" class="prompt-queue-bar hidden" role="status" aria-live="polite">
          <span id="promptQueueText">0 messages queued</span>
          <button id="promptQueueClear" class="prompt-queue-clear" type="button" title="Clear queued messages">Clear queue</button>
        </div>
        <div class="composer-actions">
          <div class="composer-context">
            <button id="filesButton" class="composer-icon-button" type="button" aria-label="Add context files or images" title="Add context files or images (@)"><span data-icon="plus"></span></button>
            <div class="composer-menu-control permission-control">
              <button id="permissionButton" class="composer-menu-button" type="button" aria-label="Permission mode" aria-haspopup="listbox" aria-expanded="false" aria-controls="permissionMenu" title="Permission mode">
                <span class="permission-icon" data-icon="shieldCheck"></span>
                <span id="permissionLabel" class="composer-menu-label">Ask</span>
                <span class="composer-menu-chevron" data-icon="chevronDown"></span>
              </button>
              <div id="permissionMenu" class="composer-menu hidden" role="listbox" aria-label="Permission mode">
                <button class="composer-menu-option" type="button" role="option" data-value="ask" aria-selected="true">Ask</button>
                <button class="composer-menu-option" type="button" role="option" data-value="acceptEdits" aria-selected="false">Accept edits</button>
                <button class="composer-menu-option" type="button" role="option" data-value="auto" aria-selected="false">Auto</button>
                <button class="composer-menu-option" type="button" role="option" data-value="plan" aria-selected="false">Plan</button>
                <button class="composer-menu-option" type="button" role="option" data-value="dontAsk" aria-selected="false">Don't ask</button>
                <button class="composer-menu-option" type="button" role="option" data-value="full" aria-selected="false">Full access</button>
              </div>
            </div>
            <div class="composer-menu-control model-control">
              <button id="modelButton" class="composer-menu-button" type="button" aria-label="Model" aria-haspopup="listbox" aria-expanded="false" aria-controls="modelMenu" title="Model" disabled>
                <span class="menu-icon" data-icon="box"></span>
                <span id="modelLabel" class="composer-menu-label">Default model</span>
                <span class="composer-menu-chevron" data-icon="chevronDown"></span>
              </button>
              <div id="modelMenu" class="composer-menu hidden" role="listbox" aria-label="Model"></div>
            </div>
            <div class="composer-menu-control effort-control">
              <button id="effortButton" class="composer-menu-button" type="button" aria-label="Reasoning effort" aria-haspopup="listbox" aria-expanded="false" aria-controls="effortMenu" title="Reasoning effort">
                <span class="menu-icon" data-icon="brain"></span>
                <span id="effortLabel" class="composer-menu-label">Default</span>
                <span class="composer-menu-chevron" data-icon="chevronDown"></span>
              </button>
              <div id="effortMenu" class="composer-menu hidden" role="listbox" aria-label="Reasoning effort"></div>
            </div>
            <div class="composer-menu-control mode-control hidden">
              <button id="modeButton" class="composer-menu-button" type="button" aria-label="Agent mode" aria-haspopup="listbox" aria-expanded="false" aria-controls="modeMenu" title="Agent mode" disabled>
                <span class="menu-icon" data-icon="listTodo"></span>
                <span id="modeLabel" class="composer-menu-label">Mode</span>
                <span class="composer-menu-chevron" data-icon="chevronDown"></span>
              </button>
              <div id="modeMenu" class="composer-menu hidden" role="listbox" aria-label="Agent mode"></div>
            </div>
          </div>
          <div class="usage-anchor">
            <button id="usageButton" class="composer-tool-button" type="button" title="Usage and session details" aria-expanded="false" aria-controls="usagePopover"><span data-icon="gauge"></span><span id="usageLabel">Usage</span></button>
            <div id="usagePopover" class="usage-popover hidden" role="dialog" aria-label="Usage and session details">
              <div class="usage-popover-head session-info-head">
                <div>
                  <strong>Usage</strong>
                  <span id="usageStatus">Session context and account plan</span>
                </div>
                <div class="session-head-actions">
                  <button id="refreshUsageButton" class="usage-icon-button" type="button" aria-label="Refresh session information" title="Refresh session information"><span data-icon="refreshCw"></span></button>
                  <button id="copyAllSessionInfoButton" class="session-copy-all" type="button">Copy all</button>
                </div>
              </div>
              <div id="sessionInfoTabs" class="session-info-tabs" role="tablist" aria-label="Usage sections">
                <button class="session-info-tab active" type="button" role="tab" aria-selected="true" data-session-tab="usage">Usage</button>
                <button class="session-info-tab" type="button" role="tab" aria-selected="false" data-session-tab="details">Session details</button>
              </div>
              <section class="session-info-panel usage-overview active" data-session-panel="usage">
                <div class="usage-section usage-context-card">
                  <div class="usage-section-title"><strong>Context window</strong><span id="usageContextPercent">—</span></div>
                  <div id="usageContextBarWrap" class="usage-progress" role="progressbar" aria-label="Session context used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="usageContextBar"></span></div>
                  <span id="usageDetail">Waiting for ACP session context data.</span>
                  <div id="sessionContextRows" class="usage-rows session-context-rows"></div>
                  <span id="sessionTurnUsage" class="usage-turn">Last turn: waiting for token counts…</span>
                </div>
                <div class="usage-section usage-account">
                  <div class="usage-section-title"><strong id="accountUsageTitle">Plan limit</strong><span id="accountUsagePercent">—</span></div>
                  <div id="accountUsageBarWrap" class="usage-progress" role="progressbar" aria-label="Account plan used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="accountUsageBar"></span></div>
                  <div id="accountUsageRows" class="usage-rows">
                    <span class="usage-empty">Open Account to load your Grok account plan.</span>
                  </div>
                  <span id="accountUsageError" class="usage-error hidden"></span>
                </div>
                <div class="usage-actions">
                  <span id="usageFetchedAt">Not refreshed yet</span>
                  <button id="manageUsageButton" class="usage-link-button" type="button">Manage usage <span data-icon="externalLink"></span></button>
                </div>
              </section>
              <section class="session-info-panel" data-session-panel="details">
                <div id="sessionInfoRows" class="session-info-rows"></div>
                <span id="sessionInfoEmpty" class="usage-empty">Connect to start a session.</span>
              </section>
            </div>
          </div>
          <button id="micButton" class="composer-tool-button mic-button hidden" type="button" aria-label="Voice input" title="Voice input unavailable in this runtime"><span data-icon="mic"></span></button>
          <button id="cancel" class="stop-button hidden" type="button" title="Stop current turn"><span data-icon="square"></span><span>Stop</span></button>
          <button id="send" class="send-button" type="button" aria-label="Send message" title="Send message (queues while Grok is working)"><span data-icon="arrowUp"></span></button>
        </div>
      </div>
      <span class="hint">Enter send · Shift+Enter newline · While working: type &amp; send queues next turn · Stop cancels current · @ / paste / drop context</span>
    </footer>
  </main>
  </div>
  <script nonce="${nonce}" src="${timelineScriptUri}"></script>
  <script nonce="${nonce}" src="${markdownScriptUri}"></script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}
