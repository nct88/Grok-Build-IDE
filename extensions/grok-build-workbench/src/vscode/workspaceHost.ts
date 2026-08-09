import * as path from "node:path";
import * as vscode from "vscode";
import type * as acp from "@agentclientprotocol/sdk";
import type { GrokHost } from "../acp/types.js";
import { canReadWorkspacePath, canWriteWorkspacePath } from "./workspacePathPolicy.js";

export interface WorkspaceHostOptions {
  requestPermission: (
    request: acp.RequestPermissionRequest,
  ) => Promise<acp.RequestPermissionResponse>;
  onFileWrite?: (change: {
    path: string;
    oldText?: string;
    newText: string;
  }) => void | Promise<void>;
}

export class WorkspaceHost implements GrokHost {
  constructor(private readonly options: WorkspaceHostOptions) {}

  async requestPermission(
    request: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    return this.options.requestPermission(request);
  }

  async readTextFile(
    request: acp.ReadTextFileRequest,
  ): Promise<acp.ReadTextFileResponse> {
    const uri = this.checkedFileUri(request.path, "read");
    const bytes = await vscode.workspace.fs.readFile(uri);
    let content = new TextDecoder().decode(bytes);

    if (request.line !== undefined && request.line !== null) {
      const lines = content.split(/\r?\n/);
      const start = Math.max(0, request.line - 1);
      const limit = request.limit ?? lines.length;
      content = lines.slice(start, start + limit).join("\n");
    }
    return { content };
  }

  async writeTextFile(
    request: acp.WriteTextFileRequest,
  ): Promise<acp.WriteTextFileResponse> {
    const uri = this.checkedFileUri(request.path, "write");
    let oldText: string | undefined;
    try {
      oldText = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    } catch (error) {
      if (!(error instanceof vscode.FileSystemError && error.code === "FileNotFound")) {
        throw error;
      }
    }
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(request.content));
    await this.options.onFileWrite?.({
      path: uri.fsPath,
      ...(oldText !== undefined ? { oldText } : {}),
      newText: request.content,
    });
    return {};
  }

  async selectAuthMethod(
    methods: acp.AuthMethod[],
  ): Promise<acp.AuthMethod | undefined> {
    if (methods.length === 1) {
      const method = methods[0];
      if (!method) {
        return undefined;
      }
      const options: vscode.MessageOptions = {
        modal: true,
        ...(method.description ? { detail: method.description } : {}),
      };
      const choice = await vscode.window.showInformationMessage(
        `Grok Build requires authentication using “${method.name}”. Continue?`,
        options,
        "Continue",
      );
      return choice === "Continue" ? method : undefined;
    }

    interface AuthPickItem extends vscode.QuickPickItem {
      method: acp.AuthMethod;
    }
    const items: AuthPickItem[] = methods.map((method) => ({
      label: method.name,
      ...(method.description ? { description: method.description } : {}),
      method,
    }));
    return (
      await vscode.window.showQuickPick(items, {
        title: "Authenticate Grok Build",
        placeHolder: "Choose an authentication method",
        ignoreFocusOut: true,
      })
    )?.method;
  }

  private checkedFileUri(rawPath: string, operation: "read" | "write"): vscode.Uri {
    if (!path.isAbsolute(rawPath)) {
      throw new Error(`ACP filesystem path must be absolute: ${rawPath}`);
    }
    const resolved = path.resolve(rawPath);
    const allowOutside = vscode.workspace
      .getConfiguration("grokBuild")
      .get<boolean>("allowOutsideWorkspace", false);
    const options = {
      workspaceRoots: (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
      allowOutsideWorkspace: allowOutside,
    };
    const allowed = operation === "read"
      ? canReadWorkspacePath(resolved, options)
      : canWriteWorkspacePath(resolved, options);
    if (!allowed) {
      throw new Error(`ACP filesystem ${operation} access is outside the open workspace: ${resolved}`);
    }
    return vscode.Uri.file(resolved);
  }
}
