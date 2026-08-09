# Quality contract — milestone 0.2.0

## Observable outcomes

- Mở view trong workspace có thể khởi chạy executable cấu hình bằng `agent stdio`.
- ACP initialize và session creation hoàn tất trước khi gửi prompt.
- User prompt chỉ gửi một lần; assistant chunks ghép đúng thứ tự.
- Permission không tự động approve; cancel permission trả outcome cancelled.
- Cancel turn không giết session.
- Disconnect đóng stdin và dọn child process.
- Missing executable, no workspace và protocol/process error xuất hiện thành trạng thái có thể hành động.
- No-workspace chỉ xuất hiện một setup state dù Connect được gọi lặp; composer bị khóa và Open Folder là hành động phục hồi duy nhất.
- Tiêu đề, rail và Activity Bar dùng cùng asset `logo/grok-fluffy.png`: Fluffy chia trắng trái/đen phải, chữ “grok” đảo tương phản, không có mắt/miệng và có alpha trong suốt.
- Composer là một card thống nhất: textarea nhiều dòng và toolbar bên trong, không tách Send khỏi trường nhập.
- Workspace, model, reasoning effort, session và ACP agent/version có thông tin ngắn gọn, không làm tràn sidebar.
- Files mở native Explorer; Layout cung cấp Move View, đổi vị trí Primary Sidebar và bật/tắt Secondary Sidebar bằng command native của VS Code.

## Invariants

- Không sửa Grok Build upstream.
- Không render agent-provided HTML.
- Không ghi credential/transcript vào project memory.
- Reverse file access mặc định chỉ trong workspace.
- Sidebar vẫn đọc được ở light/dark theme và chiều rộng 220–600 px.
- Composer, message scroll và permission/session lifecycle hiện tại không hồi quy.
- Không giả lập attachment hoặc model picker nếu backend/config chưa hỗ trợ hành vi tương ứng.

## Required states

- empty/disconnected, workspace-required, starting, connected, running, cancelled, error;
- typical và long prompt/output;
- tool pending/completed và plan;
- no workspace, missing Grok executable, child exit.
- workspace/model/session labels ngắn, dài và chưa có giá trị;
- Files/Layout click, composer focus/send/stop và metadata truncation.

## Baseline 0.1.1 cho yêu cầu 0.2.0

- Runtime screenshot: `%TEMP%\codex-clipboard-<id>.png`.
- Build đang chạy: 0.1.1 theo chuỗi bàn giao trước; ảnh 1920×1032, dark theme, Grok view ở Secondary Sidebar bên phải, workspace `grok-app`, real connected conversation.
- Quan sát: composer Grok dùng input một dòng và action/hint tách bên dưới; không có workspace/model/session/runtime metadata; không có Files/Layout control trong webview; tiêu đề chỉ có text.
- Ảnh không chứng minh hover/focus, light theme, sidebar nhỏ, lệnh Move View hay native Explorer interaction.

## Current evidence

- `pnpm run typecheck`.
- `pnpm run test`: 7 tests covering mock initialize/session/prompt/stream/permission/cancel plus repeated no-workspace connect deduplication.
- `pnpm run build`: production CJS bundle.
- Real Grok `0.2.118` authenticated ACP v1 smoke: session created and prompt returned `ACP_OK` with `end_turn`.
- Installed VSIX 0.1.0 runtime baseline: real VS Code dark screenshot at 1920×1032 exposed four duplicated no-workspace errors and an enabled composer.
- Fixed 0.1.1 harness: one setup surface and zero error cards after four repeated workspace-required events; prompt/send disabled; Open Folder interaction posted once.
- Visual harness: dark long-content at effective 240×640 and 260×720, light error/empty and keyboard interaction at 390×720, dark completed at 600×900.
- Geometry: body/app height matched viewport; composer remained inside the viewport; long messages produced internal conversation scroll; button clipping set was empty.
- Interaction: Enter submitted once, prompt retained focus, running state showed Stop and disabled Send.

The fixed 0.1.1 no-workspace pixels are harness evidence. A final screenshot from the installed 0.1.1 VS Code Extension Host remains required before calling this visual correction fully verified in production UI.
