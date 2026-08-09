# Grok Workbench IDE architecture

The target product is a thin Code - OSS distribution. Product identity and defaults are maintained in `product.json`; Grok-specific runtime and UI remain in `extensions/grok-build-workbench`.

`H:\projects\grok-code` is the canonical workspace for both the Code - OSS shell and Grok extension. The adjacent `grok-app` checkout is retained only as a migration fallback and is not a build or packaging input.

```text
Grok Workbench IDE (Code - OSS target; VSCodium runtime for the 0.1.0 POC)
├─ Explorer / editor / terminal / SCM / debug
├─ Built-in Grok Build Workbench extension
│  ├─ onboarding and settings
│  ├─ ACP client/controller/webview
│  └─ workspace-scoped reverse RPC and permission UI
└─ child process: grok [options] agent stdio
   └─ locally authenticated xAI service
```

The POC deliberately does not fork the Grok Rust runtime or store authentication material. A production distribution may bootstrap the official CLI installer after a separate legal and supply-chain review.

## 0.1.0 runtime boundary

The repository remains pinned to Code - OSS 1.124.2 as the source-of-truth fork. The runnable Windows POC overlays the same product identity, resources, and Grok extension onto the verified VSCodium 1.126.04524 portable runtime. A pure source-built executable remains pending the Visual Studio Spectre-mitigated libraries; this distinction must remain visible in release notes.
