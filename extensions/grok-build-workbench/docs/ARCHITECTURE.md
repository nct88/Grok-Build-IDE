# Kiến trúc 0.4

```text
VS Code desktop
├─ Grok Build Activity Bar / Webview View
│  ├─ workspace/session/runtime + ACP usage context
│  ├─ conversation + inline permission cards
│  ├─ model/reasoning/mode/permission composer controls
│  └─ native Explorer/layout/settings command routing
├─ GrokController
│  ├─ command + state lifecycle
│  ├─ permission policy + pending approval lifecycle
│  └─ editor follow + native diff review
├─ WorkspaceHost
│  ├─ permission bridge into the conversation
│  ├─ workspace-scoped read/write
│  ├─ before/after write capture
│  └─ auth method selection
└─ GrokClient
   ├─ child process: grok [global args] agent stdio
   ├─ official @agentclientprotocol/sdk
   ├─ NDJSON-RPC over stdin/stdout
   └─ normalized session events
```

## Quyết định chính

- Child process thay vì Rust FFI: giữ ranh giới crash/update/auth rõ ràng và bám đúng integration point upstream.
- ACP SDK chính thức thay vì JSON-RPC tự viết: có framing/type/schema chuẩn và reverse request handling.
- Webview View chứa conversation, permission và session controls; commands, filesystem, editor và diff tiếp tục dùng native VS Code API.
- Controller phát lại state/context/runtime/session gần nhất khi webview được tạo lại, tránh mất metadata do view chuyển giữa các sidebar.
- `grokBuild.openExplorer` gọi `workbench.view.explorer`; `grokBuild.layout` mở Quick Pick rồi gọi các command bố cục gốc của VS Code.
- Model và reasoning effort cấu hình ban đầu được chuyển thành CLI flags; sau kết nối, ACP session config cho phép đổi lựa chọn được agent quảng bá mà không khởi động lại.
- `usage_update` được biểu diễn đúng là context-window usage, không suy diễn thành quota thuê bao.
- ACP tool `locations` điều khiển follow-along; diff content và reverse write tạo snapshot trước/sau cho lệnh `vscode.diff`.
- Agent output dùng renderer Markdown an toàn: HTML từ agent luôn được escape trước khi các cấu trúc Markdown hỗ trợ được tạo trong DOM.
- Reverse terminal ACP được quảng bá khi `grokBuild.enableTerminal` bật; host quản lý process, output, wait, kill và release.
- Không lưu transcript hoặc credential trong workspace/project memory.

## Lifecycle

```text
disconnected → workspace_required → Open Folder → window reload
disconnected → starting → initialize → session/new → connected
connected → prompt → running → stop reason → connected
running → session/cancel → cancelled → connected
connected → new session → connected
any → disconnect/exit → disconnected or error
```

## Đã bổ sung trong 0.7.0

1. Session list/resume/delete/export từ `~/.grok/sessions` + ACP `session/load` / `--resume`.
2. MCP / worktree / plugin / login / doctor / memory UI (QuickPick + CLI).
3. Image attachments (ACP `image`), markdown assistant, sticky plan dock.
4. Terminal reverse-RPC host (Node child process) khi `enableTerminal`.
5. Sandbox, tools allow/deny, rules, max turns, experimental memory launch flags.
6. Clear conversation on new/resume; offline effort dropdown; expanded permission modes.

## Nâng cấp tiếp theo

1. Mở rộng smoke tests với released `grok.exe` cho auth retry, permission và file edit/diff.
2. Account quota chỉ khi xAI công bố API chính thức cho ACP/client.
3. Terminal content cards trong conversation (hiện chỉ reverse-RPC backend).
4. Drag/drop path thật trong webview (hiện fallback file picker).
5. Code - OSS pure source build, signing, auto-update product shell.
## UI and CLI integration changes in 0.8.0

- The webview is viewport-locked; only the conversation region scrolls and the composer remains docked.
- Permission mode uses an accessible custom listbox so Windows native popup colors cannot escape the VS Code theme.
- Assistant content is rendered by a safe Markdown subset that escapes agent HTML and delegates HTTP(S) links to VS Code.
- Worktree auto naming, sandbox controls, MCP transports, session metadata, and non-interactive plugin/memory confirmations are reviewed against Grok CLI 1.0.3; an authenticated ACP v1 smoke is required before publication.
- `test/visual/verify-webview.mjs` is the responsive geometry, interaction, and contrast gate.
