# Sửa màn hình đen khi mở Grok Build IDE

**Ngày:** 2026-08-04  
**Bản user đang chạy:** cài Inno `Grok Build IDE` tại  
`%LOCALAPPDATA%\Programs\Grok Build IDE`

---

## 1. Hiện tượng

- Mở phần mềm → cửa sổ **đen**, gần như không UI (hoặc chỉ title bar).
- Log `main.log` rất ngắn, **không có** `renderer.log` / `exthost.log` ở giai đầu.
- Extension host crash lặp lại (sau khi preload được khôi phục).

---

## 2. Nguyên nhân (đã chứng minh bằng log)

### A. Thiếu workbench preload (màn hình đen tuyệt đối)

| File | Trạng thái trước sửa |
|---|---|
| `resources/app/out/vs/base/parts/sandbox/electron-browser/preload.js` | **MISSING** |
| `resources/app/out/**` | Chỉ **57** file (bản tốt 0.3.1 có **164**) |

Electron tạo `BrowserWindow` với:

```ts
preload: '.../sandbox/electron-browser/preload.js'
```

Không có preload → renderer **không bootstrap** workbench → cửa sổ đen.

**Nguồn gốc:** pipeline payload copy base candidate đã **mất** ~107 file `out/` (từ ~0.3.3 trở đi).  
Gemini / release 0.3.11–0.3.12 **không phát hiện** vì script verify chỉ check `Grok Workbench.exe` + `product.json` + `extensions.json`.

### B. Package `undici` thiếu module (extension host crash)

Sau khi khôi phục preload, UI workbench hiện ra (menu, welcome, logo), nhưng:

```
Error: Cannot find module './lib/web/websocket/stream/websocketstream'
Require stack:
- .../node_modules/undici/index.js
- .../node_modules/@vscode/proxy-agent/out/index.js
```

→ Extension host thoát code 1 ngay (~200ms), không activate extension Grok.

`undici` bản hỏng: **116** file; bản tốt: **118** file (thiếu `websocketstream.js` + 1 file liên quan).

### C. Git extension thiếu `@vscode/fs-copyfile`

```
Activating extension 'vscode.git' failed: Cannot find module
'.../extensions/git/node_modules/@vscode/fs-copyfile/lib/index.js'
```

Không gây đen cửa sổ, nhưng làm status bar báo lỗi.

### D. `extensions.json` trỏ absolute path build machine

```
location.fsPath = h:\projects\grok-build-ide\.build\release-candidates\0.3.11\...
```

đã sửa về path cài đặt thực tế + giữ `relativeLocation`.

---

## 3. Việc đã làm (hotfix bản cài sẵn)

1. Copy **107 file out/** còn thiếu từ  
   `H:\projects\grok-code\releases\0.3.1\...\resources\app\out`
2. Thay nguyên package **`undici`** bằng bản 0.3.1 đầy đủ
3. Khôi phục các package thiếu file (`@microsoft`, `@xterm`, …)
4. Khôi phục `extensions/git/node_modules`
5. Sửa `data/extensions/extensions.json` trỏ đúng thư mục cài
6. Reset `data/user-data` sạch

### Kết quả sau hotfix (đã verify)

| Check | Kết quả |
|---|---|
| Có `renderer.log` | ✅ |
| Có `exthost.log` / `Grok Build Workbench.log` | ✅ |
| Extension host crash loop | ✅ **hết** |
| UI welcome + menu + activity bar | ✅ (screenshot `screenshot-after-undici-fix.png`) |
| Window title | `Grok Workbench IDE (Unofficial)` (brand shell cũ; identity product patch riêng) |

---

## 4. Sửa pipeline (chống tái phát)

`scripts/build-grok-workbench-payload.ps1` đã được cập nhật:

1. **Không** dùng `ConvertTo-Json` để patch `product.json` (gây BOM/phá JSON).
2. Patch identity bằng regex in-place.
3. Guard: nếu thiếu `preload.js` → restore từ release 0.3.1 tốt.
4. Guard: nếu thiếu `undici/.../websocketstream.js` → restore undici đầy đủ.

---

## 5. Việc user nên làm ngay

1. **Đóng hết** cửa sổ Grok Workbench / Grok Build IDE.
2. Mở lại từ Start Menu: **Grok Build IDE**.
3. Kỳ vọng: welcome dark theme (nền tối **có** logo + menu + activity bar — **không** còn đen trơ).
4. Mở folder project (`File → Open Folder` hoặc `Ctrl+K Ctrl+O`).
5. Sidebar phải: view **Grok Build / Agent**.

Nếu vẫn đen:

```powershell
# Kiểm tra preload
Test-Path "$env:LOCALAPPDATA\Programs\Grok Build IDE\resources\app\out\vs\base\parts\sandbox\electron-browser\preload.js"
# Kiểm tra undici
Test-Path "$env:LOCALAPPDATA\Programs\Grok Build IDE\resources\app\node_modules\undici\lib\web\websocket\stream\websocketstream.js"
```

Cả hai phải là `True`.

---

## 6. Lưu ý

- Hotfix đã apply **trên bản cài hiện tại**.  
- Portable/Setup 0.3.11–0.3.12 **trong `.build`** cũng đã được patch `out/` + `undici` một phần; nên rebuild 0.3.13 từ base đã sửa trước khi phát hành lại.
- Màn welcome tối màu **không phải** bug nếu vẫn thấy logo + phím tắt + menu — đó là dark theme mặc định.
