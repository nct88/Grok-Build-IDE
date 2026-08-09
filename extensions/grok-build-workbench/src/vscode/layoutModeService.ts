import * as vscode from "vscode";

/**
 * Two product surfaces (Antigravity-style split):
 * - **Grok Build** (`grok-build`) — agent desktop chrome (hide classic VS Code chrome)
 * - **Grok Build IDE** (`grok-build-ide`) — full VS Code / Explorer layout
 *
 * Both still run on Code-OSS. Agent product only *dresses down* the workbench;
 * it is not a separate Electron shell like Antigravity 2.5.
 */
export type GrokProductId = "grok-build" | "grok-build-ide";

/** @deprecated use GrokProductId */
export type GrokLayoutMode = "agent" | "ide";

const STATE_KEY = "grokBuild.productMode.v1";
const LEGACY_STATE_KEY = "grokBuild.layoutMode.v1";
const CHROME_BACKUP_KEY = "grokBuild.chromeBackup.v1";

export interface ProductDescriptor {
  id: GrokProductId;
  shortName: string;
  fullName: string;
  tagline: string;
}

export const PRODUCTS: Record<GrokProductId, ProductDescriptor> = {
  "grok-build": {
    id: "grok-build",
    shortName: "Grok Build",
    fullName: "Grok Build",
    tagline: "Agent desktop — conversations first (Code-OSS shell)",
  },
  "grok-build-ide": {
    id: "grok-build-ide",
    shortName: "Grok Build IDE",
    fullName: "Grok Build IDE",
    tagline: "Full IDE — Explorer, editor, terminal, SCM",
  },
};

interface ChromeBackup {
  activityBarLocation?: string;
  menuBarVisibility?: string;
  sideBarLocation?: string;
}

function productFromLayout(mode: GrokLayoutMode): GrokProductId {
  return mode === "ide" ? "grok-build-ide" : "grok-build";
}

function layoutFromProduct(id: GrokProductId): GrokLayoutMode {
  return id === "grok-build-ide" ? "ide" : "agent";
}

async function tryCommand(id: string): Promise<boolean> {
  try {
    await vscode.commands.executeCommand(id);
    return true;
  } catch {
    return false;
  }
}

export class LayoutModeService implements vscode.Disposable {
  private product: GrokProductId = "grok-build-ide";
  private readonly statusItem: vscode.StatusBarItem;
  private readonly switchItem: vscode.StatusBarItem;
  private readonly listeners = new Set<(product: GrokProductId) => void>();

  constructor(private readonly context: vscode.ExtensionContext) {
    const stored =
      context.globalState.get<GrokProductId>(STATE_KEY) ??
      (context.globalState.get<GrokLayoutMode>(LEGACY_STATE_KEY)
        ? productFromLayout(context.globalState.get<GrokLayoutMode>(LEGACY_STATE_KEY)!)
        : undefined);
    if (stored === "grok-build" || stored === "grok-build-ide") {
      this.product = stored;
    } else {
      const cfg = vscode.workspace
        .getConfiguration("grokBuild")
        .get<string>("defaultProduct", "grok-build-ide");
      this.product = cfg === "grok-build-ide" ? "grok-build-ide" : "grok-build";
    }

    this.statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusItem.name = "Grok Build product";
    this.statusItem.command = "grokBuild.toggleAgentIde";
    this.statusItem.tooltip = "Switch between Grok Build and Grok Build IDE";

    this.switchItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    this.switchItem.name = "Open other Grok product";
    this.refreshStatusBar();
    this.statusItem.show();
    this.switchItem.show();
  }

  get current(): GrokLayoutMode {
    return layoutFromProduct(this.product);
  }

  get currentProduct(): GrokProductId {
    return this.product;
  }

  get descriptor(): ProductDescriptor {
    return PRODUCTS[this.product];
  }

  onDidChangeProduct(listener: (product: GrokProductId) => void): vscode.Disposable {
    this.listeners.add(listener);
    return new vscode.Disposable(() => this.listeners.delete(listener));
  }

  agentFirstEnabled(): boolean {
    return vscode.workspace
      .getConfiguration("grokBuild")
      .get<boolean>("agentFirstLayout", false);
  }

  async applyStartupLayout(): Promise<void> {
    if (!this.agentFirstEnabled() && this.product === "grok-build") {
      await this.openGrokBuildIde({ quiet: true });
      return;
    }
    if (this.product === "grok-build-ide") {
      await this.openGrokBuildIde({ quiet: true });
    } else {
      await this.openGrokBuild({ quiet: true });
    }
  }

  async openGrokBuild(options?: { quiet?: boolean }): Promise<void> {
    await this.setProduct("grok-build", options);
  }

  async openGrokBuildIde(options?: { quiet?: boolean }): Promise<void> {
    await this.setProduct("grok-build-ide", options);
  }

  async enterAgentMode(options?: { quiet?: boolean }): Promise<void> {
    await this.openGrokBuild(options);
  }

  async enterIdeMode(options?: { quiet?: boolean }): Promise<void> {
    await this.openGrokBuildIde(options);
  }

  async toggle(): Promise<void> {
    if (this.product === "grok-build") {
      await this.openGrokBuildIde();
    } else {
      await this.openGrokBuild();
    }
  }

  dispose(): void {
    this.statusItem.dispose();
    this.switchItem.dispose();
    this.listeners.clear();
  }

  private async setProduct(
    product: GrokProductId,
    options?: { quiet?: boolean },
  ): Promise<void> {
    this.product = product;
    await this.context.globalState.update(STATE_KEY, product);
    await this.context.globalState.update(LEGACY_STATE_KEY, layoutFromProduct(product));
    await vscode.commands.executeCommand("setContext", "grokBuild.product", product);
    await vscode.commands.executeCommand(
      "setContext",
      "grokBuild.layoutMode",
      layoutFromProduct(product),
    );
    this.refreshStatusBar();

    if (product === "grok-build") {
      await this.applyAgentDesktopChrome();
    } else {
      await this.applyIdeChrome();
    }

    for (const listener of this.listeners) {
      try {
        listener(product);
      } catch {
        // ignore
      }
    }

    if (!options?.quiet) {
      const d = PRODUCTS[product];
      void vscode.window.setStatusBarMessage(`${d.fullName} · ${d.tagline}`, 3500);
    }
  }

  private refreshStatusBar(): void {
    const d = PRODUCTS[this.product];
    this.statusItem.text = `$(rocket) ${d.shortName}`;
    this.statusItem.backgroundColor =
      this.product === "grok-build"
        ? new vscode.ThemeColor("statusBarItem.prominentBackground")
        : undefined;

    if (this.product === "grok-build") {
      this.switchItem.text = "$(window) Open Grok Build IDE";
      this.switchItem.command = "grokBuild.openGrokBuildIde";
      this.switchItem.tooltip = "Switch to full IDE chrome (Explorer, activity bar, terminal)";
    } else {
      this.switchItem.text = "$(comment-discussion) Open Grok Build";
      this.switchItem.command = "grokBuild.openGrokBuild";
      this.switchItem.tooltip = "Switch to agent desktop chrome (hide classic VS Code UI)";
    }
  }

  /**
   * Agent desktop: hide classic VS Code chrome so conversation dominates.
   * Editor area stays available for diffs (Antigravity-like dual pane).
   */
  private async applyAgentDesktopChrome(): Promise<void> {
    await this.backupChromeIfNeeded();

    // Hide Activity Bar (Explorer/Search/SCM icons) — biggest "this is VS Code" cue.
    await this.updateSetting("workbench", "activityBar.location", "hidden");
    // Compact / toggle menu bar (File Edit …)
    await this.updateSetting("window", "menuBarVisibility", "compact");
    // Prefer secondary sidebar for agent chat
    await this.updateSetting("workbench", "secondarySideBar.defaultVisibility", "visible");

    // Close primary sidebar (Explorer tree) and bottom panel (Terminal)
    await tryCommand("workbench.action.closeSidebar");
    await tryCommand("workbench.action.closePanel");

    // Ensure agent chat is open in the auxiliary/secondary bar
    await tryCommand("workbench.action.focusAuxiliaryBar");
    await vscode.commands
      .executeCommand("workbench.view.extension.grokBuild")
      .then(undefined, () => undefined);

    // History list is optional in agent mode — open without stealing focus if possible
    await vscode.commands
      .executeCommand("workbench.view.extension.grokBuildSessions")
      .then(undefined, () => undefined);
    // Re-focus chat after sessions reveal
    await vscode.commands
      .executeCommand("workbench.view.extension.grokBuild")
      .then(undefined, () => undefined);

    // If auxiliary bar was closed, toggle open then focus chat
    await tryCommand("workbench.action.toggleAuxiliaryBar");
    await vscode.commands
      .executeCommand("workbench.view.extension.grokBuild")
      .then(undefined, () => undefined);
  }

  /** Full IDE: restore chrome and focus Explorer. */
  private async applyIdeChrome(): Promise<void> {
    const backup = this.context.globalState.get<ChromeBackup>(CHROME_BACKUP_KEY);

    await this.updateSetting(
      "workbench",
      "activityBar.location",
      backup?.activityBarLocation ?? "default",
    );
    await this.updateSetting(
      "window",
      "menuBarVisibility",
      backup?.menuBarVisibility ?? "classic",
    );

    await tryCommand("workbench.view.explorer");
    await tryCommand("workbench.action.focusSideBar");
  }

  private async backupChromeIfNeeded(): Promise<void> {
    const existing = this.context.globalState.get<ChromeBackup>(CHROME_BACKUP_KEY);
    if (existing) {
      return;
    }
    const workbench = vscode.workspace.getConfiguration("workbench");
    const windowCfg = vscode.workspace.getConfiguration("window");
    const backup: ChromeBackup = {
      activityBarLocation: workbench.get<string>("activityBar.location", "default"),
      menuBarVisibility: windowCfg.get<string>("menuBarVisibility", "classic"),
      sideBarLocation: workbench.get<string>("sideBar.location", "left"),
    };
    await this.context.globalState.update(CHROME_BACKUP_KEY, backup);
  }

  private async updateSetting(
    section: string,
    key: string,
    value: string,
  ): Promise<void> {
    try {
      await vscode.workspace
        .getConfiguration(section)
        .update(key, value, vscode.ConfigurationTarget.Global);
    } catch {
      // Some keys may be restricted; ignore and rely on commands.
    }
  }
}
