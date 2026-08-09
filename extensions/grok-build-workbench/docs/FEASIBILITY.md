# Đánh giá khả thi — Grok Build IDE trên nền VS Code

Ngày đánh giá: 2026-08-01  
Upstream được kiểm tra: `xai-org/grok-build@a4221165824e5b1f5c4c10b7459f65e78dd6448d`

## Kết luận

Tích hợp Grok Build vào giao diện VS Code **khả thi cao** nếu dùng extension desktop làm ACP client. Upstream công bố rõ `grok agent stdio`, có Rust ACP client/server tests và mô tả editor embedding qua Agent Client Protocol. MVP trong repository này đã chứng minh framing, session lifecycle, streaming update, permission và cancel bằng mock ACP process.

Một binary IDE độc lập dựa trên Code - OSS cũng khả thi, nhưng nên là milestone sau khi extension được dùng ổn định. Fork editor ngay từ đầu làm tăng mạnh chi phí cập nhật upstream, signing, auto-update, extension registry, telemetry/privacy, branding và packaging mà không cải thiện giao thức Grok.

## Ba phương án

| Phương án | Khả thi | Chi phí | Khuyến nghị |
|---|---:|---:|---|
| VS Code desktop extension + Grok ACP process | Cao | Thấp–vừa | MVP hiện tại |
| Code - OSS distribution có extension cài sẵn | Vừa–cao | Cao | Milestone productization |
| Nhúng/fork trực tiếp Rust runtime Grok vào editor | Thấp–vừa | Rất cao | Chỉ làm khi ACP không đáp ứng yêu cầu cụ thể |

## Bằng chứng nguồn

- Grok Build là Rust CLI/TUI, hỗ trợ `grok agent stdio` để chạy như ACP agent và có binary Windows phát hành sẵn: <https://github.com/xai-org/grok-build>.
- CLI reference liệt kê `grok agent stdio`: <https://docs.x.ai/build/cli/reference>.
- Upstream pin Rust crate `agent-client-protocol = 0.10.4` tại commit đã kiểm tra.
- ACP có TypeScript SDK chính thức cho editor/client: <https://agentclientprotocol.com/libraries/typescript>.
- VS Code Extension API hỗ trợ Activity Bar views, webview views, commands và workspace filesystem: <https://code.visualstudio.com/api/>.
- Code - OSS có giấy phép MIT; bản Visual Studio Code phân phối chính thức có phần tùy biến và product license riêng: <https://github.com/microsoft/vscode>.

## License và thương hiệu

First-party Grok Build source dùng Apache-2.0. Nếu sau này phân phối source/binary đã sửa từ upstream, phải giữ license, attribution/NOTICE phù hợp và đánh dấu file đã thay đổi. Apache-2.0 không cấp quyền dùng trade name, trademark hoặc product name ngoài mô tả nguồn gốc thông thường.

MVP này không copy, sửa hay phân phối Grok Build source/binary; nó gọi binary do người dùng cài. Không dùng logo xAI/Grok và ghi rõ “Unofficial”. Nếu tạo Code - OSS distribution, phải dùng brand riêng và rà soát riêng quyền truy cập extension marketplace cùng các Microsoft-only assets/services.

## Rủi ro kỹ thuật

1. **ACP thay đổi nhanh.** Grok Build và TypeScript SDK có version độc lập. Cần pin dependency, giữ mock contract tests và chạy smoke test với binary Grok thật ở mỗi release.
2. **Windows source build không phải đường chính.** README upstream nói macOS/Linux được hỗ trợ làm build host; Windows source build là best-effort. MVP nên dùng Windows binary phát hành hoặc binary build trong CI Linux/macOS phù hợp.
3. **Authentication cần runtime thật.** ACP đã được smoke-test với Grok CLI 0.2.118 đăng nhập qua grok.com, nhưng OAuth/API-key edge cases và re-authentication vẫn cần test riêng.
4. **Permission không đồng nghĩa sandbox.** Grok process có thể có filesystem/shell tools của chính nó; giới hạn reverse RPC của extension không thu hồi quyền OS của child process.
5. **Feature parity.** TUI upstream có sessions, modes, models, MCP, hooks/plugins, dashboard, worktrees và nhiều xAI ACP extensions. MVP chỉ render tập ACP lõi.

## Cổng chuyển sang Code - OSS distribution

Chỉ bắt đầu distribution riêng khi:

- binary Grok thật vượt smoke suite mở rộng trên Windows;
- auth, permission, file edit/diff và process cleanup được kiểm tra end-to-end;
- session/model/mode UX ổn định trong extension;
- có brand riêng và quyết định registry/update/signing;
- có CI build, installer, auto-update, security response và license inventory;
- chi phí đồng bộ Code - OSS được chấp nhận như một dòng sản phẩm, không phải một lần fork.

## Phạm vi đã kiểm chứng

- **Verified:** TypeScript source contract; mock ACP initialize/session/prompt/stream/permission/cancel; production bundle; Grok CLI 0.2.118 đăng nhập grok.com; real ACP v1 initialize/session/prompt network round trip trả `ACP_OK`; VSIX 0.1.0 cài được trong user VS Code và môi trường cô lập.
- **Chưa kiểm chứng:** OAuth/API-key edge cases, source build Rust trên Windows, pixel của bản vá 0.1.1 trong Extension Host thật và VSIX trên máy sạch khác.
