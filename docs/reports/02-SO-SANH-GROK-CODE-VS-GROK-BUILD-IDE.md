# So sánh `grok-code` vs `grok-build-ide`

**Thời điểm:** 2026-08-04

## 1. Vai trò dự kiến

| Tree | Vai trò |
|---|---|
| `H:\projects\grok-code` | Code-OSS fork + Grok Workbench (nhánh dev / lịch sử release 0.1–0.3.x) |
| `H:\projects\grok-build-ide` | Cây product “Grok Build IDE” (copy/bootstrap từ grok-code + chỉnh extension/UI/rebrand) |

`SOURCE_COPY_STATUS.md` (ide) xác nhận bootstrap copy từ grok-code (15,985 files).

## 2. Khác biệt extension (nguồn quan trọng)

### File chỉ có ở ide
- `src/vscode/sessionTreeProvider.ts`
- `src/vscode/inlineCompletionProvider.ts`

### Hash so khớp (SHA256 prefix 12)

| File | Kết quả |
|---|---|
| `media/main.js` | SAME |
| `media/markdown.js` | SAME |
| `media/styles.css` | SAME |
| `media/timeline.js` | SAME |
| `src/vscode/terminalHost.ts` | SAME |
| `packaging.json` | SAME |
| `src/extension.ts` | **DIFF** |
| `src/acp/grokClient.ts` | **DIFF** |
| `src/vscode/grokController.ts` | **DIFF** |
| `package.json` (extension) | **DIFF** |
| `product.json` | **DIFF** |

## 3. product.json brand

| Field | grok-build-ide | grok-code |
|---|---|---|
| nameShort | Grok Build | Grok Workbench |
| nameLong | Grok Build IDE (Unofficial) | Grok Workbench IDE (Unofficial) |
| applicationName | grok-build-ide | grok-workbench |
| dataFolderName | .grok-build-ide | .grok-workbench |
| win32AppUserModelId | LocalGrok.GrokBuildIDE | LocalGrok.GrokWorkbench |
| urlProtocol | grok-workbench (leftover) | grok-workbench |
| linuxIconName | grok-workbench (leftover) | grok-workbench |

## 4. node_modules / test

| | ide | code |
|---|---|---|
| extension node_modules packages | ~372 | ~10 |
| `@vitest/utils` | **THIẾU** (gây fail vitest) | thiếu / tối giản |
| Vitest chạy ổn | Không (thiếu dep) | fallback từng dùng trong script |

## 5. Releases

| | ide | code |
|---|---|---|
| `releases/` | (dùng `.build/release-candidates`) | 0.1.0 … 0.3.0 archives |
| Latest candidate | 0.3.11 (Workbench shell + ext 0.8.4) | lịch sử portable Workbench |

## 6. Rủi ro diverge

1. Sửa bug trên ide không về code → rebuild từ code mất fix.  
2. Gemini thêm P2 chỉ trên ide → 2 tree lệch.  
3. product brand lệch nhưng payload vẫn Workbench → user nhầm 2 product.  
4. `packaging.json` vẫn pin metadata 0.3.9 verified — **không cập nhật 0.3.11**.

## 7. Chính sách đồng bộ khuyến nghị

1. **Source-of-truth extension logic:** `grok-build-ide/extensions/grok-build-workbench` (sau khi sửa stub/policy).  
2. **Sync sang grok-code:** `src/**`, `media/**`, `package.json` extension, tests, esbuild — **không** bắt buộc overwrite product brand code.  
3. **product.json:** giữ brand riêng từng tree **hoặc** rebrand cả hai theo quyết định product.  
4. **Scripts build:** đồng bộ script payload/release; patch product identity khi đóng gói ide.
