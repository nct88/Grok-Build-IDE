import * as vscode from "vscode";
import type { GrokSessionSummary } from "./sessionService.js";
import type { GrokController } from "./grokController.js";

export class SessionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly summary: GrokSessionSummary,
    public readonly isActive: boolean,
  ) {
    const label = summary.title || (summary.id.length > 12 ? `${summary.id.slice(0, 10)}…` : summary.id);
    super(label, vscode.TreeItemCollapsibleState.None);

    const timeStr = summary.updatedAt ? new Date(summary.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    this.description = isActive ? `Active · ${timeStr}` : timeStr;
    this.tooltip = `${summary.title}\n\nSession: ${summary.id}\nUpdated: ${summary.updatedAt || "N/A"}\nMessages: ${summary.messageCount ?? 0}`;
    this.iconPath = new vscode.ThemeIcon(isActive ? "comment-discussion" : "history");
    this.contextValue = isActive ? "activeSession" : "session";

    this.command = {
      command: "grokBuild.loadSessionFromTree",
      title: "Load Session",
      arguments: [summary.id],
    };
  }
}

export function sessionIdFromTreeArg(arg: unknown): string | undefined {
  if (typeof arg === "string" && arg.trim()) {
    return arg.trim();
  }
  if (arg instanceof SessionTreeItem) {
    return arg.summary.id;
  }
  if (arg && typeof arg === "object" && "summary" in arg) {
    const summary = (arg as { summary?: { id?: string } }).summary;
    if (summary?.id) {
      return summary.id;
    }
  }
  return undefined;
}

export function sessionTitleFromTreeArg(arg: unknown): string | undefined {
  if (arg instanceof SessionTreeItem) {
    return arg.summary.title;
  }
  if (arg && typeof arg === "object" && "summary" in arg) {
    const summary = (arg as { summary?: { title?: string } }).summary;
    if (summary?.title) {
      return summary.title;
    }
  }
  return undefined;
}

export class SessionTreeDataProvider
  implements vscode.TreeDataProvider<SessionTreeItem>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    SessionTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private activeSessionId: string | undefined;

  constructor(private readonly controller: GrokController) {}

  setActiveSession(sessionId: string | undefined): void {
    this.activeSessionId = sessionId;
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SessionTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SessionTreeItem): Promise<SessionTreeItem[]> {
    if (element) {
      return [];
    }
    try {
      const summaries = await this.controller.listLocalSessions();
      return summaries.map(
        (summary: GrokSessionSummary) =>
          new SessionTreeItem(summary, summary.id === this.activeSessionId),
      );
    } catch {
      return [];
    }
  }
}
