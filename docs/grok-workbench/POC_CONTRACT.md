# Grok Workbench IDE 0.3.9 POC contract

Source fork: Code - OSS `1.124.2` (`6928394f91b684055b873eecb8bc281365131f1c`)

Runnable Windows candidate: verified VSCodium `1.126.04524` runtime overlay. Its downloaded ZIP has SHA-256 `5B5BC348861CE861AED968B086233B45050694013C0607EA66B401F31B987C57`. This fallback is used because the local Code - OSS native build is blocked until the Visual Studio Spectre-mitigated libraries are installed.

## Observable outcomes

- A Windows x64 desktop application launches under the product name **Grok Workbench IDE (Unofficial)** with its own application ID, URL protocol, data directory, and user-data profile.
- The supplied Grok-compatible logo is used for the application and the Grok view.
- The Grok Build Workbench extension 0.8.3 is shipped as a portable preinstalled extension and opens without installing a VSIX.
- Grok Workbench uses an application identity separate from Visual Studio Code and assigns each BrowserWindow a unique AppUserModelID so project windows have separate taskbar buttons.
- Workspace Trust is disabled only in the portable profile; regular VS Code installations of the VSIX keep their normal trust policy.
- Grok remains a separate process connected over `grok agent stdio`; credentials are not copied into this repository or application bundle.
- Explorer, editor, terminal, source control, debugging, and the extension host remain functional Code - OSS surfaces.
- Microsoft Copilot is not configured as the product's default agent and is not auto-installed.
- The Windows x64 release is available as one self-contained EXE. The first run extracts the immutable application payload to a versioned per-user cache and starts Grok Workbench without an installer or manual ZIP extraction.
- Later runs reuse the validated cache, while a missing marker or critical runtime file forces a clean extraction.
- Open Folder replaces the current empty application window instead of leaving a redundant empty window behind.
- The composer `+` action selects real files and sends them to ACP as workspace-scoped resource links.
- Visible controls use a theme-aware 24×24 outline SVG icon system rather than platform-dependent emoji/font glyphs.
- Session browse/resume/delete/export, MCP/worktree/plugin/auth/doctor/memory actions, image attachments, Markdown responses, sticky plans, optional terminal reverse-RPC, and advanced launch flags are exposed through the Grok workbench.

## POC non-goals

- Code signing, public auto-update, production telemetry, crash upload, and a public extension registry.
- Bundling or redistributing the Grok CLI binary.
- Claiming official endorsement by xAI or Microsoft.
- macOS, Linux, ARM64, or a production installer before the unpackaged Windows app passes runtime verification.
- Running Electron entirely from one in-memory executable. Its DLL and resource tree is materialized automatically under the current user's local application data.

## Invariants

- Upstream MIT and third-party notices remain intact.
- The Grok extension preserves workspace-scoped filesystem handling and permission prompts. It permits read-only access to the current workspace's verified `.codex-shared/project-profiles` entry; unrelated external paths and external writes remain denied unless the user explicitly enables the broad trusted override.
- The POC uses isolated application/user-data names and does not overwrite Visual Studio Code or its profile.
- Core Code - OSS source changes stay minimal; Grok behavior lives in the built-in extension wherever possible.

## Acceptance matrix

| Area | Required state | Failure condition |
|---|---|---|
| Package | clean Windows x64 single-EXE task; legacy ZIP remains reproducible | task exits non-zero, output contains sidecar files, or executable is absent |
| Single EXE | first and second launch from a relocated file path | installer/manual extraction appears, the embedded payload is incomplete, or the second run extracts it again |
| Identity | About/title/process/user-data | any `Code - OSS` product identity remains in primary product surfaces |
| Preinstalled extension | first launch with empty profile | Grok view is missing or requires VSIX installation |
| Open Folder | choose one folder from an empty window | a second Grok Workbench window appears or the folder is not opened |
| Composer attachments | add, remove, and send workspace files | `+` has no visible result or ACP receives text without the selected resources |
| Extension registry | extracted or relocated portable folder | missing `location`, missing `relativeLocation`, invalid schema, or unresolved extension manifest |
| Authentication | logged out and already logged in | no actionable login path, credentials copied into repo, or existing auth is destroyed |
| ACP | connected, prompt, cancel, process exit | missing response, leaked process, or editor becomes unresponsive |
| Layout | Explorer left, Grok right, 1280×720 and 1920×1080; composer at 240/390/600 px and 100/125/150% scale | clipping, overlap, visible composer card more than 48 px above the webview bottom, shell over 180 px in the empty state, unintended horizontal scroll, or Send wrapping beside Stop |
| Icons | Dark/light, compact/full controls, connected/running, menu open, 100/125/150% scale | raw Unicode control glyphs, missing SVG hydration, non-24×24/currentColor geometry, baseline drift, clipping, or ambiguous action |
| Theme | dark and light | illegible logo/text or broken controls |
| Isolation | VS Code installed alongside POC | shared mutex, URL protocol, data directory, or app identity collision |
| Workspace trust | portable app opens a new folder without Restricted Mode | trust prompt blocks the bundled Grok view |
| Taskbar | two Grok project windows expose separate taskbar buttons | windows remain combined under one Grok button |

## Evidence levels

- Compilation proves source compatibility only.
- A packaged executable plus isolated launch proves POC runtime availability, not a successful local Code - OSS source build.
- Grok login and ACP require direct runtime checks.
- Visual acceptance requires screenshots from the packaged POC, not the existing VS Code extension host.
