# Apps

This directory contains the main applications built on top of the Portal Terminal platform.

## Desktop App (`desktop/`)

The primary Electron-based desktop application that provides the Portal Terminal user interface.

### Structure
- `src/main/` - Electron main process (Node.js)
- `src/renderer/` - Electron renderer process (React)
- `src/shared/` - Shared types and utilities

### Key Features
- Cross-platform terminal interface
- AI-powered command suggestions
- Block-based command execution
- Real-time collaboration
- MCP integration for enhanced context

### Development
```bash
npm run dev -w apps/desktop  # Start development server
npm run build -w apps/desktop # Build for production
```