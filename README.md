# Grok Build IDE

<p align="center">
  <a href="./README.en.md">🇬🇧 English</a> | <strong>🇻🇳 Tiếng Việt</strong>
</p>

Grok Build IDE là trình soạn thảo mã nguồn tùy chọn dựa trên **Code - OSS**, tích hợp sẵn giao diện **Grok Build Workbench** và kết nối với **Grok CLI chính thức** qua ACP (`grok agent stdio`). Sản phẩm dành cho người dùng cần đầy đủ Explorer, editor, terminal, Source Control và debug bên cạnh trải nghiệm agent.

> Grok Build IDE là repository độc lập. Ứng dụng agent desktop chính nằm tại [`nct88/Grok-Build`](https://github.com/nct88/Grok-Build).

Phiên bản hiện tại: **1.0.8** — xem [`build/grok/VERSION`](build/grok/VERSION).

## Tải xuống

Release hiện tại nằm trong repository private và yêu cầu tài khoản GitHub có quyền truy cập:

| Gói | Mục đích | Tải xuống |
|---|---|---|
| Inno Setup | Cài đặt đầy đủ trên Windows | [Grok-Build-IDE-Setup-1.0.8.exe](https://github.com/nct88/Grok-Build-IDE/releases/download/v1.0.8/Grok-Build-IDE-Setup-1.0.8.exe) |
| Portable EXE | File chạy portable tự giải nén | [Grok-Build-IDE-1.0.8-win32-x64-portable.exe](https://github.com/nct88/Grok-Build-IDE/releases/download/v1.0.8/Grok-Build-IDE-1.0.8-win32-x64-portable.exe) |
| Portable ZIP | Giải nén một lần để sử dụng lâu dài | [Grok-Build-IDE-1.0.8-win32-x64-portable.zip](https://github.com/nct88/Grok-Build-IDE/releases/download/v1.0.8/Grok-Build-IDE-1.0.8-win32-x64-portable.zip) |
| VSIX Update | Cập nhật riêng Grok Build Workbench | [grok-build-workbench-1.0.8.vsix](https://github.com/nct88/Grok-Build-IDE/releases/download/v1.0.8/grok-build-workbench-1.0.8.vsix) |
| Manifest | Kích thước và SHA-256 của artifact | [MANIFEST.json](https://github.com/nct88/Grok-Build-IDE/releases/download/v1.0.8/MANIFEST.json) |

Trang release: [Grok Build IDE v1.0.8](https://github.com/nct88/Grok-Build-IDE/releases/tag/v1.0.8).

Các executable Windows hiện chưa được ký Authenticode. SmartScreen có thể cảnh báo trong lần chạy đầu; hãy kiểm tra SHA-256 trong `MANIFEST.json` trước khi chạy.

## Grok Build và Grok Build IDE khác nhau thế nào?

| Sản phẩm | Mục tiêu | Nên dùng khi |
|---|---|---|
| **Grok Build** | Giao diện agent desktop, tập trung vào hội thoại và điều phối | Bạn muốn trải nghiệm agent gọn, không cần toàn bộ IDE |
| **Grok Build IDE** | Code - OSS với Grok Workbench tích hợp | Bạn muốn editor, Explorer, terminal, SCM, debug và agent trong cùng cửa sổ |
| **Grok CLI** | Agent engine, xác thực, session và tool loop | Thành phần bắt buộc cho cả Desktop và IDE |

Hai giao diện dùng chung ranh giới runtime:

```text
Grok Build IDE (Code - OSS)
    → extension: extensions/grok-build-workbench
        → ACP client/controller
            → grok agent stdio
                → ~/.grok (xác thực, phiên và cấu hình CLI)
```

## Tính năng chính

### Môi trường phát triển Code - OSS

- Explorer, editor nhiều tab, tìm kiếm và điều hướng mã nguồn.
- Terminal tích hợp, Source Control, diff editor và debug surface.
- Hệ thống command, settings, keybinding và extension của Code - OSS.
- Nhận diện sản phẩm, icon, installer và thư mục dữ liệu riêng với VS Code.

### Grok Build Workbench

- Chat với Grok CLI qua ACP ngay trong sidebar.
- Hiển thị Markdown, thinking, tool activity, trạng thái lượt chạy và lỗi.
- Chọn permission mode, model, reasoning effort và session mode.
- Tạo phiên mới, xem danh sách session, nạp/tiếp tục session và đổi tên session.
- Theo dõi file agent mở/chỉnh sửa; có thể mở diff khi agent sửa tệp.
- Reverse filesystem/terminal RPC được giới hạn theo workspace và policy.
- Lối tắt cho MCP, worktree, plugin, login/logout, doctor và CLI config.
- Hiển thị context token, usage tài khoản và liên kết quản lý usage an toàn.
- Hỗ trợ theme sáng/tối và giao diện responsive trong sidebar hẹp.

### Chuyển đổi giữa hai sản phẩm

- **Open Grok Build** mở ứng dụng agent desktop.
- **Open Grok Build IDE** quay lại giao diện IDE.
- Product surface mặc định của package IDE là `grok-build-ide`.
- Agent-first layout trong IDE là tùy chọn; lựa chọn gần nhất được ghi nhớ.

## Yêu cầu hệ thống

### Người dùng

- Windows x64 cho các artifact phát hành hiện tại.
- Grok CLI đã được cài và xác thực.
- Quyền đọc/ghi đối với workspace đang mở theo chính sách đã chọn.

Kiểm tra CLI trước khi chạy IDE:

```powershell
grok --version
grok login
grok doctor
```

Extension tìm CLI theo cấu hình `grokBuild.executablePath`, `PATH` và vị trí cài đặt người dùng phổ biến của Grok CLI.

### Phát triển và đóng gói

- Node.js theo [`.nvmrc`](.nvmrc) — hiện là 24.15.0.
- npm 11 đi kèm Node.js trong `.nvmrc` và toolchain Code - OSS.
- Windows SDK/toolchain cần thiết cho phần native của Code - OSS.
- .NET SDK cho portable single-file launcher.
- Inno Setup cho installer Windows.
- Một base release candidate hợp lệ khi dùng pipeline tái sử dụng payload.

## Cài đặt và bắt đầu nhanh

### Cách 1: Inno Setup

1. Tải `Grok-Build-IDE-Setup-1.0.8.exe`.
2. Đối chiếu checksum với `MANIFEST.json`.
3. Chạy installer.
4. Mở **Grok Build IDE** từ Start Menu.
5. Chọn **Open Folder** và mở workspace.
6. Mở Grok Build ở sidebar, kiểm tra mode/quyền rồi kết nối.

Đường dẫn cài mặc định:

```text
%LOCALAPPDATA%\Programs\Grok Build IDE\Grok Build IDE.exe
```

### Cách 2: Portable ZIP

1. Tải và giải nén ZIP vào một thư mục cố định.
2. Chạy `Grok Build IDE.exe`.
3. Không di chuyển riêng executable ra khỏi payload vì Electron cần các DLL và thư mục `resources` đi kèm.

### Cách 3: Portable EXE

Portable EXE tự giải nén payload vào cache theo version rồi khởi chạy IDE. Cách này thuận tiện để thử nhanh; ZIP phù hợp hơn khi dùng thường xuyên.

## Cấu hình Grok quan trọng

Mở **Settings** và tìm `Grok Build` hoặc chỉnh các key sau:

| Setting | Ý nghĩa |
|---|---|
| `grokBuild.defaultProduct` | Product surface mặc định |
| `grokBuild.agentFirstLayout` | Bật layout ưu tiên agent trong IDE |
| `grokBuild.executablePath` | Đường dẫn tùy chỉnh đến Grok CLI |
| `grokBuild.extraArguments` | Tham số CLI bổ sung |
| `grokBuild.autoStart` | Tự kết nối khi extension kích hoạt |
| `grokBuild.model` | Model mặc định |
| `grokBuild.reasoningEffort` | Mức reasoning mặc định |
| `grokBuild.permissionMode` | Chính sách xin quyền/chạy tool |
| `grokBuild.sandbox` | Chế độ sandbox của agent |
| `grokBuild.tools` | Danh sách tool cho phép |
| `grokBuild.deniedTools` | Danh sách tool bị từ chối |
| `grokBuild.worktree` | Bật hoặc cấu hình worktree |
| `grokBuild.experimentalMemory` | Bật tính năng memory thử nghiệm |
| `grokBuild.disableWebSearch` | Tắt web search khi cần |
| `grokBuild.rules` | Rules truyền cho agent |
| `grokBuild.maxTurns` | Giới hạn số lượt agent |
| `grokBuild.enableTerminal` | Cho phép reverse terminal host |
| `grokBuild.allowOutsideWorkspace` | Cho phép truy cập ngoài workspace |
| `grokBuild.followAgentFiles` | Tự theo file agent đang thao tác |
| `grokBuild.openDiffOnEdit` | Mở diff khi agent chỉnh sửa |
| `grokBuild.voiceInput` | Hiển thị voice input khi runtime hỗ trợ |

Không đặt token hoặc credential vào setting đồng bộ/chia sẻ. Xác thực chính vẫn thuộc Grok CLI.

## Chạy từ mã nguồn

Clone repository, cài dependency và khởi động ứng dụng bằng giao diện npm chuẩn:

```powershell
git clone https://github.com/nct88/Grok-Build-IDE.git
cd Grok-Build-IDE
npm install
npm start
```

`npm start` gọi launcher Code - OSS phù hợp với hệ điều hành, thực hiện
prelaunch compile cần thiết và mở Grok Build IDE. Có thể truyền tham số ứng
dụng sau `--`, ví dụ `npm start -- .\my-project`.

Kiểm tra Grok Build Workbench:

```powershell
npm run check:grok
```

Gate này bao gồm:

1. TypeScript typecheck.
2. Vitest unit/integration tests.
3. Production bundle.
4. Hợp đồng release/branding.
5. Visual webview scenarios ở light/dark và nhiều kích thước.

## Kiến trúc repository

```text
grok-build-ide/
├─ src/                              Code - OSS workbench source
├─ extensions/
│  └─ grok-build-workbench/          ACP controller, webview và Grok UI
├─ build/                            Build scripts và nhận diện sản phẩm
│  └─ grok/VERSION                   Version phát hành Grok Build IDE
├─ resources/                        Icon và tài nguyên theo nền tảng
├─ scripts/
│  ├─ grok-release/                  Release orchestrator/publisher
│  ├─ start-grok-build-ide.mjs       npm start launcher
│  ├─ build-grok-workbench-*.ps1     Tạo payload, launcher và installer
│  └─ verify-*.ps1                   Cổng kiểm tra artifact/runtime
├─ docs/                             Kiến trúc và hướng dẫn vận hành
├─ CHANGELOG.md                      Thay đổi theo phiên bản
├─ product.json                      Product identity của IDE
├─ packaging.json                    Hợp đồng đóng gói
└─ dist/                             Artifact cục bộ theo version
```

### Ranh giới runtime

- Code - OSS cung cấp editor shell.
- Grok-specific runtime/UI nằm trong `extensions/grok-build-workbench`.
- Grok CLI là child process sở hữu agent loop và kết nối dịch vụ.
- Extension không lưu bản sao token Grok trong webview.
- Truy cập filesystem ngoài workspace bị từ chối mặc định, trừ policy/override được kiểm chứng.

Xem [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Build và phát hành

Version phải đồng bộ giữa:

- `build/grok/VERSION`.
- `extensions/grok-build-workbench/package.json`.
- Tham số `-Version` của release command.

Lệnh phát hành chuẩn:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\grok-release\build-and-publish.ps1 `
  -Version <semver>
```

Nếu không có base candidate phù hợp, truyền rõ đường dẫn:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\grok-release\build-and-publish.ps1 `
  -Version <semver> `
  -BaseCandidateRoot <duong-dan-payload-hop-le>
```

Mỗi version là bất biến; pipeline dừng nếu `dist/<version>` đã tồn tại.

```text
dist/<version>/
├─ install/
│  └─ Grok-Build-IDE-Setup-<version>.exe
├─ portable/
│  ├─ Grok-Build-IDE-<version>-win32-x64-portable.exe
│  └─ Grok-Build-IDE-<version>-win32-x64-portable.zip
├─ update/
│  ├─ grok-build-workbench-<version>.vsix
│  └─ apply-update.ps1
├─ MANIFEST.json
└─ latest.json
```

Pipeline release kiểm tra đủ portable EXE, portable ZIP, installer và VSIX trước khi xuất bản metadata. Chế độ public yêu cầu HTTPS và chữ ký Authenticode hợp lệ.

## Cập nhật riêng extension

Gói `update/` cho phép cập nhật Grok Build Workbench mà không cài lại toàn bộ IDE:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\apply-update.ps1 `
  -InstallRoot "$env:LOCALAPPDATA\Programs\Grok Build IDE"
```

Đóng toàn bộ cửa sổ IDE trước khi cập nhật và mở lại sau khi script hoàn tất.

## Kiểm tra artifact cuối

Các script quan trọng:

| Script | Mục đích |
|---|---|
| `scripts/check-grok-brand-assets.ps1` | Kiểm tra bộ nhận diện và icon |
| `scripts/check-grok-release-contract.mjs` | Kiểm tra version, tên và hợp đồng release |
| `scripts/verify-portable-extension-registry.ps1` | Kiểm tra extension registry trong payload |
| `scripts/verify-grok-workbench-portable-settings.ps1` | Kiểm tra portable settings |
| `scripts/verify-grok-workbench-single-exe.ps1` | Kiểm tra launcher/payload |
| `scripts/test-grok-workbench-single-exe-runtime.ps1` | Chạy smoke test trên executable cuối |

Build thành công không tự chứng minh runtime hoặc giao diện đúng. Release chỉ nên được xem là đã kiểm chứng khi các gate trên chạy với chính artifact cuối.

## Bảo mật và quyền riêng tư

- Token xác thực thuộc Grok CLI/Extension Host và không được gửi sang webview.
- URL bên ngoài phải vượt qua policy HTTPS/localhost phù hợp; URL chứa credential bị từ chối.
- Filesystem, editor follow và diff review mặc định bị giới hạn theo workspace.
- `allowOutsideWorkspace` là quyền mở rộng rõ ràng, không nên bật mặc định.
- Không commit `.env`, auth file, cookie database, private key, token hoặc log chứa thông tin cá nhân.
- Workspace Trust và portable defaults phải được kiểm tra trên artifact, không chỉ trong source.

## Khắc phục sự cố

### Grok sidebar không kết nối

```powershell
grok --version
grok login
grok doctor
```

Sau đó kiểm tra `grokBuild.executablePath` và mở lại cửa sổ IDE.

### Sidebar không xuất hiện

- Mở Activity Bar và chọn Grok Build.
- Chạy command **Grok Build: Connect** hoặc **Grok Build: New Session**.
- Kiểm tra extension `grok-build-workbench` đã được cài/đăng ký trong profile portable.

### Portable EXE khởi động chậm lần đầu

Launcher cần giải nén payload vào cache theo version. Những lần sau sẽ tái sử dụng cache nếu các file quan trọng còn hợp lệ.

### Installer/portable hiện SmartScreen

Executable hiện chưa ký số. Chỉ chạy artifact từ release chính thức sau khi SHA-256 khớp `MANIFEST.json`.

### Update VSIX chưa có hiệu lực

Đóng toàn bộ IDE trước khi chạy `apply-update.ps1`, kiểm tra đúng `InstallRoot`, sau đó khởi động lại.

## Tài liệu liên quan

| Tài liệu | Nội dung |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Kiến trúc Code - OSS/Grok extension |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Cài dependency, chạy source và kiểm tra |
| [`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md) | Build và phát hành |
| [`CHANGELOG.md`](CHANGELOG.md) | Thay đổi theo phiên bản |
| [`SECURITY.md`](SECURITY.md) | Chính sách báo cáo vấn đề bảo mật |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Hướng dẫn đóng góp Code - OSS |

## Đóng góp

- Thay đổi Grok-specific nên tập trung trong `extensions/grok-build-workbench`, `build/grok`, `scripts/grok-release`, tài nguyên nhận diện và tài liệu liên quan.
- Không phá vỡ bố cục chuẩn của Code - OSS: `src`, `extensions`, `build`, `resources`, `cli`, `remote`, `test`.
- Chạy gate extension và kiểm tra artifact phù hợp trước khi mở Pull Request.
- Không đưa artifact lớn, cache build, secret hoặc dữ liệu người dùng vào commit.
- Các vấn đề thuộc Code - OSS upstream nên được đối chiếu với [`microsoft/vscode`](https://github.com/microsoft/vscode).

## Nguồn gốc và giấy phép

Repository này được xây dựng trên mã nguồn **Code - OSS** của Microsoft và giữ bố cục/toolchain tương thích với upstream.

- Code - OSS được cấp phép theo [`LICENSE.txt`](LICENSE.txt) — MIT License.
- Thông báo phụ thuộc bên thứ ba nằm trong [`ThirdPartyNotices.txt`](ThirdPartyNotices.txt).
- Hướng dẫn đóng góp upstream nằm trong [`CONTRIBUTING.md`](CONTRIBUTING.md).

Visual Studio Code là bản phân phối riêng của Microsoft với các tùy chỉnh và giấy phép sản phẩm riêng. Grok Build IDE không phải Visual Studio Code và không được tuyên bố là sản phẩm chính thức của Microsoft.

Grok CLI và các model Grok thuộc chủ sở hữu tương ứng trong hệ sinh thái xAI/Grok. Grok Build IDE là bản tích hợp độc lập sử dụng CLI chính thức qua ACP; không tuyên bố liên kết chính thức nếu chưa có xác nhận bằng văn bản.
