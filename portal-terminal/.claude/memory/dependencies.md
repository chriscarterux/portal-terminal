# Portal Terminal - Dependencies

## Core Dependencies

### Terminal & System
- **electron**: ^28.0.0 - Desktop app framework
- **@xterm/xterm**: ^5.5.0 - Terminal emulator component
- **@xterm/addon-fit**: ^0.10.0 - Automatic terminal resizing
- **@xterm/addon-web-links**: ^0.11.0 - Clickable links in terminal
- **node-pty**: ^1.0.0 - PTY management for cross-platform terminals

### UI Framework
- **react**: ^18.2.0 - UI library
- **react-dom**: ^18.2.0 - React DOM bindings

### Build & Development
- **vite**: ^5.0.8 - Fast build tool for renderer process
- **typescript**: ^5.3.0 - Type safety and modern JS features
- **@vitejs/plugin-react**: ^4.2.1 - React support for Vite

### Code Quality
- **eslint**: ^8.54.0 - Code linting
- **prettier**: ^3.1.0 - Code formatting
- **@typescript-eslint/parser**: ^6.13.0 - TypeScript ESLint support
- **@typescript-eslint/eslint-plugin**: ^6.13.0 - TypeScript-specific rules

### Testing
- **jest**: ^29.7.0 - Unit testing framework
- **ts-jest**: ^29.1.1 - TypeScript support for Jest
- **@playwright/test**: ^1.40.0 - E2E testing

### AI & Local Models
- **onnxruntime-node**: ^1.19.0 - Local AI model inference
- **openai**: ^4.20.0 - OpenAI API client
- **@anthropic-ai/sdk**: ^0.24.0 - Claude API client

### MCP (Model Context Protocol)
- **@modelcontextprotocol/sdk**: ^0.5.0 - MCP client library
- **@upstash/context7-mcp**: Latest - Documentation context
- **@modelcontextprotocol/server-memory**: Latest - Persistent memory
- **@modelcontextprotocol/server-filesystem**: Latest - File system access
- **@modelcontextprotocol/server-github**: Latest - GitHub integration

## Version Compatibility Matrix

| Component | Node.js | Electron | TypeScript | ONNX Runtime |
|-----------|---------|----------|------------|--------------|
| Desktop App | >=18.0.0 | ^28.0.0 | ^5.3.0 | ^1.19.0 |
| AI Providers | >=18.0.0 | N/A | ^5.3.0 | ^1.19.0 |
| MCP Client | >=18.0.0 | N/A | ^5.3.0 | N/A |
| Terminal Core | >=18.0.0 | N/A | ^5.3.0 | N/A |

## Performance Targets
- **Bundle size**: <10MB total app
- **Startup time**: <2s cold start  
- **Memory usage**: <200MB baseline
- **AI inference (20B)**: <500ms response time
- **AI inference (120B)**: <5s response time
- **MCP health checks**: Every 30s

## System Requirements

### For Local AI (GPT-OSS-20B)
- **RAM**: 8GB minimum, 16GB recommended
- **CPU**: 4+ cores, 8+ preferred
- **Storage**: 10GB for model files
- **GPU**: Optional but recommended for 3x speed boost

### For Local AI (GPT-OSS-120B)
- **RAM**: 32GB minimum, 64GB recommended  
- **CPU**: 8+ cores, 16+ preferred
- **Storage**: 50GB for model files
- **GPU**: Highly recommended for acceptable performance

### External Providers (Fallback)
- **RAM**: 1GB (minimal local processing)
- **Network**: Stable internet connection
- **API Keys**: Provider-specific authentication

## Installation & Setup

```bash
# Install all dependencies
npm install

# Test system capabilities
npm run test:ai

# Test MCP server connectivity  
npm run test:mcp

# Download AI models (manual)
mkdir models/
# Download from Hugging Face Model Hub
```

## Development Scripts

- `npm run test:ai` - Analyze AI model compatibility
- `npm run test:mcp` - Test MCP server connections
- `npm run build:packages` - Build all packages
- `npm run dev` - Start development with hot reload