# Grok Build IDE — feature, UI, and packaging plan

Project root for this work: `H:\projects\grok-build-ide`  
Source origin: `H:\projects\grok-code` (Code - OSS fork + `extensions/grok-build-workbench`)

## 1. Grok CLI features usable in the IDE

| CLI capability | IDE surface | Status / action |
|---|---|---|
| `grok agent stdio` (ACP) | GrokClient child process | Keep — primary integration |
| Model / reasoning effort | Composer selects + settings | Keep; reconnect when offline |
| Permission modes | Custom listbox | Keep; Full access still respects FS scope |
| Sessions list/resume/export/delete | QuickPick + `~/.grok/sessions` | Keep |
| MCP add/list/enable/disable | Tools hub QuickPick | Keep |
| Worktrees | Tools hub + launch flags | Keep |
| Plugins | Tools hub | Keep |
| Login / logout / doctor / memory | Commands + hub | Keep |
| Image in prompt (ACP `image`) | Attachments + **clipboard paste** | **Implemented** |
| Resource links (files) | File picker + drop `attachUris` | **Implemented** |
| Terminal reverse-RPC | Setting + Node host | Keep backend; UI cards optional later |
| Admin (`inspect`, `trace`, `update`…) | Integrated terminal only | By design |
| Web search disable / tools allow-deny / rules / max turns / sandbox | Settings | Keep |

**IDE-native optimizations (do more of):**
- Open agent file locations in editor (`followAgentFiles`)
- Native `vscode.diff` for edits
- Secondary sidebar as default agent home
- product.json layout defaults (disable competing AI chat when shipping)

## 2. UI session redesign

**Problem:** Stream felt like a Markdown document dump.

**Direction (aligned with Cursor / Windsurf):** typed timeline blocks, not a free-form MD viewer.

**Implemented in media (extension 0.8.11):**

| Element | Behavior |
|---|---|
| Message header | Avatar (G / Y / !) + role label |
| User bubble | Bordered card; optional `@file` context chip row |
| Assistant body | `setStructuredContent` (prose / code cards / lists) |
| Tool cards | Status-colored left border + pill status |
| Thinking | `<details>` summary **"Thinking"** (not "Reasoning activity") |
| Activity notes | Centered pills |
| Plan dock | Sticky above stream |
| Composer | Docked; only stream scrolls; `@` or `+` adds context |
| Usage popover | **Session context** vs **Account** (account N/A via ACP) |

**Files:**
- `extensions/grok-build-workbench/media/main.js`
- `extensions/grok-build-workbench/media/styles.css` (base + session stream redesign)
- `extensions/grok-build-workbench/media/markdown.js` (`setStructuredContent`)

Composer hint: `Enter send · Shift+Enter newline · @ or + add context · Paste image · Drop images`

## 3. Clipboard paste & drop status

| Input | Before | After |
|---|---|---|
| Paste image (screenshot) | Not supported | Webview `paste` → `readFileAsBase64` → attach as `clipboard://…` |
| Drop image file | Opened file picker only | Read `DataTransfer.files` → base64 attach |
| Drop workspace path | File picker fallback | `attachUris` message for `file://` / absolute paths |
| Pick files via + button | Worked | Unchanged (`addContext` → file dialog → same attach path) |

**Host path:** `chatViewProvider.ts`
- Webview message type `"attachUris"` with optional `uris?: string[]`
- `attachUris` / `attachResolvedUris` mirror `addContextFiles` (workspace scope + image base64)

Controller already skips workspace path checks when `mimeType` + `data` are present (clipboard images).

## 4. Extension `out/extension.js` fix

**Cause:** Yellow triangles on **VS Code Extras / PR Pinger / Selfhost Import Aid / Selfhost Test Provider** under `.vscode/extensions/`. These are Code - OSS **selfhost** helpers with `"main": "./out/extension.js"` but no compiled `out/` until gulp runs.

**Not** a bug in Grok workbench (`main` is `./dist/extension.cjs` via esbuild).

**Fix applied:**
1. No-op stubs at `.vscode/extensions/*/out/extension.js` (activate/deactivate empty)
2. `scripts/compile-workspace-extensions.ps1` to regenerate stubs
3. Product-focused `.vscode/extensions.json` recommendations
4. Same stubs under `grok-code` so the open workspace stops failing immediately

**Peer IDE pattern:** Product workspaces do not load core-editor selfhost extensions; only product + marketplace extensions ship.

## 5. Other AI IDE structure takeaways

See [AI_IDE_STRUCTURE_COMPARISON.md](./AI_IDE_STRUCTURE_COMPARISON.md).

| Pattern | Cursor / Windsurf | Grok Build IDE |
|---|---|---|
| Base | VS Code fork | Code - OSS fork |
| Agent process | Proprietary cloud/local | Official `grok` CLI via ACP |
| Chat UI | Structured timeline | Webview structured blocks (this pass) |
| Edits | In-editor | Native diff + follow files |
| Context | Index + @-mentions | Workspace host + picker + paste/drop |
| Identity | Full product rebrand | product.json + data folder + layout |

**Keep:** thin Electron shell, fat CLI agent, ACP protocol.  
**Improve:** session presentation (done), paste/drop (done), product workspace hygiene (stubs).

## 6. Source copy status

- Extension TypeScript + product identity files: present under `grok-build-ide`
- Media base (`styles.css`, `main.js`) copied from `grok-code` and patched for session redesign + paste/drop
- Full Code - OSS `src/` tree: run `scripts/bootstrap-copy-from-grok-code.ps1` when shell is available
- After full copy: `npm install`, build extensions, package workbench

## 7. Suggested next steps

1. Finish full tree sync via bootstrap script  
2. `pnpm/npm run build` in `extensions/grok-build-workbench`  
3. Visual harness / manual paste-screenshot + drop-file smoke test  
4. Optional: terminal output cards in stream; richer code-card headers from markdown parser  
