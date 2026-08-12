# Development

## Requirements

- Node.js version declared by `.nvmrc`
- npm 11 (bundled with the Node.js version declared by `.nvmrc`)
- Python and Windows C++ build tools required by Code - OSS native dependencies
- Grok CLI available on `PATH`, in `%USERPROFILE%\.grok\bin`, or through
  `GROK_EXECUTABLE`

## Run from source

```powershell
git clone https://github.com/nct88/Grok-Build-IDE.git
cd Grok-Build-IDE
npm install
npm start
```

`npm start` runs the existing Code - OSS prelaunch pipeline and opens the
development application. Use `npm run check:grok` for the Grok Build
Workbench typecheck, tests, production bundle, release contract and visual
scenarios.

Generated output such as `node_modules/`, `.build/`, `out/`, `dist/`,
VSIX packages, screenshots and local session state must remain untracked.
