# Packages

Reusable packages that form the core of Portal Terminal's functionality.

## Core Packages

### `terminal-core/`
Core terminal functionality including PTY management, command execution, and block system.

### `ai-providers/`
AI model integrations for both local (GPT-OSS-120B, GPT-OSS-20B) and external providers (OpenAI, Claude, Gemini, DeepSeek, Qwen).

### `mcp-client/`
Model Context Protocol client for enhanced AI context through local servers.

### `ui-components/`
React UI components for terminal interface, themes, and user interactions.

### `collaboration/`
Real-time collaboration features for session sharing and multi-user terminals.

## Development

Each package can be developed independently:

```bash
npm run dev -w packages/terminal-core    # Develop core package
npm run build -w packages/ai-providers   # Build AI providers
npm run test -w packages/mcp-client      # Test MCP client
```