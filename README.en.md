# Grok Build IDE

<p align="center">
  <strong>🇬🇧 English</strong> | <a href="./README.md">🇻🇳 Tiếng Việt</a>
</p>

Grok Build IDE is an optional source-code editor based on **Code - OSS**. It includes the **Grok Build Workbench** interface and connects to the **official Grok CLI** over ACP (`grok agent stdio`). It is intended for users who want a complete Explorer, editor, terminal, Source Control and debugging environment alongside the agent experience.

> Grok Build IDE is an independent repository. The primary agent desktop application is available at [`nct88/Grok-Build`](https://github.com/nct88/Grok-Build).

Current version: **1.0.10** — see [`build/grok/VERSION`](build/grok/VERSION).

## Downloads

The current release is hosted in a private repository and requires a GitHub account with access:

| Package | Purpose | Download |
|---|---|---|
| Inno Setup | Full Windows installation | [Grok-Build-IDE-Setup-1.0.10.exe](https://github.com/nct88/Grok-Build-IDE/releases/download/v1.0.10/Grok-Build-IDE-Setup-1.0.10.exe) |
| Portable EXE | Self-extracting portable executable | [Grok-Build-IDE-1.0.10-win32-x64-portable.exe](https://github.com/nct88/Grok-Build-IDE/releases/download/v1.0.10/Grok-Build-IDE-1.0.10-win32-x64-portable.exe) |
| Portable ZIP | Extract once for long-term portable use | [Grok-Build-IDE-1.0.10-win32-x64-portable.zip](https://github.com/nct88/Grok-Build-IDE/releases/download/v1.0.10/Grok-Build-IDE-1.0.10-win32-x64-portable.zip) |
| VSIX Update | Update Grok Build Workbench separately | [grok-build-workbench-1.0.10.vsix](https://github.com/nct88/Grok-Build-IDE/releases/download/v1.0.10/grok-build-workbench-1.0.10.vsix) |
| Manifest | Artifact sizes and SHA-256 hashes | [MANIFEST.json](https://github.com/nct88/Grok-Build-IDE/releases/download/v1.0.10/MANIFEST.json) |

Release page: [Grok Build IDE v1.0.10](https://github.com/nct88/Grok-Build-IDE/releases/tag/v1.0.10).

The Windows executables are not currently Authenticode-signed. SmartScreen may display a warning on first launch; verify the SHA-256 value in `MANIFEST.json` before running an artifact.

## How are Grok Build and Grok Build IDE different?

| Product | Focus | Use it when |
|---|---|---|
| **Grok Build** | Agent desktop interface focused on conversation and orchestration | You want a streamlined agent experience without a complete IDE |
| **Grok Build IDE** | Code - OSS with the integrated Grok Workbench | You want an editor, Explorer, terminal, SCM, debugging and an agent in one window |
| **Grok CLI** | Agent engine, authentication, sessions and tool loop | Required by both the Desktop and IDE applications |

Both interfaces share the same runtime boundary:

```text
Grok Build IDE (Code - OSS)
    → extension: extensions/grok-build-workbench
        → ACP client/controller
            → grok agent stdio
                → ~/.grok (CLI authentication, sessions and configuration)
```

## Key features

### Code - OSS development environment

- Explorer, multi-tab editor, search and source-code navigation.
- Integrated terminal, Source Control, diff editor and debugging surface.
- Code - OSS commands, settings, keybindings and extension system.
- **Open VSX** gallery in the Extensions view, with direct `grok-build-ide:extension/publisher.name` links and **Grok Build: Install Extension from Link…** (accepts an id, an Open VSX URL, or a Visual Studio Marketplace `itemName` link).
- Product identity, icons, installer and data directories separate from VS Code.

### Grok Build Workbench

- Chat with Grok CLI over ACP directly from the sidebar.
- Render Markdown, thinking, recap/last-turn, tool activity, turn state and errors. Resuming a session restores display-safe `summary_text` and never leaks encrypted payloads.
- TUI-style `/` menu in the composer (recap, rewind, imagine, effort, local skills).
- Select the permission mode, model, reasoning effort and session mode.
- Create sessions, browse the session list, load or resume sessions and rename them.
- Follow files opened or edited by the agent and open a diff when a file changes.
- Restrict reverse filesystem and terminal RPC through workspace boundaries and policy.
- Access shortcuts for MCP, worktrees, plugins, login/logout, doctor and CLI configuration.
- Display context tokens, account usage and a safe link to usage management.
- Support light and dark themes with a responsive interface for narrow sidebars.

### Switching between the two products

- **Open Grok Build** opens the agent desktop application.
- **Open Grok Build IDE** returns to the IDE interface.
- The default product surface in the IDE package is `grok-build-ide`.
- The agent-first IDE layout is optional, and the most recent choice is remembered.

## System requirements

### Users

- Windows x64 for the current release artifacts.
- Grok CLI installed and authenticated.
- Read/write access to the open workspace under the selected policy.

Verify the CLI before starting the IDE:

```powershell
grok --version
grok login
grok doctor
```

The extension locates the CLI through `grokBuild.executablePath`, `PATH` and common per-user Grok CLI installation locations.

### Development and packaging

- Node.js specified by [`.nvmrc`](.nvmrc) — currently 24.15.0.
- npm 11 distributed with the Node.js version in `.nvmrc` and the Code - OSS toolchain.
- Windows SDK/toolchain components required by native Code - OSS dependencies.
- .NET SDK for the portable single-file launcher.
- Inno Setup for the Windows installer.
- A valid base release candidate when reusing an existing payload.

## Installation and quick start

### Option 1: Inno Setup

1. Download `Grok-Build-IDE-Setup-1.0.10.exe`.
2. Compare its checksum with `MANIFEST.json`.
3. Run the installer.
4. Open **Grok Build IDE** from the Start Menu.
5. Select **Open Folder** and open a workspace.
6. Open Grok Build in the sidebar, review the mode and permissions, then connect.

Default installation path:

```text
%LOCALAPPDATA%\Programs\Grok Build IDE\Grok Build IDE.exe
```

### Option 2: Portable ZIP

1. Download and extract the ZIP into a permanent directory.
2. Run `Grok Build IDE.exe`.
3. Do not move the executable away from its payload because Electron requires the accompanying DLLs and `resources` directory.

### Option 3: Portable EXE

The Portable EXE extracts its payload into a versioned cache and then starts the IDE. It is convenient for a quick evaluation; the ZIP is better suited to regular use.

## Important Grok settings

Open **Settings**, search for `Grok Build`, or edit the following keys:

| Setting | Meaning |
|---|---|
| `grokBuild.defaultProduct` | Default product surface |
| `grokBuild.agentFirstLayout` | Enable the agent-first IDE layout |
| `grokBuild.executablePath` | Custom path to Grok CLI |
| `grokBuild.extraArguments` | Additional CLI arguments |
| `grokBuild.autoStart` | Connect automatically when the extension activates |
| `grokBuild.model` | Default model |
| `grokBuild.reasoningEffort` | Default reasoning effort |
| `grokBuild.permissionMode` | Tool execution and permission policy |
| `grokBuild.sandbox` | Agent sandbox mode |
| `grokBuild.tools` | Allowed tool list |
| `grokBuild.deniedTools` | Denied tool list |
| `grokBuild.worktree` | Enable or configure a worktree |
| `grokBuild.experimentalMemory` | Enable experimental memory |
| `grokBuild.disableWebSearch` | Disable web search when required |
| `grokBuild.rules` | Rules passed to the agent |
| `grokBuild.maxTurns` | Maximum number of agent turns |
| `grokBuild.enableTerminal` | Allow the reverse terminal host |
| `grokBuild.allowOutsideWorkspace` | Allow access outside the workspace |
| `grokBuild.followAgentFiles` | Automatically follow files the agent is working on |
| `grokBuild.openDiffOnEdit` | Open a diff when the agent edits a file |
| `grokBuild.voiceInput` | Display voice input when supported by the runtime |

Do not store tokens or credentials in synchronized or shared settings. Primary authentication remains owned by Grok CLI.

## Run from source

Clone the repository, install dependencies and start the application through the standard npm interface:

```powershell
git clone https://github.com/nct88/Grok-Build-IDE.git
cd Grok-Build-IDE
npm install
npm start
```

`npm start` invokes the platform-appropriate Code - OSS launcher, performs the required prelaunch compilation and opens Grok Build IDE. Application arguments can be passed after `--`, for example `npm start -- .\my-project`.

Check Grok Build Workbench:

```powershell
npm run check:grok
```

This gate includes:

1. TypeScript type checking.
2. Vitest unit and integration tests.
3. Production bundle generation.
4. Release and branding contracts.
5. Visual webview scenarios in light/dark themes and multiple sizes.

## Repository architecture

```text
grok-build-ide/
├─ src/                              Code - OSS workbench source
├─ extensions/
│  └─ grok-build-workbench/          ACP controller, webview and Grok UI
├─ build/                            Build scripts and product identity
│  └─ grok/VERSION                   Grok Build IDE release version
├─ resources/                        Platform-specific icons and resources
├─ scripts/
│  ├─ grok-release/                  Release orchestrator and publisher
│  ├─ start-grok-build-ide.mjs       npm start launcher
│  ├─ build-grok-workbench-*.ps1     Payload, launcher and installer builders
│  └─ verify-*.ps1                   Artifact and runtime gates
├─ docs/                             Architecture and operating guides
├─ CHANGELOG.md                      Versioned changes
├─ product.json                      IDE product identity
├─ packaging.json                    Packaging contract
└─ dist/                             Local versioned artifacts
```

### Runtime boundaries

- Code - OSS provides the editor shell.
- Grok-specific runtime and UI live in `extensions/grok-build-workbench`.
- Grok CLI runs as a child process and owns the agent loop and service connection.
- The extension does not store a copy of the Grok token in the webview.
- The ACP file host denies paths outside the workspace by default. This is not a shell sandbox; reverse-terminal is off by default and requires Workspace Trust.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Build and release

The version must remain synchronized across:

- `build/grok/VERSION`.
- `extensions/grok-build-workbench/package.json`.
- The release command's `-Version` argument.

Local candidate command (may auto-select the newest base):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\grok-release\build-and-publish.ps1 `
  -Version <semver>
```

Every public release must provide a reviewed base, clean source and an HTTPS URL. Signing is the default; use the unsigned waiver only when the publisher deliberately accepts SmartScreen warnings:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\grok-release\build-and-publish.ps1 `
  -Version <semver> `
  -BaseCandidateRoot <path-to-valid-payload> `
  -ReleaseBaseUrl <https-download-root> `
  -AllowUnsignedPublicRelease `
  -PublicRelease
```

Each version is immutable; the pipeline stops when `dist/<version>` already exists.

```text
dist/<version>/
├─ install/
│  └─ Grok-Build-IDE-Setup-<version>.exe
├─ portable/
│  ├─ Grok-Build-IDE-<version>-win32-x64-portable.exe
│  └─ Grok-Build-IDE-<version>-win32-x64-portable.zip
├─ update/
│  ├─ grok-build-workbench-<version>.vsix
│  └─ apply-update.ps1
├─ MANIFEST.json
└─ latest.json
```

The release pipeline verifies the Portable EXE, Portable ZIP, installer and VSIX before publishing metadata. Public mode requires a source/commit-matching base and HTTPS; the manifest truthfully records `public-signed` or `public-unsigned`. See [`docs/RELEASE.md`](docs/RELEASE.md) for the CI-before-tag publication flow.

## Updating only the extension

The `update/` package can update Grok Build Workbench without reinstalling the complete IDE:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\apply-update.ps1 `
  -InstallRoot "$env:LOCALAPPDATA\Programs\Grok Build IDE"
```

Close every IDE window before applying the update, then reopen the IDE after the script completes.

## Verifying final artifacts

Important scripts:

| Script | Purpose |
|---|---|
| `scripts/check-grok-brand-assets.ps1` | Verify branding assets and icons |
| `scripts/check-grok-release-contract.mjs` | Verify versioning, names and the release contract |
| `scripts/verify-portable-extension-registry.ps1` | Verify the extension registry in the payload |
| `scripts/verify-grok-workbench-portable-settings.ps1` | Verify portable settings |
| `scripts/verify-grok-workbench-single-exe.ps1` | Verify the launcher and payload |
| `scripts/test-grok-workbench-single-exe-runtime.ps1` | Run a smoke test against the final executable |

A successful build does not prove that the runtime or interface is correct. A release should be considered verified only after the applicable gates have run against the final artifact.

## Security and privacy

- Authentication tokens belong to Grok CLI and the Extension Host and are not sent to the webview.
- External URLs must pass the applicable HTTPS/localhost policy; URLs containing credentials are rejected.
- Filesystem access, editor follow and diff review are limited to the workspace by default.
- `allowOutsideWorkspace` is an explicit privilege expansion and should not be enabled by default.
- Do not commit `.env`, authentication files, cookie databases, private keys, tokens or logs containing personal information.
- Workspace Trust and portable defaults must be verified against the artifact, not only the source.

## Troubleshooting

### Grok sidebar does not connect

```powershell
grok --version
grok login
grok doctor
```

Then check `grokBuild.executablePath` and reload the IDE window.

### Sidebar does not appear

- Open the Activity Bar and select Grok Build.
- Run **Grok Build: Connect** or **Grok Build: New Session**.
- Confirm that `grok-build-workbench` is installed and registered in the portable profile.

### Portable EXE starts slowly on first launch

The launcher must extract the payload into a versioned cache. Later launches reuse that cache when its critical files remain valid.

### SmartScreen appears for the installer or portable build

The executables are currently unsigned. Run only artifacts from the official release after their SHA-256 values match `MANIFEST.json`.

### A VSIX update does not take effect

Close every IDE window before running `apply-update.ps1`, verify the `InstallRoot`, then restart the IDE.

## Related documentation

| Document | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Code - OSS and Grok extension architecture |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Dependency installation, source startup and checks |
| [`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md) | Build and release |
| [`CHANGELOG.md`](CHANGELOG.md) | Versioned changes |
| [`SECURITY.md`](SECURITY.md) | Security reporting policy |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Code - OSS contribution guide |

## Contributing

- Keep Grok-specific changes focused in `extensions/grok-build-workbench`, `build/grok`, `scripts/grok-release`, branding resources and related documentation.
- Preserve the standard Code - OSS layout: `src`, `extensions`, `build`, `resources`, `cli`, `remote` and `test`.
- Run the extension gate and applicable artifact checks before opening a pull request.
- Do not commit large artifacts, build caches, secrets or user data.
- Compare upstream Code - OSS issues with [`microsoft/vscode`](https://github.com/microsoft/vscode).

## Origin and licenses

This repository is based on Microsoft's **Code - OSS** source and preserves a layout and toolchain compatible with upstream.

- Code - OSS is licensed under [`LICENSE.txt`](LICENSE.txt) — the MIT License.
- Third-party dependency notices are available in [`ThirdPartyNotices.txt`](ThirdPartyNotices.txt).
- Upstream contribution guidance is available in [`CONTRIBUTING.md`](CONTRIBUTING.md).

Visual Studio Code is Microsoft's separate distribution with its own product customizations and licensing. Grok Build IDE is not Visual Studio Code and is not represented as an official Microsoft product.

Grok CLI and Grok models belong to their respective owners in the xAI/Grok ecosystem. Grok Build IDE is an independent integration that uses the official CLI over ACP and does not claim an official affiliation without written confirmation.
