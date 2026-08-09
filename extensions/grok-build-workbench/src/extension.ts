import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { ChatViewProvider } from "./vscode/chatViewProvider.js";
import { GrokController } from "./vscode/grokController.js";
import {
  SessionTreeDataProvider,
  sessionIdFromTreeArg,
  sessionTitleFromTreeArg,
} from "./vscode/sessionTreeProvider.js";
import { GrokInlineCompletionProvider } from "./vscode/inlineCompletionProvider.js";
import { LayoutModeService } from "./vscode/layoutModeService.js";
import { setSessionGeneratedTitle } from "./vscode/sessionService.js";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Grok Build 1.0", { log: true });
  const controller = new GrokController(output);
  const layoutMode = new LayoutModeService(context);
  const provider = new ChatViewProvider(context.extensionUri, controller, layoutMode);

  const sessionTreeProvider = new SessionTreeDataProvider(controller);
  const inlineCompletionProvider = new GrokInlineCompletionProvider();

  context.subscriptions.push(
    output,
    controller,
    layoutMode,
    provider,
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerTreeDataProvider("grokBuild.sessions", sessionTreeProvider),
    vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, inlineCompletionProvider),
    vscode.commands.registerCommand("grokBuild.loadSessionFromTree", (sessionId: string) => {
      if (sessionId) {
        controller.loadSession(sessionId);
        sessionTreeProvider.setActiveSession(sessionId);
      }
    }),
    vscode.commands.registerCommand("grokBuild.refreshSessionsTree", () => sessionTreeProvider.refresh()),
    vscode.commands.registerCommand("grokBuild.renameSession", async (arg?: unknown) => {
      const sessionId = sessionIdFromTreeArg(arg);
      if (!sessionId) {
        void vscode.window.showWarningMessage("Select a conversation in History first.");
        return;
      }
      const currentTitle = sessionTitleFromTreeArg(arg) ?? sessionId;
      const next = await vscode.window.showInputBox({
        title: "Rename Conversation",
        prompt: "Display title for this conversation (saved to local summary.json)",
        value: currentTitle,
        placeHolder: "e.g. Fix paste clipboard images",
        ignoreFocusOut: true,
        validateInput: (value) => {
          const trimmed = value.trim();
          if (!trimmed) {
            return "Title cannot be empty.";
          }
          if (trimmed.length > 200) {
            return "Title is too long (max 200 characters).";
          }
          return undefined;
        },
      });
      if (next === undefined) {
        return;
      }
      try {
        const saved = await setSessionGeneratedTitle({ sessionId, title: next });
        sessionTreeProvider.refresh();
        void vscode.window.showInformationMessage(`Conversation renamed to “${saved}”.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Could not rename conversation: ${message}`);
        output.error(`renameSession failed: ${message}`);
      }
    }),
    vscode.commands.registerCommand("grokBuild.connect", () => controller.connect()),
    vscode.commands.registerCommand("grokBuild.disconnect", () => controller.disconnect()),
    vscode.commands.registerCommand("grokBuild.newSession", () => {
      controller.newSession();
      sessionTreeProvider.setActiveSession(undefined);
      void layoutMode.enterAgentMode({ quiet: true });
    }),
    vscode.commands.registerCommand("grokBuild.clearConversation", () =>
      controller.clearConversation(),
    ),
    vscode.commands.registerCommand("grokBuild.exportSession", () =>
      controller.exportActiveSession(),
    ),
    vscode.commands.registerCommand("grokBuild.sessions", () => provider.showSessionBrowser()),
    vscode.commands.registerCommand("grokBuild.mcp", () => provider.showMcpManager()),
    vscode.commands.registerCommand("grokBuild.worktree", () => provider.showWorktreeManager()),
    vscode.commands.registerCommand("grokBuild.plugins", () => provider.showPluginManager()),
    vscode.commands.registerCommand("grokBuild.openExplorer", () => provider.openExplorer()),
    vscode.commands.registerCommand("grokBuild.openIde", () => layoutMode.openGrokBuildIde()),
    vscode.commands.registerCommand("grokBuild.openGrokBuildIde", () => layoutMode.openGrokBuildIde()),
    vscode.commands.registerCommand("grokBuild.openGrokBuild", () => layoutMode.openGrokBuild()),
    vscode.commands.registerCommand("grokBuild.agentMode", () => layoutMode.openGrokBuild()),
    vscode.commands.registerCommand("grokBuild.toggleAgentIde", () => layoutMode.toggle()),
    vscode.commands.registerCommand("grokBuild.layout", () => provider.showLayoutMenu()),
    vscode.commands.registerCommand("grokBuild.login", async () => {
      const { runLogin } = await import("./vscode/pluginService.js");
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const message = await runLogin({
        executable: controller.getExecutable(),
        ...(cwd ? { cwd } : {}),
      });
      void vscode.window.showInformationMessage(message);
    }),
    vscode.commands.registerCommand("grokBuild.logout", async () => {
      const { runLogout } = await import("./vscode/pluginService.js");
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const message = await runLogout({
        executable: controller.getExecutable(),
        ...(cwd ? { cwd } : {}),
      });
      void vscode.window.showInformationMessage(message);
    }),
    vscode.commands.registerCommand("grokBuild.doctor", async () => {
      const { runDoctor } = await import("./vscode/pluginService.js");
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const message = await runDoctor({
        executable: controller.getExecutable(),
        ...(cwd ? { cwd } : {}),
      });
      const doc = await vscode.workspace.openTextDocument({
        content: message,
        language: "markdown",
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    }),
    vscode.commands.registerCommand("grokBuild.memoryClear", async () => {
      const choice = await vscode.window.showWarningMessage(
        "Clear Grok memory for the current workspace?",
        { modal: true },
        "Clear Workspace Memory",
      );
      if (choice !== "Clear Workspace Memory") {
        return;
      }
      const { clearMemory } = await import("./vscode/pluginService.js");
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const message = await clearMemory({
        executable: controller.getExecutable(),
        ...(cwd ? { cwd } : {}),
      });
      void vscode.window.showInformationMessage(message);
    }),
    vscode.commands.registerCommand("grokBuild.openTaskbarSettings", async () => {
      if (process.platform !== "win32") {
        await vscode.window.showInformationMessage(
          "Separate taskbar buttons are configured by the desktop environment on this platform.",
        );
        return;
      }
      const opened = await vscode.env.openExternal(vscode.Uri.parse("ms-settings:taskbar"));
      if (!opened) {
        await vscode.window.showWarningMessage("Windows Taskbar settings could not be opened.");
      }
    }),
    vscode.commands.registerCommand("grokBuild.openSettings", () =>
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "@ext:local-grok-workbench.grok-build-workbench",
      ),
    ),
    vscode.commands.registerCommand("grokBuild.openCliConfig", async () => {
      const uri = vscode.Uri.file(path.join(os.homedir(), ".grok", "config.toml"));
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        const choice = await vscode.window.showInformationMessage(
          "Grok Build config.toml does not exist yet.",
          "Create config",
        );
        if (choice !== "Create config") {
          return;
        }
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
        await vscode.workspace.fs.writeFile(
          uri,
          new TextEncoder().encode("# Grok Build CLI settings\n"),
        );
      }
      await vscode.window.showTextDocument(uri, { preview: false });
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("grokBuild")) {
        controller.configurationChanged();
      }
      if (event.affectsConfiguration("grokBuild.agentFirstLayout")) {
        void layoutMode.applyStartupLayout();
      }
    }),
  );

  // Grok Build 1.0: agent-first startup (chat + conversation history).
  void layoutMode.applyStartupLayout().then(
    undefined,
    (error: unknown) => output.warn(`Unable to apply agent-first layout: ${String(error)}`),
  );
  const sessionsMigratedKey = "grokBuild.sessionsActivityBarMigrated.v1";
  if (!context.globalState.get(sessionsMigratedKey)) {
    void context.globalState.update(sessionsMigratedKey, true);
  }
}

export function deactivate(): void {}
