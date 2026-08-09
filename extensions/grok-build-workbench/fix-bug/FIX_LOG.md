# Fix log

## 1.0.6 — 2026-08-09 — Unified split Fluffy branding

- Replaced the legacy inline Grok glyph with the faceless split white/black Fluffy and inverse “grok” lettering in the chat masthead, product rail, Secondary Sidebar container, and VSIX metadata.
- Webview CSP/local-resource roots now explicitly allow the packaged logo; the visual gate verifies the exact 128px asset loads in all five responsive/theme scenarios.
- The extension logo is generated from the same canonical master as the Windows, macOS, Linux, server, and installer assets.

## 1.0.5 — 2026-08-09 — White Fluffy / black Grok branding

- Replaced the legacy Grok glyph with a white-Fluffy/black-“grok” asset in the packaged extension, chat masthead, product rail, and Secondary Sidebar.
- Added the packaged image CSP/local-resource wiring and responsive render checks that the 1.0.6 split variant continues to use.

## 1.0.4 — 2026-08-09 — Usage parity in IDE chat

- Usage in the composer now combines ACP session context/turn tokens with Grok account plan limits, reset time, product breakdown, refresh, error recovery, and Manage Usage.
- Authentication remains in the extension host; only normalized counters are posted to the webview, and remote account endpoints require HTTPS.
- Responsive rules keep Usage clickable at 240 px by collapsing lower-priority composer controls below 300 px.
- Regression coverage includes service success/signed-out/expired/network/unsafe-URL states and five rendered Usage scenarios.

## 1.0.3 — 2026-08-08 — P1 startup stability

- Fresh installs now start in the **Grok Build IDE** surface; the agent-desktop layout remains an explicit opt-in and an existing saved choice is preserved.
- The webview uses the live layout product for its first rendered frame, so it no longer flashes the desktop identity at IDE startup.
- Removed the invalid extension-level `files.hotExit` default while retaining it in the portable profile.
- Added regression coverage for the IDE-first defaults and warning-prevention contract.

## 0.8.4 — 2026-08-04 — Reverse terminal spawn failed every shell command with ENOENT

- Symptom: chat agent tools that run shell commands failed immediately with `Error: spawn <full command line> ENOENT`, including `echo hello`, `pwd`, and even full paths like `C:\Windows\System32\cmd.exe /c …`.
- Root cause: ACP agents often put the entire shell line in `CreateTerminalRequest.command` with empty `args`. `TerminalHost` used `child_process.spawn(command, args, { shell: false })`, so Node treated the whole line as a single executable path.
- Resolution: when `args` is empty, resolve the spawn through `ComSpec` (`cmd.exe /d /s /c …`) on Windows or `/bin/sh -c` elsewhere; keep explicit `command`+`args` unchanged; surface spawn failures into terminal output and exit status.
- Regression gate: unit tests for resolveTerminalSpawn; production bundle must include the Windows ComSpec wrapper; live chat shell tools must succeed after reload.
- Affected artifact target: Grok Build Workbench 0.8.4 embedded in IDE 0.3.10 (or hot-patched into the 0.3.9 portable cache for immediate recovery).

## 0.7.0 — 2026-08-03 — Advanced Grok workflows were not available from the workbench

- Symptom: the 0.6.0 workbench lacked session browse/resume/export, MCP/worktree/plugin/auth/doctor/memory actions, image attachments, markdown responses, reverse terminal RPC, and advanced Grok launch flags.
- Resolution: add the tools hub and session services, image/markdown/plan presentation, optional terminal host, expanded permission modes, and sandbox/tools/worktree/memory/rules/max-turn configuration.
- Regression gate: TypeScript, 36/36 Vitest tests, production bundle, VSIX content audit, packaged extension activation, and portable runtime checks must pass.
- Affected artifact: `grok-build-workbench-0.7.0.vsix` embedded in Grok Workbench IDE 0.3.5.

## 0.6.0 — 2026-08-02 — Composer plus button only reopened Explorer

- Symptom: the `+` control beside Full access appeared to add prompt context but only executed Open Explorer; when Explorer was already visible, clicking it produced no observable result.
- Root cause: the visual control was wired to a duplicate navigation command and the prompt pipeline accepted text only despite ACP baseline support for resource links.
- Resolution: open a real multi-file picker, show removable attachment chips, send selected workspace files as ACP `resource_link` blocks, preserve workspace scope enforcement, and keep the control visible at the minimum supported sidebar width.
- Functional audit: Ask/Auto/Full, model, effort, mode, Context, Send/Stop, Settings/Layout/Explorer, file links, and Review now have explicit source/runtime evidence; voice input remains capability-dependent and is disabled with an explanatory title when unavailable.
- Affected files: `media/main.js`, `media/styles.css`, `src/acp/grokClient.ts`, `src/acp/types.ts`, `src/vscode/chatViewProvider.ts`, `src/vscode/grokController.ts`, tests, and the visual harness.
- Regression gate: attachment chips must appear after `+`, remain within 240 px without horizontal overflow, be removable, clear on send, and reach the mock ACP agent as resource links; Full access must persist and select an allow permission option.
- Task/session: `grok-open-folder-current-window` / `open-folder-current-window`.

## 0.5.1 — 2026-08-02 — Final responses appeared above later activity

- Symptom: after Grok emitted reasoning, plan, tool, or edit activity, the final response was appended to an earlier assistant card near the top of the task, forcing the reader to scroll upward to find the completion summary.
- Root cause: the webview reused the last assistant DOM node solely by ACP message ID, even when newer activity cards had already been appended after that node.
- Resolution: split assistant and reasoning output into a new chronological segment whenever their prior segment is no longer the conversation tail; keep automatic scrolling only when the reader is already near the bottom.
- Affected files: `media/main.js`, `media/timeline.js`, `src/vscode/chatViewProvider.ts`, `test/webviewTimeline.test.ts`, and `test/visual/harness.html`.
- Regression gate: same-ID final deltas after intervening activity must create a new tail card; 240/390/580 px dark/light layouts must have no horizontal overflow and must end on the final response.
- Verification: TypeScript passed before tests; 26/26 Vitest tests and the production bundle passed; browser runtime inspection confirmed the final response at child index 6 after plan/tool/edit cards, with responsive renders at 240×720, 390×720, and 580×975.
- Task/session: `grok-chat-context-order` / `chat-context-order`.

## 0.5.0 — 2026-08-02 — Full access cleared the CLI model catalog and narrow controls overflowed

- Symptom: switching to Full access disabled or hid the model selector; at very narrow secondary-sidebar widths the composer wrapped, clipped controls, and created horizontal scrolling.
- Root cause: every context refresh applied ACP fallback state whenever the session had no selectable ACP config, even after the independent Grok CLI model catalog had populated the model control. The responsive rule also forced the entire context group onto a second row below 480 px.
- Resolution: preserve model and effort state independently, restore the CLI catalog after permission context refreshes, keep composer actions on one row, and expose permission/model/effort/mode as accessible icon-backed native selects below 360 px.
- Regression gate: after Ask → Full access the model remains enabled with the same values; at the effective 240×720 minimum viewport the document has zero horizontal overflow and one composer action row.
- Verification: TypeScript, 22/22 Vitest tests, production bundle, and browser runtime checks passed; `grok-4.5` and `grok-code-fast` remained available after Full access.

## 0.4.0 — 2026-08-02 — Wide composer controls and usage popover were visibly misaligned

- Symptom: at the user's approximately 580 px secondary sidebar, the composer was taller than the Codex-style reference, native selectors consumed excessive horizontal space, Send wrapped below Stop during a running turn, and the Context popover was positioned from the whole footer instead of its trigger.
- Root cause: the control group used a shrinkable 100% flex basis, the footer-level absolute popover had no button anchor, and running state disabled Send without hiding it.
- Resolution: compact the textarea/card spacing, use a deliberate one-row/wrapped responsive control layout, nest the usage popover in a positioned anchor, and swap Send for Stop while a turn is running.
- Regression gate: wide, medium, and minimum-width layouts must preserve a visible bottom composer, correct trigger anchoring, and zero horizontal overflow.
- Verification: rendered 580×975 and 390×720 dark workspace-required states plus 240×720 minimum width; the 240 px page and viewport widths matched, the composer right edge remained inside the viewport, and the running 580 px state kept Stop on the same row with Send hidden.

## 0.4.0 — 2026-08-02 — Permissions and edits were not visible in the Grok chat/editor

- Symptom: approval used a detached Quick Pick, there was no Full access mode, ACP model/usage controls were absent, and Grok file work remained hidden behind the Welcome editor.
- Resolution: move ACP permission requests into chat, add tested Ask/Grok Auto/Full policies, consume session config/mode/usage events, add context/mic controls, preserve ACP locations/diffs, and open native files/diffs while the agent works.
- Safety: Full access auto-selects ACP allow options but does not bypass workspace filesystem scope, Grok deny rules, hooks, or sandboxing; context-window usage is not labeled account quota.
- Regression gate: TypeScript, 20/20 tests, production bundle, 240/390/600 px dark/light visual QA, permission/model/usage interactions, and VSIX content inspection.
- Affected files: `src/acp/*`, `src/vscode/*`, `media/*`, `package.json`, `README.md`, `test/*`.

## 0.2.0 — 2026-08-02 — Narrow sidebar clipped the new metadata and composer

- Symptom: at the browser backend's effective 240×720 viewport, the new context/composer grid expanded to 254 px and clipped the card's right rounded edge.
- Root cause: the implicit CSS grid column retained its content-based minimum width when long metadata was present.
- Resolution: define the app column as `minmax(0, 1fr)`, set the app width/min-width explicitly, and allow every direct grid child to shrink.
- Affected file: `media/styles.css`.
- Regression gate: at 240 px with an extremely long workspace, model and effort label, body/app scroll width must equal 240 px; context/card right edges must remain inside the viewport.
- Verification: final geometry measured body/app at 240 px, context right edge at 228 px, composer card right edge at 228 px, with no horizontal overflow.
- Evidence: `test/visual/evidence/dark-metadata-long-220x720-v0.2.0.png` (failure) and `test/visual/evidence/dark-metadata-long-240x720-v0.2.0.png` (fixed).
- Task/session: `grok-build-vscode-ide` / `019fbe11-ff38-7a71-aea5-a9c3e0f76928`.

## 0.2.0 — 2026-08-02 — Grok view lacked IDE context and native navigation controls

- Symptom: the working ACP view exposed only a minimal prompt and response area; workspace/model/session/runtime context, Explorer navigation, view movement controls, integrated composer styling and branded title icon were absent.
- Resolution: add context/runtime/session events, optional model/reasoning settings, native Explorer/layout command routing, a Codex-style integrated composer card, responsive metadata chips, and the supplied `logo/grok.svg` in the Activity Bar and header.
- Affected files: `package.json`, `src/acp/*`, `src/vscode/*`, `media/*`, `logo/grok.svg`, `test/visual/harness.html`.
- Regression gate: TypeScript, mock ACP/controller/argument tests, production bundle, dark/light responsive renders, long-label bounds, and Files/Layout/Enter/Shift+Enter interactions must pass before packaging.
- Verification: `pnpm run check` passed with 9/9 tests; production dependency audit found no known vulnerabilities; visual and interaction evidence is recorded in `docs/CLAIM_EVIDENCE_0.2.0.md`.
- Task/session: `grok-build-vscode-ide` / `019fbe11-ff38-7a71-aea5-a9c3e0f76928`.

## 0.1.1 — 2026-08-01 — VSIX included prior release metadata

- Symptom: the first pre-archive 0.1.1 package contained `releases/0.1.0/RELEASE_NOTES.md`, `SHA256SUMS.txt`, and `release.json`.
- Root cause: `.vscodeignore` excluded root `*.vsix` files but did not exclude the release archive directory.
- Resolution: exclude `releases/**` from extension packaging before archiving 0.1.1.
- Affected file: `.vscodeignore`.
- Regression gate: final VSIX content must contain only the manifest/content types plus extension license, notices, package/readme/upstream metadata, `dist/`, and `media/`; no `releases/` entry.
- Task/session: `grok-build-vscode-ide` / `019fbe11-ff38-7a71-aea5-a9c3e0f76928`.

## 0.1.1 — 2026-08-01 — No-workspace retries duplicated error cards

- Symptom: in the real VS Code 0.1.0 sidebar at 1920×1032 dark theme, four identical “Open a folder or workspace” error cards accumulated while the composer remained enabled.
- Root cause: every no-workspace `connect()` attempt broadcast a conversation error, and the webview appended every error without a stable setup state or retry deduplication.
- Resolution: represent the condition as `workspace_required`, suppress identical state broadcasts, disable the composer, and route both setup and connection controls to VS Code’s Open Folder command.
- Affected files: `src/acp/types.ts`, `src/vscode/grokController.ts`, `src/vscode/chatViewProvider.ts`, `media/main.js`, `media/styles.css`, `test/visual/harness.html`.
- Regression gate: four consecutive no-workspace connect attempts must emit one controller state; the visual fixture must contain one setup surface, zero error cards, a disabled composer, and one visible Open Folder setup button.
- Verification: TypeScript passed; Vitest passed 7/7 including the four-attempt controller regression. At 260×720 dark and 390×720 light, the fixture had one setup surface, zero error cards, disabled prompt/send, no body overflow or clipped button labels, and the visible Open Folder button posted exactly one `openFolder` message. Connected 600×900 and long-running 240×640 surrounding states retained a bottom-aligned composer and internal conversation scrolling.
- Fixed-build evidence: `test/visual/evidence/dark-workspace-required-260x720-v0.1.1.png`, `test/visual/evidence/dark-workspace-required-detail-260x400-v0.1.1.png`, `test/visual/evidence/light-workspace-required-390x720-v0.1.1.png`, `test/visual/evidence/light-workspace-required-detail-390x430-v0.1.1.png`, `test/visual/evidence/dark-typical-600x900-v0.1.1.png`, `test/visual/evidence/dark-long-240x640-v0.1.1.png`.
- Baseline evidence: `%TEMP%\codex-clipboard-<id>.png`, installed build 0.1.0, 1920×1032, dark theme, no folder open.
- Task/session: `grok-build-vscode-ide` / `019fbe11-ff38-7a71-aea5-a9c3e0f76928`.

## 0.1.0 — 2026-08-01 — Sidebar composer left the viewport with long output

- Symptom: at a 260×720 visual harness viewport, long conversation content increased the full page height to 1122 px and placed the composer at y=1012 px.
- Root cause: `.app` used `min-height: 100vh`; the CSS grid expanded to fit content instead of constraining the messages row.
- Resolution: constrain `.app` to `height: 100vh` with `overflow: hidden`, keep `.messages` at `min-height: 0` with internal vertical scrolling, and suppress the empty textarea scrollbar until content exceeds 160 px.
- Affected files: `media/styles.css`, `media/main.js`.
- Verification: dark long-content harness at effective 240×640 and 260×720; light empty/error at 390×720; dark typical/completed at 600×900; body height equals viewport, composer remains visible, message region scrolls, and no button label clips.
- Evidence: `test/visual/evidence/dark-long-260x720.png` (failure), `test/visual/evidence/dark-long-260x720-final.png`, `test/visual/evidence/dark-long-220x640.png`, `test/visual/evidence/light-error-390x720-final.png`, `test/visual/evidence/dark-typical-600x900-final.png`.
- Task/session: `grok-build-vscode-ide` / `019fbe11-ff38-7a71-aea5-a9c3e0f76928`.

## Release 0.1.0

- Local VSIX candidate; not published.

## Release 0.1.1

- Local VSIX candidate; not published.
- SHA-256: `6EA8019940192FCDB872D1E950E4C9F7A571CA51D03FCCB5987FD60B24D73409`.
- Archived at `releases/0.1.1/` after VSIX content inspection and isolated installation.

## Release 0.2.0

- Local VSIX candidate; not published.
- SHA-256: `39F263F69D1B73E65FCA6BBD3A352D9B3D299E6AA4BB4B789FE128CACD123080`.
- Archived at `releases/0.2.0/` after full checks, responsive visual QA, VSIX content inspection, and isolated VS Code installation.
# 0.8.0 — 2026-08-03 — Composer, permission menu, Markdown, and CLI management gaps

- Symptom: the composer could appear above unused webview space; the Windows permission dropdown ignored the dark theme; assistant output exposed Markdown markers; duplicated voice denial notes reduced readability.
- Root cause: viewport sizing relied only on `100vh`, permission mode used a native select, the lightweight renderer and visual harness were incomplete, and speech errors were appended without deduplication.
- Fix: pin the app to the webview viewport, isolate conversation scrolling, add a theme-aware accessible permission listbox, expand the safe Markdown renderer, delegate links to VS Code, and disable/dedupe denied voice input.
- Additional functional fixes: auto-name worktrees now send bare `--worktree`; `--sandbox off` is preserved; MCP add supports stdio/HTTP/SSE with correct `--` separation; plugin install and memory clear use explicit confirmation plus non-interactive flags; removed an unused session helper.
- Verification: extension typecheck, 39/39 tests, production bundle, and responsive Playwright geometry/interaction/contrast checks.
- Affected artifact: `grok-build-workbench-0.8.0.vsix` embedded in Grok Workbench IDE 0.3.6.
