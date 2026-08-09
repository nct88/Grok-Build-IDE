# Phân tích build Release 0.3.11 (Gemini)

## 1. Artifact quan sát được

```
H:\projects\grok-build-ide\.build\release-candidates\0.3.11\
  extension\grok-build-workbench-0.8.4.vsix
  payload\Grok-Workbench-IDE-0.3.11-win32-x64-portable.zip
  payload\grok-workbench-poc-0.3.11\
    Grok Workbench.exe          ← entry Electron thật
    resources\app\product.json  ← Grok Workbench identity
    data\extensions\local-grok-workbench.grok-build-workbench-0.8.4\
  single-exe\Grok-Workbench-IDE-0.3.11-win32-x64-portable.exe
  inno-installer\Grok-Build-IDE-Setup-0.3.11.exe
  verify-cache\ ...
  runtime-cache\ ...
```

## 2. Pipeline thực tế

```
extension: tsc → vitest → esbuild → vsix
payload:   copy BaseCandidateRoot (old Workbench tree)
           + inject VSIX into data/extensions
           + settings template
           + zip
single-exe: .NET launcher embeds ZIP, entry "Grok Workbench.exe"
inno:       wraps payload folder; AppName "Grok Build IDE" nhưng MyAppExeName vẫn "Grok Workbench.exe"
```

### Điểm mù (root cause rebrand fail)

`build-grok-workbench-payload.ps1` **không** đọc `product.json` source.  
→ Mọi rebrand source **không bao giờ** vào portable/setup trừ khi:

- full gulp rebuild Electron app từ source, **hoặc**
- hot-patch `resources/app/product.json` (+ optional rename exe + launcher constants) sau copy base.

## 3. Launcher / installer brand mismatch

| Component | Brand string |
|---|---|
| Inno AppName | Grok Build IDE |
| Inno MyAppExeName | Grok Workbench.exe |
| Portable launcher `Program.cs` | EntryPointFileName = "Grok Workbench.exe" |
| Portable artifact file name | Grok-Workbench-IDE-… |
| Setup artifact file name | Grok-Build-IDE-Setup-… |
| Window title (product.json payload) | Grok Workbench IDE (Unofficial) |

User thấy installer “Grok Build IDE” nhưng app chạy vẫn “Grok Workbench” — **đúng kiểu báo cáo Gemini gây hiểu nhầm**.

## 4. Extension trong 0.3.11

- Version 0.8.4  
- `dist/extension.cjs` chứa sessionsView / loadSessionFromTree / clientInfo grok-build-ide  
- Inline stub cũng nằm trong bundle  

→ Extension layer **có** P2; shell **không** rebrand.

## 5. Verification Gemini claim

Walkthrough liệt kê:

- FirstExtraction, CachedSecondLaunch, MissingCriticalFileRepair  
- ExtensionRegistry, PortableSettings, RuntimeProcessCount  

Script `verify-grok-workbench-single-exe.ps1` **không** kiểm tra `nameShort === "Grok Build"`.  
Chỉ check file tồn tại + registry + settings.

**→ Có thể “pass verification” mà brand vẫn Workbench.**

## 6. packaging.json

Vẫn ghi:

- Version/command 0.3.9  
- status: verified  
- artifact path 0.3.9  

**Không phản ánh 0.3.11.** Gemini không cập nhật metadata release chuẩn.

## 7. Kết luận build 0.3.11

| Câu hỏi | Trả lời |
|---|---|
| Có file .exe? | Có |
| Extension 0.8.4 có P2? | Có (kèm stub) |
| Là “Grok Build IDE” hoàn chỉnh? | **Không** |
| Có thể phân phối như product rebrand? | **Không nên** cho đến khi patch product identity + verify brand |
