# Portal Terminal - System Architecture

## High-Level Architecture

┌─────────────────────────────────────────────────────────────┐
│                    Portal Desktop App                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  │   Renderer      │  │  Terminal Core  │  │   AI Engine     │
│  │   (React)       │  │   (Node.js)     │  │   (Local+API)   │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘
│                              │                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │           IPC Communication Layer                       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
│
┌─────────────────┐
│   MCP Servers   │
│  (Local Process)│
└─────────────────┘

## Technology Stack (Following Warp's Success Pattern)
- **Terminal**: xterm.js + node-pty (same as Warp)
- **Desktop**: Electron (proven by VS Code, Discord)
- **UI**: React + TypeScript + Tailwind CSS
- **AI Local**: ONNX Runtime for local models
- **AI External**: Provider-specific SDKs
- **MCP**: Model Context Protocol for enhanced context
- **Performance**: WebGL rendering, virtual scrolling

## Core Components to Build
1. **Terminal Core Engine** - PTY management, command execution
2. **Block Management System** - Command blocks with metadata
3. **AI Integration Layer** - Local + external provider support
4. **MCP Client** - Protocol client for context servers
5. **UI Components** - React components for terminal interface
6. **Collaboration Engine** - Real-time session sharing

## Performance Requirements
- Startup: <2 seconds
- AI Local 20B: <500ms
- AI Local 120B: <5s  
- Memory: <200MB baseline
- Rendering: 60fps