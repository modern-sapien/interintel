# Revised Proposal: AI-Driven Tool Use

## Core Concept

Instead of users manually invoking commands, the AI has access to tools/functions it can call autonomously. The user describes what they want, and the AI decides which tools to use.

**Current:** User types `//read src/index.js` → file contents shown
**PROPOSED - UPDATED** User types here's a bug I encountered and AI does a query through file system read_file() or search_directories() until it can figure out where the bug is likely coming from and then calls commands.

## Architecture Change

### From: Command Parser
```
User input → Check for // prefix → Execute command OR chat
```

### To: Function Calling / Tool Use
```
User input → Send to AI with available tools → AI responds OR calls tools → Loop until done
```

## Phase 1: AI Tool Implementation

### Tools to Implement

| Tool | Description | AI Use Case |
|------|-------------|-------------|
| `read_file(path)` | Read file contents | "Let me look at that file..." |
| `search_directory(path)` | Read directory or grep contents | "Let me look for this..." |
| `write_file(path, content)` | Create/overwrite file | "I'll create that component..." |
| `edit_file(path, old, new)` | Find & replace in file | "Let me fix that typo..." |
| `list_directory(path)` | Show files/folders | "Let me see what's in src/..." |
| `search_files(pattern, query)` | Grep across files | "Let me find where that's used..." |
| `run_command(cmd)` | Execute shell command | "Let me run the tests..." |

### How It Works

1. Define tools in OpenAI/Ollama function-calling format
2. Send user message + tool definitions to AI
3. If AI returns tool calls → execute them, return results to AI
4. If AI returns text → display to user
5. Loop until AI is done

### Example Flow

```
User: "Add error handling to the fetch call in api.js"

AI: [calls read_file("api.js") or search_directory() if user mentions specific functionality or components, etc. to try and match]
System: [returns file contents]
AI: [calls edit_file("api.js", "fetch(url)", "fetch(url).catch(err => console.error(err))")]
System: [returns success]
AI: "I've added error handling to the fetch call in api.js. The fetch now catches errors and logs them to console."
```

## Implementation Steps

1. **Create tool definitions** - JSON schema for each tool
2. **Create tool executors** - Functions that actually read/write/run
3. **Create tool loop** - Send message → check for tool calls → execute → repeat
4. **Add safety guards** - Confirm before writes, limit shell commands
5. **Keep manual commands** - `//read` etc. still work as shortcuts

## Ollama Consideration

Ollama supports function calling with compatible models (mistral, llama3.1+). Need to verify `mistral:instruct` supports it, or switch to a model that does.

## User Commands (Secondary)

These remain available for explicit control:
- `//read <path>` - Force read a file
- `//search_directory <string>` - Read files where string or potentially related string match
- `//write <path>` - Force write mode
- `//run <cmd>` - Force run a command
- `//tools` - Show available AI tools
- `//confirm on|off` - Toggle write confirmations

---

## Future Improvements / TODO

### read_file enhancements
- Add `lines` parameter (start/end) to read specific ranges
- Add `summary` flag to return file overview instead of full content
- Consider max file size limit to prevent context blowout
- Could add `search` parameter to return only matching lines

### General
- Startup check to warn if model doesn't support tool calling
- Streaming responses for main AI call
- Consider separate messaging for AI vs user in tool results (AI gets detailed guidance, user sees simplified version)

---

## Permissions System (Priority)

### Concept
AI-managed permissions similar to Claude Code. User grants permissions as needed, saved to config.

### Permission Types
| Permission | Scope | Example |
|------------|-------|---------|
| `read` | directory/glob | `"read": ["src/**", "*.config.js"]` |
| `write` | directory/glob | `"write": ["src/**"]` |
| `execute` | command allowlist | `"execute": ["npm test", "git *"]` |

### Flow
1. AI attempts tool call (e.g., `edit_file("src/index.js")`)
2. Check `interintel.permissions.json` for matching permission
3. If no permission:
   - AI asks: "Can I edit files in src/? [yes/no/always]"
   - `yes` = allow this once
   - `no` = deny
   - `always` = save to permissions config
4. AI can read/update permissions config

### Config Example
```json
{
  "read": ["**/*"],
  "write": ["src/**", "tests/**"],
  "execute": ["npm test", "npm run *", "git status", "git diff"],
  "blocked": ["rm -rf", "sudo *"]
}
```

### Startup Behavior
- If config missing/empty: AI asks "Can I read/write files in this directory?"
- AI explains what permissions it needs for the task
