# NPM Package Readiness Review

## Status: NOT READY FOR PUBLISHING

---

## Critical Blockers (Must fix)

### 1. No `bin` field - can't run as CLI command
```json
// Add to package.json:
"bin": {
  "interintel": "./index.js"
}
```

### 2. Missing shebang in index.js
```javascript
// Add as first line of index.js:
#!/usr/bin/env node
```

### 3. `node-fetch` not in dependencies
Used in serviceInterface.js but not listed in package.json.

### 4. Hardcoded paths break when installed as dependency
| File | Issue |
|------|-------|
| `setup.js` | Uses `../../interintel.config.js` - wrong for node_modules |
| `index.js` | `process.cwd()` assumes user is in project root |
| `serviceInterface.js` | Same cwd assumption |
| `tools/permissions.js` | Same cwd assumption |

### 5. Config template uses `require()` in ES module package
`resources/interintel.config.template.js` uses CommonJS but package is ES modules.

---

## High Priority (Should fix)

### 1. Add `.npmignore`
```
.claude/
.git/
.gitignore
FOR_REVIEW.md
INSTRUCTIONS.md
testIntel.js
mistral.js
resources/training/
resources/multi-step/
node_modules/
*.tgz
.DS_Store
```

### 2. Update package.json
```json
{
  "description": "CLI for local AI-assisted development with OpenAI, Mistral, and Ollama",
  "license": "Apache-2.0",
  "engines": {
    "node": ">=18.0.0"
  },
  "files": [
    "index.js",
    "serviceInterface.js",
    "functions/",
    "tools/",
    "resources/interintel.config.template.js",
    "resources/reference.txt"
  ]
}
```

### 3. Update README.md
Current README is outdated:
- Only mentions OpenAI (missing Mistral, Ollama)
- No installation instructions
- No API key setup
- No mention of tools (read_file, write_file, etc.)
- No permissions system documentation
- File structure doesn't include /tools directory

---

## Medium Priority

| Item | Status |
|------|--------|
| CONTRIBUTING.md | Missing |
| CHANGELOG.md | Missing |
| Real tests | testIntel.js is just a stub |
| Dead code | mistral.js appears unused |

---

## Files to Clean Up

| File | Action |
|------|--------|
| `testIntel.js` | Remove or make real test |
| `mistral.js` | Remove or document purpose |
| `summary.txt` | Add to .gitignore (generated) |
| `dotenv-imports.txt` | Add to .gitignore (generated) |
| `test.txt` | Add to .gitignore (generated) |
| `interintel.permissions.json` | Add to .gitignore (user config) |

---

## Recommended Fix Order

1. **package.json** - bin, description, license, engines, files, add node-fetch
2. **index.js** - add shebang
3. **.npmignore** - create
4. **.gitignore** - update with generated files
5. **setup.js** - fix paths for npm install
6. **README.md** - full rewrite with current features
7. **Config template** - convert to ES modules
8. **Clean up** - remove test files, dead code
