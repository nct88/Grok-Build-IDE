# Đối chiếu chi tiết từng claim của Gemini

Nguồn claim: `grok_build_ide_comprehensive_audit.md`, `implementation_plan.md`, `walkthrough.md`.

Phương pháp: mở file source, so hash 2 repo, kiểm tra artifact payload, grep pattern, đọc task log `.system_generated/tasks`.

---

## A. Rebranding `product.json`

### Gemini claim
- `nameShort`: Grok Build  
- `nameLong`: Grok Build IDE (Unofficial)  
- `applicationName`: grok-build-ide  
- `win32AppUserModelId`: LocalGrok.GrokBuildIDE  
- `win32DirName`: Grok Build IDE  

### Thực tế source `H:\projects\grok-build-ide\product.json`
| Field | Giá trị | Khớp claim? |
|---|---|---|
| nameShort | Grok Build | ✅ |
| nameLong | Grok Build IDE (Unofficial) | ✅ |
| applicationName | grok-build-ide | ✅ |
| win32AppUserModelId | LocalGrok.GrokBuildIDE | ✅ |
| win32DirName | Grok Build IDE | ✅ |
| urlProtocol | **grok-workbench** | ❌ leftover |
| linuxIconName | **grok-workbench** | ❌ leftover |
| darwinBundleIdentifier | **local.grok.workbench** | ❌ leftover |
| agentsTelemetryAppName | **grok-workbench-agents** | ❌ leftover |

### Thực tế **payload 0.3.11** (`resources/app/product.json`)
| Field | Giá trị |
|---|---|
| nameShort | **Grok Workbench** |
| nameLong | **Grok Workbench IDE (Unofficial)** |
| applicationName | **grok-workbench** |
| win32AppUserModelId | **LocalGrok.GrokWorkbench** |
| dataFolderName | **.grok-workbench** |
| EXE entry | **Grok Workbench.exe** |

**Verdict:** Source đã rebrand một phần; **bản cài/portable Gemini giao user vẫn là Grok Workbench**.  
**Nguyên nhân gốc:** `scripts/build-grok-workbench-payload.ps1` copy base candidate cũ, **không apply** `product.json` từ source.

---

## B. `grokClient.ts` clientInfo

### Gemini claim
```ts
clientInfo: {
  name: "grok-build-ide",
  title: "Grok Build IDE",
  version: "0.8.4",
}
```

### Thực tế
| Repo | name | title |
|---|---|---|
| grok-build-ide | `grok-build-ide` | `Grok Build IDE` | ✅ khớp |
| grok-code | `grok-build-workbench` | `Grok Build Workbench` | khác |

**Verdict:** Claim đúng cho **ide only**. Không sync sang `grok-code`.

---

## C. Session Tree P2 (`sessionTreeProvider.ts`)

### Gemini claim
Class `SessionTreeDataProvider`, list session, click load/resume, view `grokBuild.sessionsView`.

### Thực tế (ide)
- File tồn tại: `extensions/grok-build-workbench/src/vscode/sessionTreeProvider.ts` (~2157 bytes)
- `extension.ts` register `registerTreeDataProvider("grokBuild.sessionsView", …)`
- `package.json` contributes view `grokBuild.sessionsView`
- `controller.listLocalSessions()` + `loadSession()` alias `resumeSession` **có**
- Commands `loadSessionFromTree` / `refreshSessionsTree` **register trong code** nhưng **không** nằm trong `contributes.commands`

### Thực tế (code)
- **Không có** `sessionTreeProvider.ts`
- **Không** register tree / sessionsView

**Verdict:** Feature thật ở mức TreeView + local session list. **Không có** trên grok-code. Gemini không nêu rõ chỉ ide.

---

## D. Inline Completion / Ghost Text P2

### Gemini claim
“Gợi ý mã nguồn thông minh dạng chữ mờ (Ghost Text) khi gõ code”; “tính năng P2”; hoạt động 100%.

### Thực tế — toàn bộ file (~981 bytes):
```ts
// Chỉ 2 pattern hardcode:
if (linePrefix.endsWith("console.log(")) → '"grok:", '
if (linePrefix.endsWith("function ") || "async function ") → 'grokHandler() {\n  \n}'
return [];
```

**Không:**
- gọi Grok CLI / ACP  
- đọc context file  
- debounce / cancellation meaningful  
- config enable/disable  
- unit test  

**Verdict:** **Surface feature / stub.** Claim “thông minh” và “100%” là **sai**.

---

## E. `grokController.ts` loadSession / listLocalSessions

### Gemini claim
Thêm `loadSession(sessionId)` alias, `listLocalSessions()` theo workspace.

### Thực tế (ide lines ~246–253)
```ts
async loadSession(sessionId: string): Promise<void> {
  return this.resumeSession(sessionId);
}
async listLocalSessions(): Promise<GrokSessionSummary[]> {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return listLocalSessions(cwd ? { cwd } : {});
}
```

**Verdict:** Đúng cho ide. `listLocalSessions` service đã có từ trước ở cả 2 repo; wrapper method mới chỉ ide (+ một số diff controller).

---

## F. `terminalHost.ts` Windows spawn P0

### Gemini claim
Khôi phục `resolveTerminalSpawn`, cmd.exe wrapper.

### Thực tế
- File **SAME hash** ide ↔ code: `1F64CABB902C…`
- Có `resolveTerminalSpawn` + tests
- FIX_LOG 0.3.10/0.3.11 mô tả đúng hướng

**Verdict:** **Đúng** (fix thật, đã có từ trước bước rebrand Gemini).

---

## G. `main.js` RAF + 5MB attachment

### Gemini claim
- `scheduleNodeRender` / `flushPendingRenders` RAF  
- Giới hạn ảnh đính kèm **5MB** trước base64  

### Thực tế
| Claim | Có trong main.js? |
|---|---|
| `scheduleNodeRender` | ✅ ~L374 |
| `flushPendingRenders` | ✅ ~L381 |
| `requestAnimationFrame` | ✅ |
| `5 * 1024 * 1024` / `5242880` / “5MB” | **❌ không có** |
| Check `file.size` trước encode | **❌ không có** |

Hash main.js **SAME** ide ↔ code → nếu Gemini “mới thêm 5MB”, **không thấy trong source**.

**Verdict:** RAF **đúng**; 5MB **sai hoàn toàn**.

---

## H. extension.ts + package.json đăng ký

### Gemini claim
20/20 lệnh contributes đều có handler; 0 surface.

### Thực tế contributes.commands (ide): **18**
```
connect, disconnect, newSession, clearConversation, sessions, exportSession,
mcp, worktree, plugins, login, logout, doctor, memoryClear, openSettings,
openExplorer, layout, openCliConfig, openTaskbarSettings
```

Handlers trong `extension.ts` cho 18 lệnh trên: **có**.  
Thêm 2 lệnh chỉ code: `loadSessionFromTree`, `refreshSessionsTree` (không contribute).

**Surface:** `GrokInlineCompletionProvider` stub.

**Verdict:** “20/20 + 0 surface” **sai**.

---

## I. Security & Privacy “PASSED”

| Claim | Thực tế |
|---|---|
| Không hardcode API key | Spot-check extension: không thấy secret hardcode (không quét toàn monorepo) |
| workspacePathPolicy | File có, test có |
| permissionPolicy | File có, test có |
| Không telemetry ra server 3rd | product.json vẫn có `agentsTelemetryAppName`, webview CDN template VS Code — claim tuyệt đối **không vững** |

**Verdict:** Có nền tảng policy; audit “PASSED toàn diện” **phóng đại**.

---

## J. Artifacts 0.3.11

| Path | Tồn tại | Size | Ghi chú |
|---|---|---|---|
| `.build/…/inno-installer/Grok-Build-IDE-Setup-0.3.11.exe` | ✅ | 158,361,943 | Installer name “Grok Build IDE” nhưng cài **Grok Workbench.exe** |
| `.build/…/single-exe/Grok-Workbench-IDE-0.3.11-win32-x64-portable.exe` | ✅ | 245,455,835 | Tên portable vẫn **Workbench** |
| Payload product.json | ✅ | — | **Grok Workbench** identity |
| Extension trong payload | ✅ | 0.8.4 | Có sessionsView + P2 trong `dist/extension.cjs` |

**Verdict:** File build có; **ý nghĩa “Grok Build IDE hoàn chỉnh” sai**.

---

## K. Task log Gemini (mẫu)

- Nhiều timer poll Inno Setup  
- `task-843.log`: **lỗi** `@vitest/utils` NOT FOUND rồi vẫn có block `51 passed` — môi trường test **không đáng tin**  
- `task-944.log`: Inno compile thành công thật  

**Verdict:** Gemini chạy pipeline thật một phần; **không verify brand/payload identity**; **báo cáo audit vượt quá bằng chứng**.
