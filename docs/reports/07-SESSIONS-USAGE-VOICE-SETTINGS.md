# Sessions Activity Bar · Usage · Voice · Settings · Self-host lock

**Extension:** 1.0.4  
**Updated:** 2026-08-09

## 1. Sessions → Activity Bar (icon, collapsible)

| Trước | Sau |
|---|---|
| Sessions nằm **dưới chat** trong secondary sidebar | Container riêng **Activity Bar** `grokBuildSessions` (icon `$(history)`) |
| Không có icon riêng | Click icon lịch sử trên **cột trái** để mở/thu gọn |

Chat **Agent** vẫn ở Secondary Sidebar (phải).

## 2. Tiện ích lập trình “cài sẵn”

| Đã có sẵn trong product | ~90 extension ngôn ngữ Code-OSS (TS, Python syntax, Go, Rust, Java, C++, HTML/CSS, Git, Emmet, …) + js-debug |
|---|---|
| Marketplace (ESLint, Prettier, Pylance, …) | **Không auto-download** (mạng + trust). Danh sách gợi ý: `build/grok/portable-profile/extensions-recommendations.json` |

**Kết luận:** Ngôn ngữ/debug cốt lõi **đã ship**; tiện ích marketplace cần cài thêm hoặc đóng gói VSIX vào payload nếu muốn offline.

## 3. Usage trong khung chat

Từ 1.0.4, Usage kết hợp hai nguồn nhưng phân tách rõ ràng:

| Phần | Nguồn | Nội dung |
|---|---|---|
| **Session context** | ACP | `used/size`, phần trăm context, token input/output/reasoning của turn gần nhất |
| **Account plan** | Grok account API, gọi trong extension host | SuperGrok weekly/monthly limit, reset time, product breakdown, plan, credits |

- Click nút đồng hồ Usage trong composer để mở; lần mở đầu tự refresh.
- Có nút refresh, loading/error/signed-out/expired-session và **Manage usage**.
- Token auth chỉ tồn tại trong extension host. Webview chỉ nhận counter đã chuẩn hóa; custom remote endpoint bắt buộc HTTPS.
- Ở chiều rộng ≤300 px, Effort/Mode/Mic phụ được thu gọn để Usage và Send không chồng nhau.

Verification 1.0.4: 66 tests; 5 rendered scenarios tại 240/390/600 px, light/dark và 150%; packaged runtime activation; truy vấn account thực (output đã loại danh tính) trả về limit, percentage, product counters và reset time.

## 4. Nhớ thư mục project

Mặc định portable + configurationDefaults:

- `window.restoreWindows`: `preserve`
- `window.openWithoutArgumentsInNewWindow`: `off`
- `files.hotExit`: `onExitAndWindowClose`
- `window.openFoldersInNewWindow`: `off`

## 5. Agent yêu cầu đóng app khi sửa grok-code / grok-build-ide

**Nguyên nhân:** Windows **khóa file** của process đang chạy (EXE/DLL/`node_modules`/payload). Khi workspace = source IDE và agent rebuild/ghi đè binary đang chạy → EBUSY/EPERM → agent gợi ý đóng app.

**Không phải bug chat**; là giới hạn OS.

**Cách làm đúng:**
1. Chạy IDE đã cài/portable **tách** khỏi tree source đang edit.
2. Chỉ sửa source; rebuild/package sau khi đóng bản cài nếu thay payload.
3. Hotpatch `dist/extension.cjs` OK; đè `Grok Workbench.exe` đang chạy thì không.

Chi tiết: `docs/grok-workbench/SELF_HOST_EDIT_AND_FEATURES.md`

## 6. Chat voice

| | |
|--|--|
| Cơ chế | Web Speech API trong webview |
| Electron / Code-OSS | **Gần như không có** SpeechRecognition |
| **Kết luận** | **Không khả thi** cho desktop thường |
| 0.8.6 | `voiceInput` default **false**; ẩn mic trừ khi setting bật **và** runtime hỗ trợ |

## 7. Settings rõ hơn

Mỗi setting: `markdownDescription` + **Examples**, `enumItemLabels` / `enumDescriptions`, `order`.
