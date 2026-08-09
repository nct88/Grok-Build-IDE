# Grok Workbench IDE 0.3.6 feature audit

Date: 2026-08-03  
Extension: Grok Build Workbench 0.8.0  
Compared CLI: locally installed `grok 0.2.118 (1e1687c1cf) [stable]`

> Erratum (2026-08-03): the composer row and packaged-runtime statement in this historical audit were false positives. The 0.3.6 assertion measured the bottom of an oversized shell rather than the visible input card. Other audit results remain scoped to their stated evidence.

Scope: the custom Grok Build surface, its webview-to-extension wiring, ACP client integration, and direct CLI management commands. Upstream Code - OSS editor features are outside this audit.

## Outcome

All 18 contributed extension commands have matching registrations. Every persistent control rendered by the Grok webview has an event handler, and the responsive harness exercises the primary composer controls and navigation buttons. The audit found and corrected six functional gaps:

1. The visual harness stopped before fixtures because it omitted `markdown.js` and several DOM controls required by `main.js`.
2. The native Windows permission `<select>` produced an unthemeable light popup in dark mode.
3. An empty “auto-name” worktree selection was stored as disabled, so the promised bare `--worktree` flag was never sent.
4. `sandbox = off` was discarded instead of being passed as `--sandbox off`.
5. MCP stdio arguments were not separated by `--`, and remote HTTP/SSE transport could not be selected.
6. Plugin install and memory clear could wait for CLI confirmation without an interactive stdin; both now use an explicit VS Code confirmation followed by non-interactive CLI flags.

The unused `sessionDirectoryExists` source helper was also removed.

## UI control matrix

| Surface | Wiring and behavior | Result |
|---|---|---|
| Composer | Shell reached the viewport bottom, but the visible card remained too high because hidden Grid content shifted row placement | **Failed in packaged 0.3.6; superseded by 0.3.7** |
| Send / Stop | Sends text plus attachments; cancels the active ACP turn | Functional |
| Add files | Native multi-file/image picker, removable chips, workspace scope checks | Functional |
| Permission | Custom theme-aware listbox with mouse, arrows, Home/End, Escape, ARIA selection, and persisted workspace mode | Functional; dark/light contrast gate passed |
| Model / effort / agent mode | ACP session configuration, CLI model reconnect, or offline effort reconnect as applicable | Functional; protocol-data dependent |
| Context usage | Opens a popover and displays ACP context/token/cost data | Functional; subscription quota is not exposed by ACP |
| Microphone | Uses Web Speech when present; disables after denied permission and deduplicates repeated errors | Functional; runtime/OS dependent |
| Workspace / Settings / Tools / Sessions / Layout | Posts to matching extension handlers and native VS Code commands | Functional |
| Markdown links | Only HTTP(S) links are emitted; opening is delegated to `vscode.env.openExternal` | Functional |
| Tool locations / Review | Opens workspace locations and native diffs supplied by ACP | Functional; event-data dependent |
| Permission cards | Keyboard shortcuts and explicit allow/reject options resolve the pending ACP request | Functional |
| New Session / Connect / Disconnect | Registered in the view title and command palette | Functional |

## Content rendering

Assistant content is no longer presented as a dense generic card or raw Markdown. The safe renderer escapes agent HTML and supports headings, bold/italic/strike, paragraphs, ordered/unordered/task lists, blockquotes, fenced code with language labels, inline code, horizontal rules, tables, and HTTP(S) links. User prompts retain a subtle bubble; assistant prose uses a flat Codex-like reading surface.

## Grok CLI parity

The project is fully configured for the ACP coding workflow, but it intentionally does **not** duplicate every TUI/administrative CLI command in the GUI.

| CLI area | Workbench coverage | Status |
|---|---|---|
| `agent stdio` / ACP | Initialize, auth retry, new/load session, prompts, streaming, cancellation, permissions, filesystem, terminal, plan, config/modes, usage | Full for advertised ACP capabilities |
| Launch options | model, effort, permission mode, always approve, sandbox including `off`, tools allow/deny, named/auto worktree + ref, memory, web-search disable, rules, max turns | Full for dedicated settings |
| Additional root flags | `extraArguments` is inserted before `agent stdio` for agent profiles, leader/debug and newer compatible flags | Available, not guided by individual UI settings |
| Sessions | Local browse, resume, export, delete | Core coverage; CLI keyword search is not exposed |
| MCP | list, add stdio/HTTP/SSE, enable, disable, remove | Core coverage; `mcp doctor` remains CLI-only |
| Worktrees | start named/auto, list, remove | Core coverage; show/gc/db remain CLI-only |
| Plugins | list, trusted install after confirmation, update, enable, disable, uninstall | Core coverage; details/validate/tag/marketplace remain CLI-only |
| Auth / diagnostics / memory | login, logout, doctor, workspace memory clear | Core coverage; doctor fix and global/all memory scopes remain CLI-only |
| Administrative commands | inspect, setup, trace, update, version, leader, dashboard, wrap, completions | CLI-only by design |
| Headless/TUI modes | single prompt, JSON/streaming output, JSON schema, minimal/fullscreen | Not applicable to the ACP webview |

## Evidence

- Static command audit: 18 contributed commands / 18 registrations.
- Extension TypeScript typecheck passed before tests.
- 39 Vitest tests cover ACP, permission policy, launch flags, session parsing, timeline behavior, and Markdown safety/rendering.
- Playwright harness verifies viewport geometry, no horizontal overflow, Markdown structure, permission menu bounds/contrast, selection persistence, navigation messages, session config/mode controls, usage popover, attachments, and external links.
- Visual evidence is stored under `extensions/grok-build-workbench/test/visual/evidence/0.8.0`.
- The exact archived portable runtime was launched through CDP. Reinspection showed the visible composer card about 268 px above the bottom even though its shell reached the bottom; this evidence invalidates the original docking claim.

## Remaining acceptance limits

- A real authenticated account is still required to validate live service responses, quota behavior, and speech-recognition permission on the target Windows installation.
- Direct GUI parity with every administrative CLI subcommand is not a release requirement; users can run those commands in the integrated terminal or use `extraArguments` for compatible agent launch flags.
