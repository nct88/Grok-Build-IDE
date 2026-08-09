# Kế hoạch sửa mã nguồn, đồng bộ, build lại

## Mục tiêu

1. Sửa claim sai thành hành vi thật trong code.  
2. Đồng bộ extension logic giữa `grok-build-ide` ↔ `grok-code`.  
3. Build release mới (0.3.12) với identity nhất quán hơn + extension đã sửa.  
4. Ghi bằng chứng vào `bao-cao/`.

## Việc sửa (priority)

### P0 — Đúng sự thật / không ship stub lừa

1. **Inline completion:** giữ provider nhưng đánh dấu rõ là **local snippet stub** (setting `grokBuild.inlineCompletion.enabled` default off) **hoặc** remove khỏi “AI feature” surface; không claim AI.  
2. **Attachment 5MB:** thêm guard thật trong `media/main.js` (và host nếu encode base64).  
3. **product.json leftovers** (ide): `urlProtocol`, `linuxIconName`, `darwinBundleIdentifier`, `agentsTelemetryAppName` → `grok-build-ide` / `local.grok.build-ide`.  
4. **package.json:** contribute `loadSessionFromTree`, `refreshSessionsTree`; activationEvents tương ứng.  
5. **Payload pipeline:** sau copy base, patch `resources/app/product.json` từ source product identity (các field hiển thị: nameShort, nameLong, applicationName, dataFolderName, win32*, mutex…). **Không** rename `Grok Workbench.exe` ở vòng này (launcher hardcode) — document rõ; window title sẽ là Grok Build IDE.  
6. **Vitest deps:** cài đủ `@vitest/*` trong extension node_modules; `npm test` exit 0.  
7. **FIX_LOG + packaging.json** cập nhật version mới.

### P1 — Đồng bộ 2 tree

Copy sang `grok-code` (cùng relative path):

- `extensions/grok-build-workbench/src/**` (kể cả sessionTree + inline + extension.ts + controller + client)  
- `extensions/grok-build-workbench/media/**`  
- `extensions/grok-build-workbench/package.json`  
- `scripts/build-grok-workbench-payload.ps1` (nếu patch brand optional theo product.json)  
- `fix-bug/FIX_LOG.md` entry mới  

**Không** overwrite `grok-code/product.json` brand Workbench trừ khi user muốn 1 brand duy nhất.  
(Với task hiện tại: **giữ brand riêng**; sync extension + scripts.)

### P2 — Build 0.3.12

```
1. typecheck + vitest + esbuild production (extension)
2. package vsix
3. build-grok-workbench-release.ps1 -Version 0.3.12
   -BaseCandidateRoot = 0.3.11 payload (hoặc base mới nhất)
4. verify single-exe + runtime test
5. optional Inno setup
6. ghi SHA256 + brand check vào bao-cao/05
```

## Tiêu chí chấp nhận

- [ ] Audit báo cáo Gemini: có file trong `bao-cao/` (xong phần 00–04)  
- [ ] tsc 0 error  
- [ ] vitest all pass (exit 0, không thiếu package)  
- [ ] payload product.json nameShort/nameLong = Grok Build / Grok Build IDE…  
- [ ] extension 0.8.4+ có sessions tree; inline off-by-default hoặc labeled stub  
- [ ] 2 tree extension src/media/package.json đồng bộ (hash match)  
- [ ] artifact 0.3.12 tồn tại + hash ghi báo cáo  
