# Grok Build Workbench (Unofficial)

Một VS Code extension desktop tích hợp **Grok Build** qua Agent Client Protocol (ACP). Dự án giữ nguyên trải nghiệm editor, Explorer, terminal và diff của VS Code; Grok Build chạy như tiến trình riêng bằng lệnh `grok agent stdio`.

> Đây là tích hợp cộng đồng, không phải sản phẩm chính thức của xAI/SpaceXAI. Tên và biểu tượng Grok chỉ dùng để mô tả khả năng tương thích; mọi quyền thương hiệu liên quan thuộc chủ sở hữu tương ứng. Dự án không phân phối binary của Grok Build.

## Trạng thái hiện tại (0.8.3)

- Kết nối ACP v1 với Grok Build qua stdio; probe CLI missing với hướng dẫn cài đặt.
- Session: new / resume / browse / delete / export Markdown; New Session xóa timeline chat.
- Prompt streaming, plan sticky, tool cards, permission inline (Ask / Accept edits / Auto / Plan / Don't ask / Full).
- Đính kèm file + image (base64 ACP), multi-root `additionalDirectories`, reverse FS + native diff.
- Terminal reverse-RPC (Node child process) khi `grokBuild.enableTerminal` bật.
- Tools hub: MCP, worktree, plugins, login/logout, doctor, memory clear, CLI config.
- Composer: model catalog, effort offline (low/medium/high/xhigh), mode ACP, usage, mic, markdown assistant.
- Launch flags: sandbox, tools allow/deny, worktree, experimental memory, rules, max turns, disable web search.
- Visible-card bottom docking, theme-aware permission listbox, safe rich Markdown (headings, emphasis, lists, quotes, code, tables, links), and a Lucide-style SVG icon system that replaces font-dependent control glyphs.
- Read-only access to the verified shared portfolio profile for the current workspace; unrelated external files and all external writes remain blocked by default.
- Mock ACP tests + unit tests; không ship binary Grok.

Còn hạn chế: quota thuê bao không có qua ACP; mic phụ thuộc Web Speech trong webview; resume phụ thuộc `session/load` hoặc `--resume`.

## Yêu cầu

- VS Code desktop 1.100 trở lên.
- Node.js 20.11 trở lên và pnpm để phát triển extension.
- Grok Build đã cài đặt và đăng nhập. Trên Windows, upstream phát hành binary chính thức:

```powershell
irm https://x.ai/cli/install.ps1 | iex
grok --version
grok
```

Nếu executable không nằm trên `PATH`, đặt `grokBuild.executablePath` thành đường dẫn tuyệt đối tới `grok.exe` hoặc binary `xai-grok-pager` tự build.

## Phát triển

```powershell
pnpm install
pnpm run check
```

Mở thư mục này trong VS Code và nhấn `F5` để chạy Extension Development Host. Trong cửa sổ mới, mở Activity Bar **Grok Build**, sau đó mở một project folder và kết nối agent.

Đóng gói VSIX cục bộ:

```powershell
pnpm run package:vsix
```

## Thiết lập

- `grokBuild.executablePath`: đường dẫn binary, mặc định `grok`.
- `grokBuild.extraArguments`: global arguments đặt trước `agent stdio`.
- `grokBuild.autoStart`: tự kết nối khi mở view, mặc định bật.
- `grokBuild.model`: model ID tùy chọn, truyền qua `--model`; để trống để dùng mặc định của CLI.
- `grokBuild.reasoningEffort`: reasoning effort tùy chọn, truyền qua `--reasoning-effort`.
- `grokBuild.showReasoning`: hiện/ẩn khối reasoning do ACP gửi về.
- `grokBuild.permissionMode`: `ask`, `acceptEdits`, `auto`, `plan`, `dontAsk` hoặc `full`.
- `grokBuild.sandbox`: profile truyền nguyên trạng qua `--sandbox`, gồm cả `off`.
- `grokBuild.worktree`: worktree có tên; menu Worktrees cũng hỗ trợ `--worktree` tự đặt tên.
- `grokBuild.allowOutsideWorkspace`: cho reverse filesystem request đi ngoài workspace, mặc định tắt.
- `grokBuild.followAgentFiles`: mở file/dòng ACP đang xử lý trong editor, mặc định bật.
- `grokBuild.openDiffOnEdit`: mở native diff cho thay đổi có before/after, mặc định bật.
- `grokBuild.showToolDetails`: hiện file location và hành động review trong tool card.
- `grokBuild.voiceInput`: bật mic khi runtime hỗ trợ speech recognition.

## Điều hướng giao diện

- Nhấn `+` trong composer để chọn file/image đính kèm; nhấn tên workspace để mở Explorer.
- Nhấn **Layout** (`↔`) để mở menu: di chuyển Grok Build view, đổi Primary Sidebar trái/phải, bật/tắt Secondary Sidebar, mở thiết lập tách nút taskbar hoặc đặt lại vị trí view.
- Bản Grok Workbench IDE portable gán danh tính taskbar riêng cho từng cửa sổ. Khi chỉ cài VSIX vào VS Code thường, việc gộp cửa sổ vẫn do VS Code và thiết lập taskbar của Windows quyết định.
- Có thể kéo trực tiếp tiêu đề view **GROK BUILD: AGENT** sang Primary Sidebar, Secondary Sidebar hoặc Panel bằng cơ chế bố cục chuẩn của VS Code.
- Chọn permission/model/reasoning/mode trực tiếp trong composer. Những danh sách phiên chỉ bật khi Grok Build gửi option qua ACP.
- Nhấn **Settings** để mở toàn bộ thiết lập tích hợp; chạy **Grok Build: Open Grok CLI Config** để mở `~/.grok/config.toml`.

## Ranh giới an toàn

Chặn `vscode.workspace.fs` ngoài workspace không phải sandbox hoàn chỉnh: bản thân tiến trình Grok Build vẫn có quyền hệ điều hành của người dùng và có tool filesystem/shell riêng. Chỉ chạy trong project đáng tin cậy, đọc kỹ permission prompt và dùng sandbox/enterprise policy của Grok Build nếu cần cô lập mạnh hơn.

Tài liệu chi tiết nằm tại `docs/FEASIBILITY.md` và `docs/ARCHITECTURE.md` trong source repository.
