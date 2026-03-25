# Interintel - Issue Tracker

## Status: Issues found during install/runtime testing (v1.0.23)

Tested by installing from `npm pack` tarball into a clean project directory on Windows + Node v22.

---

## P0 — Blocks installation or startup

### 1. `setup.js` postinstall imports `colors` before deps are installed
- `setup.js` line 5 does `import colors from 'colors'`, but `postinstall` can run before the package's own dependencies are resolved (local path installs, some npm versions).
- **Result**: `ERR_MODULE_NOT_FOUND: Cannot find package 'colors'` — install fails.
- **Fix**: Remove `colors` from `setup.js`. Use plain `console.log()`.

### 2. `setup.js` creates config in wrong directory
- `process.cwd()` during `postinstall` points to the package's own directory inside `node_modules/interintel/`, NOT the user's project root.
- The config file `interintel.config.js` is also shipped inside the package (not excluded by `.npmignore`), so `fs.existsSync()` returns `true` and setup skips creation entirely.
- **Result**: User never gets `interintel.config.js` in their project root.
- **Fix**: Use `process.env.INIT_CWD` (set by npm to the actual install directory). Add `interintel.config.js` and `interintel.permission.json` to `.npmignore`.

### 3. Windows crash: dynamic `import()` needs `file://` URLs
- `providers.js:22` does `await import(configPath)` with a bare Windows path like `C:\Users\...`. ESM `import()` requires `file://` URLs on Windows.
- `src/utils/files.js:14` manually prepends `file://` but doesn't URL-encode (breaks on paths with spaces or special chars).
- **Result**: `ERR_UNSUPPORTED_ESM_URL_SCHEME` — CLI crashes on startup on Windows.
- **Fix**: Use `pathToFileURL()` from `node:url` everywhere.

### 4. `.npmignore` ships runtime config files in the package
- `interintel.config.js`, `interintel.permission.json`, and `package-lock.json` are not excluded. They ship inside the npm package and interfere with setup logic.
- **Fix**: Add them to `.npmignore`.

---

## P1 — Core functionality broken

### 5. OpenAI and Mistral tool calls are never processed
- `cli.js` lines 145–153: when `aiService` is `openai` or `mistral`, the code extracts `completion.choices[0].message.content` and moves on. It never checks for `tool_calls`.
- `processAIResponse()` only handles Ollama's response shape (`response.message.tool_calls`). OpenAI returns `response.choices[0].message.tool_calls`.
- **Result**: All 6 tools (read, write, edit, search, list, execute) only work with Ollama. OpenAI/Mistral users get text-only responses.
- **Fix**: Route all providers through a unified tool-call handler that normalizes response shapes.

### 6. `chatCompletion` returns `null` on error, causing crashes
- `providers.js:88` catches errors and returns `null`. `cli.js` doesn't check for `null` before accessing `.choices[0]` or `.message`.
- **Result**: Unhandled `TypeError` crashes the CLI on any API error (bad key, network issue, etc.).
- **Fix**: Check for `null`/error returns in `cli.js` before processing.

---

## P2 — Cleanup and modernization

### 7. `node-fetch` is unnecessary
- Package requires Node `>=18.0.0` which has native `fetch()`. The `node-fetch@^3` dependency adds `node-fetch`, `data-uri-to-buffer`, `node-domexception`, and `fetch-blob` for no reason.
- **Fix**: Use global `fetch()`, remove `node-fetch` from dependencies.

