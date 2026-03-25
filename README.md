# Interintel

A CLI for local AI-assisted development. Chat with AI models running on your machine to read, search, edit files, and run commands—without sending your code to the cloud.

## Features

- **Local-first**: Works with Ollama for fully local AI (no data leaves your machine)
- **Multi-provider**: Supports Ollama, OpenAI, and Mistral
- **AI-driven tools**: AI can read files, search code, edit files, and run commands
- **Permission system**: You control what the AI can do
- **Fuzzy search**: Natural language queries find `chatCompletion`, `chat_completion`, etc.

## Requirements

- Node.js >= 18.0.0
- [Ollama](https://ollama.ai/) (for local AI) with a tool-capable model:
  - `llama3.1:8b` (recommended)
  - `qwen2.5:7b`
  - `gpt-oss:20b`

## Installation

```bash
npm install interintel
```

Or clone and run locally:
```bash
git clone https://github.com/modern-sapien/inter-intel.git
cd inter-intel
npm install
node index.js
```

## Configuration

After install, edit `interintel.config.js` in your project root:

```javascript
export default {
  // 'ollama' | 'openai' | 'mistral'
  aiService: 'ollama',

  // Model name
  aiVersion: 'llama3.1:8b',

  // API key (only for OpenAI/Mistral)
  apiKey: process.env.OPENAI_API_KEY || '',

  // Files to load into context
  filePaths: [],
};
```

## Usage

```bash
interintel
# or
node index.js
```

Then chat naturally:
```
You: What files are in this project?
You: Find where fetchUser is defined
You: Update the version in package.json to 2.0.0
You: Run npm test
```

## AI Tools

The AI has access to these tools:

| Tool | Description | Permission |
|------|-------------|------------|
| `read_file` | Read file contents | Allowed |
| `list_directory` | List files/folders | Allowed |
| `search_directory` | Search code with fuzzy matching | Allowed |
| `edit_file` | Modify existing files | Requires permission |
| `write_file` | Create new files | Requires permission |
| `run_command` | Execute shell commands | Requires permission |

## Permissions

Write and execute operations require your approval:

```
AI wants to write: src/index.js
[y]es (once) / [n]o / [a]lways (save) / [g]lobal (trust all writes):
```

- `y` - Allow once (session only)
- `n` - Deny
- `a` - Always allow this directory (saved)
- `g` - Trust all write operations (saved)

View permissions with `//permissions`. Settings saved in `interintel.permissions.json`.

## Commands

| Command | Description |
|---------|-------------|
| `//permissions` | Show current permission settings |
| `//readrefs` | Load reference files from config |
| `//writefile` | AI-assisted file creation |
| `exit` | Quit interintel |

## File Structure

```
interintel/
├── index.js                # Entry point
├── setup.js                # Postinstall setup
├── src/
│   ├── cli.js              # Main CLI loop
│   ├── providers.js        # AI service interface (Ollama/OpenAI/Mistral)
│   ├── tools/
│   │   ├── definitions.json
│   │   ├── executors.js
│   │   ├── index.js
│   │   └── permissions.js
│   └── utils/
│       ├── chat.js         # Readline helpers
│       ├── files.js        # File operations
│       └── writeFileHandler.js
└── templates/
    └── config.js           # Config template
```

## License

Apache-2.0
