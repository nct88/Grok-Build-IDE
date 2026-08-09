import type * as vscodeTypes from "vscode";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeCommand: vi.fn(),
  showWarningMessage: vi.fn(),
  configurationUpdate: vi.fn(),
  workspace: {
    workspaceFolders: undefined as vscodeTypes.WorkspaceFolder[] | undefined,
    registerTextDocumentContentProvider: vi.fn(() => ({ dispose: vi.fn() })),
  },
}));

vi.mock("vscode", () => ({
  ConfigurationTarget: { Workspace: 3 },
  workspace: {
    get workspaceFolders() {
      return mocks.workspace.workspaceFolders;
    },
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, fallback: unknown) => fallback),
      update: mocks.configurationUpdate,
    })),
    registerTextDocumentContentProvider: mocks.workspace.registerTextDocumentContentProvider,
  },
  commands: { executeCommand: mocks.executeCommand },
  window: { showWarningMessage: mocks.showWarningMessage },
  Disposable: class Disposable {
    constructor(private readonly callback: () => void) {}

    dispose(): void {
      this.callback();
    }
  },
}));

import type { GrokEvent } from "../acp/types.js";
import { GrokController } from "./grokController.js";

describe("GrokController workspace preflight", () => {
  beforeEach(() => {
    mocks.workspace.workspaceFolders = undefined;
    mocks.executeCommand.mockReset();
    mocks.showWarningMessage.mockReset();
    mocks.configurationUpdate.mockReset();
  });

  it("emits one actionable state when repeated connect attempts have no workspace", async () => {
    const output = { appendLine: vi.fn() } as unknown as vscodeTypes.OutputChannel;
    const controller = new GrokController(output);
    const events: GrokEvent[] = [];
    controller.onEvent((event) => events.push(event));

    await controller.connect();
    await controller.connect();
    await controller.connect();
    await controller.connect();

    expect(events).toEqual([
      {
        type: "state",
        state: "workspace_required",
        detail: "Open a folder to continue",
      },
    ]);
    expect(controller.connectionState).toBe("workspace_required");
    expect(mocks.showWarningMessage).not.toHaveBeenCalled();
    expect(mocks.executeCommand).toHaveBeenCalledTimes(1);
    expect(mocks.executeCommand).toHaveBeenCalledWith(
      "setContext",
      "grokBuild.connected",
      false,
    );
  });

  it("persists Full access as a real workspace permission policy", async () => {
    const output = { appendLine: vi.fn() } as unknown as vscodeTypes.OutputChannel;
    const controller = new GrokController(output);

    await controller.setPermissionMode("full");

    expect(mocks.configurationUpdate).toHaveBeenCalledWith(
      "permissionMode",
      "full",
      3,
    );
  });

  it("keeps an optional editor-follow failure from failing the agent event", async () => {
    const output = { appendLine: vi.fn() } as unknown as vscodeTypes.OutputChannel;
    const controller = new GrokController(output);
    const events: GrokEvent[] = [];
    controller.onEvent((event) => events.push(event));
    const internal = controller as unknown as {
      editReview: { followFile: (filePath: string, line?: number) => Promise<void> };
      handleClientEvent: (event: GrokEvent) => void;
    };
    internal.editReview.followFile = vi.fn().mockRejectedValue(
      new Error("Grok Build location is outside the open workspace"),
    );
    const toolEvent: GrokEvent = {
      type: "tool",
      toolCallId: "read-profile",
      title: "Read project profile",
      status: "failed",
      locations: [{ path: "H:\\projects\\.codex-shared\\project-profiles\\sample.md" }],
    };

    internal.handleClientEvent(toolEvent);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(events).toContainEqual(toolEvent);
    expect(output.appendLine).toHaveBeenCalledWith(
      "[follow] Grok Build location is outside the open workspace",
    );
  });
});
