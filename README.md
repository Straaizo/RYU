<div align="center">
  <img src="assets/logo.png" alt="RYU Logo" width="200" />

  # RYU — Programming Assistant

  **Desktop programming assistant powered by Claude AI**

  [![License: Non-Commercial](https://img.shields.io/badge/License-Non--Commercial-red.svg)](LICENSE)
  [![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%2F11-blue.svg)](https://github.com/straaizo/ryu/releases/latest)
  [![Electron](https://img.shields.io/badge/Electron-31-47848F.svg)](https://electronjs.org)
  [![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)

</div>

---

RYU is a desktop programming assistant built with Electron and React, connected to the Anthropic API (Claude). It indexes your entire project, reads and modifies real files, and responds with the precision of an experienced senior developer.

---

## Features

- **Full project context** — indexes all files in your codebase and includes them in every query
- **Real file modification** — RYU proposes changes and you decide which ones to save
- **Drag & drop + attachments** — drag files or images directly into the chat
- **Multimodal support** — send screenshots or designs and RYU analyzes them
- **Two models** — Haiku (fast, economical) and Sonnet (complex, powerful)
- **Visible pipeline** — Analyzing → Generating → Verifying → Done
- **Session persistence** — resumes the last project on startup
- **No Python required** — the installer is self-contained

---

## Requirements

- Windows 10 / 11 (x64)
- Internet connection
- **Anthropic API Key** — get one at [console.anthropic.com](https://console.anthropic.com)

> The API key is stored locally on your machine using `electron-store`. It never leaves your computer except to call the Anthropic API directly.

---

## Installation (end users)

1. Download the ZIP from [Releases](../../releases/latest): `RYU-win32-x64.zip`
2. Extract to any folder
3. Run `RYU.exe`
4. On first launch, enter your Anthropic API key
5. Complete the onboarding — takes less than a minute

> No installation required, no administrator permissions, no external dependencies.

---

## Developer Setup

### Prerequisites

- [Node.js 20+ LTS](https://nodejs.org/)
- npm 10+

### Setup

```bash
git clone https://github.com/straaizo/ryu.git
cd ryu
npm install
npm start
```

### Build portable ZIP

```bash
npm run make
```

Output: `out/make/zip/win32/x64/RYU-win32-x64.zip`

---

## Project Structure

```
ryu/
├── electron/
│   ├── main.js          # main process, IPC handlers, filesystem
│   └── preload.js       # secure renderer ↔ main bridge
├── src/
│   ├── components/
│   │   ├── Chat.jsx             # main chat screen
│   │   ├── ErrorBoundary.jsx    # React error boundary
│   │   ├── FileConfirm.jsx      # file confirmation modal
│   │   ├── Message.jsx          # message rendering with collapsible code
│   │   ├── Onboarding.jsx       # initial setup and profile editing
│   │   ├── Sidebar.jsx          # project file tree
│   │   └── TokenCounter.jsx     # token usage display
│   ├── hooks/
│   │   ├── useAnthropicAPI.js   # AI logic (4-step pipeline)
│   │   ├── usePersistence.js    # profile and session via electron-store
│   │   └── useProjectIndex.js  # project indexing
│   ├── styles/globals.css
│   ├── App.jsx
│   └── main.jsx
├── assets/
│   └── logo.png
├── forge.config.js
├── vite.main.config.js
├── vite.preload.config.js
├── vite.renderer.config.js
└── package.json
```

---

## Usage

### Load a project

Click **📁 Project** in the header or press `Ctrl+O`. RYU indexes all relevant files and includes them as context in every message.

### Attach files

- **Drag & drop** — drag files or images into the chat area
- **📎 Button** — opens a dialog to select multiple files
- **Ctrl+V** — paste images from clipboard directly
- Limit: 5 files per message

### Modify files

When RYU generates code changes, a modal appears with a preview of each file. You can choose which ones to save before confirming.

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Ctrl+O` | Open project |
| `Ctrl+Shift+O` | Attach files |
| `Ctrl+Shift+R` | Reindex project |
| `Ctrl+L` | Clear history |

---

## Privacy

- The API key is stored **locally** at `%APPDATA%\ryu\config.json`
- Messages go **directly** to the Anthropic API — no intermediate servers
- RYU does not collect or send telemetry of any kind

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop | Electron 31 |
| UI | React 18 + Vite 5 |
| AI | Anthropic SDK (`claude-haiku-4-5`, `claude-sonnet-4-6`) |
| Persistence | electron-store |
| Build | electron-forge + maker-zip |

---

## License

Copyright (c) 2026 Enzo Sabattini

This software is provided **free of charge for personal and educational use only**.

**Commercial use is strictly prohibited.** You may not sell, license, sublicense, or otherwise use this software or any derivative work for commercial purposes or financial gain.

Redistribution in source or binary form is permitted provided that this copyright notice and license terms are preserved intact.

This software is provided "as is", without warranty of any kind.

---

*Created by [Enzo Sabattini](https://github.com/straaizo) · powered by [Claude](https://anthropic.com)*
