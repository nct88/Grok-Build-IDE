import * as path from "node:path";
import * as vscode from "vscode";
import { canReadWorkspacePath, canWriteWorkspacePath } from "./workspacePathPolicy.js";

interface StoredChange {
  path: string;
  oldText?: string;
  newText: string;
}

const SNAPSHOT_SCHEME = "grok-build-snapshot";

export class EditReviewService implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly snapshots = new Map<string, string>();
  private readonly changes = new Map<string, StoredChange>();
  private readonly registration: vscode.Disposable;
  private sequence = 0;
  private lastFollow = "";
  /** Serialized editor opens so the workbench UI stays responsive near turn end. */
  private readonly revealQueue: string[] = [];
  private revealing = false;
  private autoOpenedThisTurn = 0;
  private followTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingFollow: { path: string; line?: number } | undefined;

  constructor() {
    this.registration = vscode.workspace.registerTextDocumentContentProvider(
      SNAPSHOT_SCHEME,
      this,
    );
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.snapshots.get(uri.query) ?? "";
  }

  /** Call at turn start/end so auto-open budget resets. */
  resetTurnOpenBudget(): void {
    this.autoOpenedThisTurn = 0;
    this.lastFollow = "";
  }

  async recordChange(change: StoredChange, reveal = true): Promise<string> {
    const changeId = `change-${Date.now()}-${++this.sequence}`;
    this.changes.set(changeId, change);
    this.trimCache();
    if (reveal) {
      this.enqueueReveal(changeId);
    }
    return changeId;
  }

  /**
   * When false (default), each agent edit/diff opens a **pinned** editor tab
   * (like double-click in VS Code). When true, tabs use preview mode and replace each other.
   */
  private usePreviewTabs(): boolean {
    return vscode.workspace
      .getConfiguration("grokBuild")
      .get<boolean>("openEditsInPreview", false);
  }

  private maxAutoOpenEdits(): number {
    const n = vscode.workspace
      .getConfiguration("grokBuild")
      .get<number>("maxAutoOpenEdits", 6);
    return Math.max(0, Math.min(30, Number.isFinite(n) ? n : 6));
  }

  private enqueueReveal(changeId: string): void {
    const max = this.maxAutoOpenEdits();
    if (this.autoOpenedThisTurn >= max) {
      // Still stored for Review button; skip auto tab to avoid UI freeze storms.
      return;
    }
    this.autoOpenedThisTurn += 1;
    this.revealQueue.push(changeId);
    void this.pumpRevealQueue();
  }

  private async pumpRevealQueue(): Promise<void> {
    if (this.revealing) {
      return;
    }
    this.revealing = true;
    try {
      while (this.revealQueue.length > 0) {
        const changeId = this.revealQueue.shift();
        if (!changeId) {
          break;
        }
        try {
          await this.review(changeId, true);
        } catch {
          // Individual open failures should not block the rest of the queue.
        }
        // Yield so Chromium/workbench can paint between heavy diff opens.
        await new Promise<void>((resolve) => setTimeout(resolve, 75));
      }
    } finally {
      this.revealing = false;
      if (this.revealQueue.length > 0) {
        void this.pumpRevealQueue();
      }
    }
  }

  async review(changeId: string, preserveFocus = false): Promise<void> {
    const change = this.changes.get(changeId);
    if (!change) {
      throw new Error("This Grok Build change is no longer available for review.");
    }
    this.assertReviewablePath(change.path);
    const baseName = path.basename(change.path);
    const left = this.snapshotUri(changeId, "before", change.oldText ?? "", baseName);
    const target = vscode.Uri.file(path.resolve(change.path));
    let right = this.snapshotUri(changeId, "after", change.newText, baseName);
    try {
      const current = new TextDecoder().decode(await vscode.workspace.fs.readFile(target));
      if (current === change.newText) {
        right = target;
      }
    } catch {
      // A proposed/new file can still be reviewed using the immutable after snapshot.
    }
    // preview:false => separate tab per change (does not overwrite the previous review tab).
    await vscode.commands.executeCommand(
      "vscode.diff",
      left,
      right,
      `Grok Build · ${baseName}`,
      { preview: this.usePreviewTabs(), preserveFocus },
    );
  }

  async followFile(filePath: string, line?: number): Promise<void> {
    if (!vscode.workspace.getConfiguration("grokBuild").get("followAgentFiles", true)) {
      return;
    }
    if (!this.canFollowPath(filePath)) {
      return;
    }
    // Debounce: many tool locations arrive in bursts near turn end.
    this.pendingFollow = line === undefined ? { path: filePath } : { path: filePath, line };
    if (this.followTimer) {
      return;
    }
    this.followTimer = setTimeout(() => {
      this.followTimer = undefined;
      const pending = this.pendingFollow;
      this.pendingFollow = undefined;
      if (pending) {
        void this.openFollowedFile(pending.path, pending.line);
      }
    }, 120);
  }

  private async openFollowedFile(filePath: string, line?: number): Promise<void> {
    const resolved = path.resolve(filePath);
    const key = `${resolved}:${line ?? 1}`;
    if (key === this.lastFollow) {
      return;
    }
    // Share budget with auto-opened diffs so follow+diff storms do not freeze the shell.
    if (this.autoOpenedThisTurn >= this.maxAutoOpenEdits()) {
      return;
    }
    this.lastFollow = key;
    this.autoOpenedThisTurn += 1;
    const uri = vscode.Uri.file(resolved);
    try {
      await vscode.workspace.fs.stat(uri);
      const document = await vscode.workspace.openTextDocument(uri);
      const requestedLine = Math.max(0, (line ?? 1) - 1);
      const position = new vscode.Position(
        Math.min(requestedLine, Math.max(0, document.lineCount - 1)),
        0,
      );
      await vscode.window.showTextDocument(document, {
        preview: this.usePreviewTabs(),
        preserveFocus: true,
        selection: new vscode.Range(position, position),
      });
    } catch {
      // Locations may be announced before a new file exists. A later diff/write reveals it.
    }
  }

  dispose(): void {
    if (this.followTimer) {
      clearTimeout(this.followTimer);
      this.followTimer = undefined;
    }
    this.registration.dispose();
    this.snapshots.clear();
    this.changes.clear();
    this.revealQueue.length = 0;
  }

  private snapshotUri(
    changeId: string,
    side: string,
    text: string,
    baseName = "file",
  ): vscode.Uri {
    const key = `${changeId}-${side}`;
    this.snapshots.set(key, text);
    // Unique path per change so the workbench opens distinct tabs (not one reused preview).
    const safeName = baseName.replace(/[\\/:*?"<>|]/g, "_") || "file";
    return vscode.Uri.from({
      scheme: SNAPSHOT_SCHEME,
      path: `/${changeId}/${side}/${safeName}`,
      query: key,
    });
  }

  private canFollowPath(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    const allowOutside = vscode.workspace
      .getConfiguration("grokBuild")
      .get<boolean>("allowOutsideWorkspace", false);
    return canReadWorkspacePath(resolved, {
      workspaceRoots: (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
      allowOutsideWorkspace: allowOutside,
    });
  }

  private assertReviewablePath(filePath: string): void {
    const resolved = path.resolve(filePath);
    const allowOutside = vscode.workspace
      .getConfiguration("grokBuild")
      .get<boolean>("allowOutsideWorkspace", false);
    const allowed = canWriteWorkspacePath(resolved, {
      workspaceRoots: (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
      allowOutsideWorkspace: allowOutside,
    });
    if (!allowed) {
      throw new Error(`Grok Build location is outside the open workspace: ${resolved}`);
    }
  }

  private trimCache(): void {
    while (this.changes.size > 50) {
      const oldest = this.changes.keys().next().value as string | undefined;
      if (!oldest) {
        break;
      }
      this.changes.delete(oldest);
      this.snapshots.delete(`${oldest}-before`);
      this.snapshots.delete(`${oldest}-after`);
    }
  }
}
