# AI IDE structure comparison (for Grok Build IDE)

Research snapshot for product decisions. Peers are **Cursor**, **Windsurf (Cascade)**, **VS Code + Copilot/Claude Code**, and pure CLI agents.

## Common product shapes

| Product | Base | AI surface | Agent runtime | Context |
|---|---|---|---|---|
| **Cursor** | VS Code fork | Built-in Chat + Composer (agent) | Proprietary cloud + local index | Repo embeddings, open tabs, @-files, images |
| **Windsurf** | VS Code fork | Cascade panel (flow agent) | Proprietary agent runtime | Auto context fill, multi-step autonomy |
| **VS Code + Copilot** | Upstream VS Code | Extension chat / agent | Cloud + extension host | Workspace index, tools API |
| **Claude Code / Cline / etc.** | Extension only | Side panel / webview | CLI or extension host process | File picker, MCP, terminal |
| **Grok Build IDE (this project)** | Code - OSS fork + extension | Secondary sidebar webview | Official `grok agent stdio` via **ACP** | Workspace host reverse-RPC, MCP, worktrees |

## What works well in peer IDEs

1. **Chat is not a markdown document**  
   Cursor / Windsurf treat the session as a **timeline of typed blocks**: user bubble, assistant prose, tool cards, diffs, terminal output. Markdown is only one renderer for prose, not the whole layout.

2. **Composer stays docked**  
   Input, model, permission mode, attachments stay fixed; only the stream scrolls. Grok 0.8.x already matches this.

3. **Clipboard / paste is first-class**  
   Paste screenshot → attach image. Drop file → attach. No “save to disk then pick file” friction.

4. **Thin shell, fat agent process**  
   Cursor/Windsurf keep heavy agent logic outside the UI process. Grok’s child-process ACP boundary is the correct equivalent (crash isolation, CLI updates, auth).

5. **Native editor for edits**  
   Diffs open in the real editor, not only inside the chat. Grok already does `vscode.diff` + follow-along files.

6. **Product identity, not “VS Code + extension” branding**  
   Forks rebrand product.json, icons, data folder, and default layout so AI is primary. Grok Workbench product.json already does this.

## Gaps to close in Grok Build IDE

| Gap | Peer pattern | Grok action |
|---|---|---|
| Session reads as free-form MD | Structured turn blocks | Redesign stream: user bubble / assistant stack / tool chips / plan dock |
| No clipboard image paste | Paste → attach | Webview `paste` + base64 image ACP content |
| Drop only opens file picker | Drop binary → attach | Read `DataTransfer.files` for images in webview |
| Workspace selfhost ext. errors | Product workspaces hide core-dev extensions | Stub/compile `.vscode/extensions/*/out` or drop selfhost recommendations |
| Full CLI admin surface in GUI | Peers keep admin in CLI | Keep QuickPick for sessions/MCP/worktree; leave inspect/trace in terminal |

## Recommended architecture (keep)

```text
Grok Build IDE (Code - OSS product shell)
├─ product.json identity + layout defaults
├─ Built-in extension: grok-build-workbench
│  ├─ Webview session (structured UI, composer, paste/drop)
│  ├─ GrokController (state, permissions, editor follow)
│  ├─ WorkspaceHost (fs + permission bridge)
│  └─ GrokClient → spawn: grok … agent stdio (ACP SDK)
└─ Optional: packaged grok CLI bootstrap
```

Do **not** embed the Rust agent inside Electron. Keep ACP + child process.

## Extension packaging note (VS Code forks)

| Kind | `package.json` main | Build output |
|---|---|---|
| Built-in Code - OSS extensions | `./out/extension` or `./out/extension.js` | gulp `compile-extension:*` → `extensions/<id>/out/` |
| Marketplace VSIX | `./dist/extension.js` or `./out/extension.js` | esbuild/webpack prepublish |
| Grok workbench | `./dist/extension.cjs` | `esbuild.mjs` |
| Workspace selfhost (`.vscode/extensions`) | `./out/extension.js` | gulp compile **or** stub for non-core-dev product work |

Missing `out/extension.js` → activation error: `Cannot activate because ./out/extension.js not found`.

## Product principles for this repo

1. Session UI = **typed blocks**, not a Markdown document viewer.  
2. Paste/drop images without saving to disk.  
3. IDE-native surfaces for files, diffs, terminals, settings.  
4. CLI parity for agent workflow; CLI-only for rare admin.  
5. Product workspace must not load broken VS Code selfhost extensions.
