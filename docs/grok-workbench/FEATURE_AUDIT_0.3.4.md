# Grok Workbench 0.3.4 feature audit

Date: 2026-08-02

Scope: the custom Grok Build view and the portable behaviors changed by this project. Upstream Code - OSS editor, terminal, source control, debugging, and extension-marketplace behavior are inherited and were not exhaustively re-audited here.

## Outcome

No intentionally decorative or no-op control remains in the audited Grok surface. The composer `+` button was the confirmed false affordance: it only reopened Explorer even though its placement implied attachment. Version 0.3.4 replaces it with a native multi-file picker, visible removable chips, workspace-boundary validation, and ACP `resource_link` prompt content.

The portable profile's `window.openFoldersInNewWindow: on` setting was the cause of the redundant empty window. It is now `off`, is generated from a checked-in profile template, and is covered by structural and live single-EXE tests.

## Control matrix

| Surface | Actual behavior | Evidence | Result |
|---|---|---|---|
| Composer `+` | Selects one or more files, renders removable chips, and includes them in the next ACP prompt as `resource_link` blocks | Browser interaction at 240/390/580 px; ACP mock-agent regression; packaged script inspection | Functional |
| Remove attachment | Removes only the selected chip before sending | Browser interaction and webview event path | Functional |
| Send | Sends text, attachments, or both; clears sent attachments | Browser interaction; ACP integration tests | Functional |
| Stop | Cancels the active ACP prompt | Browser message capture and controller wiring | Functional |
| Ask / Auto / Full access | Persists the selected workspace permission mode and changes ACP permission decisions | Controller regression tests and browser message capture | Functional |
| Model | Applies the selected ACP model/session configuration | ACP integration tests and browser message capture | Functional |
| Effort | Applies the selected reasoning-effort session configuration | Browser message capture and shared session-configuration path | Functional |
| Agent mode | Applies the selected ACP session mode | ACP integration test and browser message capture | Functional |
| Context | Opens/closes the usage popover and reports ACP usage when the agent supplies it | Browser interaction including Escape and `aria-expanded` state | Functional; protocol-data dependent |
| Microphone | Starts browser speech recognition when supported; otherwise becomes disabled with an explanatory tooltip | Capability branches inspected; supported state rendered in the test browser | Functional; OS/runtime dependent, live transcription not release-gated |
| New session (`+` in view title) | Starts a fresh Grok ACP session | Command registration and controller path | Wired; live session reset not re-run |
| Connect / Disconnect | Starts or stops the Grok ACP process | Command registration, controller/process paths, and packaged extension activation | Wired; live CLI lifecycle not re-run |
| Settings | Opens Grok Workbench settings | Browser message capture and VS Code command wiring | Wired; native destination not re-opened in release gate |
| Explorer | Reveals/focuses Explorer | Browser message capture and VS Code command wiring | Wired; native destination not re-opened in release gate |
| Layout | Opens the layout/taskbar action path | Browser message capture and command wiring | Wired; native destination not re-opened in release gate |
| Review | Opens the native diff supplied for an edit | Browser message capture and edit-review wiring | Wired; requires an ACP edit with a diff |
| File location | Opens the reported workspace file/location | Browser message capture and workspace-boundary handling | Wired; requires an ACP-reported location |
| Open Folder | Replaces the current empty Grok window with the selected folder | Live relocated single-EXE test: 1 visible window before, 1 after, active workspace evidence present | Functional |

## Verification summary

- Extension typecheck, production build, and 29/29 automated tests passed.
- Responsive visual/browser checks passed at 240×720, 390×720, and 580×975 in dark and light themes with no horizontal overflow.
- The packaged VSIX contains extension 0.6.0 and the attachment action/event paths.
- The portable structural test passed first extraction, cache reuse, missing-file repair, extension registry validation, and profile validation.
- The relocated release runtime launched the branded renderer, activated the Grok extension, opened the requested test workspace, and retained exactly one visible Grok Workbench window.

## Explicit limitations

- `Context` does not invent a quota or token budget when the ACP agent does not publish usage data.
- Voice input depends on speech-recognition support and OS permission in the embedded browser runtime.
- The audit proves the custom Grok controls and portable integration, not every upstream Code - OSS command.

## Follow-up implemented in extension 0.7.0 (post-0.3.4)

Not part of the portable 0.3.4 EXE gate; shipped in `extensions/grok-build-workbench` 0.7.0 source:

- Clear conversation on new/resume session; manual clear + export.
- Offline reasoning-effort dropdown; expanded permission modes (acceptEdits/plan/dontAsk).
- CLI missing probe with install guidance.
- Session browser (local `~/.grok/sessions`), MCP/worktree/plugin managers, login/logout/doctor/memory.
- Image attachments, markdown rendering, sticky plan dock, terminal reverse-RPC host.
- Launch flags for sandbox, tools policy, worktree, memory, rules, max turns.
- Multi-root workspace folders passed as ACP additional directories.
