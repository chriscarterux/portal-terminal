# @portal/mcp-client

Model Context Protocol (MCP) client implementation for Portal Terminal, providing AI-powered context enhancement through local MCP servers.

## Features

- **Server Management**: Automatic discovery and lifecycle management of MCP servers
- **Health Monitoring**: Continuous health checks with uptime tracking and metrics
- **Context Aggregation**: Intelligent search and indexing of tools, resources, and prompts
- **Cross-Platform**: Support for Windows, macOS, and Linux MCP servers
- **Built-in Servers**: Pre-configured support for filesystem, git, postgres, and search servers

## Usage

```typescript
import { MCPClient } from '@portal/mcp-client';

const client = new MCPClient({
  autoDiscovery: true,
  healthMonitoring: true,
});

await client.initialize();

// Get available context
const context = client.getContext();
console.log(`Available tools: ${context.tools.length}`);

// Search for relevant tools
const matches = client.searchContext({
  type: 'tool',
  query: 'file search',
  limit: 5,
});

// Execute tool
const result = await client.callTool({
  name: 'file-search',
  arguments: { pattern: '*.ts' },
  serverId: 'filesystem',
});
```

## Built-in Server Support

### Filesystem Server
- **Tools**: File operations, directory listing, content reading
- **Resources**: Access to local files and directories
- **Auto-enabled**: Always available

### Git Server  
- **Tools**: Git operations, commit history, branch management
- **Resources**: Repository information, file changes
- **Auto-enabled**: When in git repository

### PostgreSQL Server
- **Tools**: Database queries, schema inspection
- **Resources**: Table data, query results
- **Enabled**: When `POSTGRES_CONNECTION_STRING` environment variable is set

### Brave Search Server
- **Tools**: Web search capabilities
- **Resources**: Search results and web content
- **Enabled**: When `BRAVE_API_KEY` environment variable is set

## Configuration

MCP servers can be configured via JSON files in these locations:

- `~/.config/mcp/servers.json`
- `~/.mcp/servers.json`
- `./mcp-servers.json`
- Platform-specific application data directories

Example configuration:
```json
{
  "servers": [
    {
      "id": "custom-server",
      "name": "Custom MCP Server",
      "command": "node",
      "args": ["./my-mcp-server.js"],
      "transport": "stdio",
      "enabled": true,
      "autoStart": true,
      "restartOnFailure": true,
      "maxRestarts": 3,
      "healthCheckInterval": 30000
    }
  ]
}
```

## Health Monitoring

The client continuously monitors server health:

```typescript
// Get health report
const report = await client.getHealthReport();
console.log(`${report.summary.healthyServers}/${report.summary.totalServers} servers healthy`);

// Listen for health events
client.on('healthCheckFailed', (result) => {
  console.warn(`Server ${result.serverId} health check failed`);
});
```

## Context Search

Intelligent search across all connected servers:

```typescript
// Search for tools related to files
const toolMatches = client.searchContext({
  type: 'tool',
  query: 'file read write',
  limit: 10,
});

// Search within specific server
const gitMatches = client.searchContext({
  type: 'any',
  query: 'commit history',
  serverId: 'git',
});
```

## Performance

- **Startup**: Servers start in parallel for fast initialization
- **Caching**: Context is cached and indexed for fast search
- **Health Checks**: Configurable intervals (default 30s)
- **Timeouts**: Configurable request timeouts
- **Resource Usage**: Minimal memory footprint with efficient indexing