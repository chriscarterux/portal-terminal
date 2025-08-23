import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';

export interface IMCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  autoStart: boolean;
  env?: Record<string, string>;
  cwd?: string;
}

export interface IMCPServerStatus {
  id: string;
  name: string;
  status: 'stopped' | 'starting' | 'running' | 'error';
  lastError?: string;
  capabilities?: string[];
}

export class WorkingMCPClient extends EventEmitter {
  private servers = new Map<string, { config: IMCPServerConfig; process?: ChildProcess; status: IMCPServerStatus }>();
  private initialized = false;

  constructor(private options: any = {}) {
    super();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load server configurations
    const servers = this.getDefaultServers();
    
    for (const config of servers) {
      if (config.enabled && config.autoStart) {
        await this.addAndStartServer(config);
      }
    }

    this.initialized = true;
    this.emit('initialized');
  }

  private getDefaultServers(): IMCPServerConfig[] {
    return [
      {
        id: 'context7',
        name: 'Context7 Documentation',
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp@latest'],
        enabled: true,
        autoStart: true,
      },
      {
        id: 'memory',
        name: 'Memory Bank',
        command: 'npx',
        args: ['@modelcontextprotocol/server-memory'],
        enabled: true,
        autoStart: true,
      },
      {
        id: 'filesystem',
        name: 'Filesystem',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', '.'],
        enabled: true,
        autoStart: true,
        cwd: process.cwd(),
      },
    ];
  }

  private async addAndStartServer(config: IMCPServerConfig): Promise<void> {
    const status: IMCPServerStatus = {
      id: config.id,
      name: config.name,
      status: 'starting',
    };

    try {
      const childProcess = spawn(config.command, config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: config.cwd || process.cwd(),
        env: { ...process.env, ...config.env },
      });

      let connected = false;

      childProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('running on stdio') || output.includes('MCP Server')) {
          status.status = 'running';
          connected = true;
          this.emit('serverConnected', status);
        }
      });

      childProcess.stderr.on('data', (data) => {
        const error = data.toString();
        if (error.includes('error') || error.includes('Error')) {
          status.status = 'error';
          status.lastError = error.trim();
          this.emit('serverError', status);
        }
      });

      childProcess.on('exit', (code) => {
        status.status = code === 0 ? 'stopped' : 'error';
        if (code !== 0) {
          status.lastError = `Process exited with code ${code}`;
        }
        this.emit('serverDisconnected', status);
      });

      this.servers.set(config.id, { 
        config, 
        process: childProcess, 
        status 
      });

      // Wait a moment for initial connection
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (connected) {
        console.log(`✅ MCP Server ${config.name} connected`);
      } else {
        console.log(`⚠️  MCP Server ${config.name} started but no confirmation received`);
      }

    } catch (error) {
      status.status = 'error';
      status.lastError = error instanceof Error ? error.message : String(error);
      this.servers.set(config.id, { config, status });
      console.log(`❌ Failed to start MCP Server ${config.name}:`, error);
    }
  }

  getServerStatuses(): IMCPServerStatus[] {
    return Array.from(this.servers.values()).map(server => server.status);
  }

  getConnectedServers(): IMCPServerStatus[] {
    return this.getServerStatuses().filter(status => status.status === 'running');
  }

  async getRelevantContext(command: string, workingDirectory: string): Promise<{
    tools: any[];
    resources: any[];
    suggestions: string[];
  }> {
    const connectedServers = this.getConnectedServers();
    const suggestions: string[] = [];

    // Generate context-aware suggestions based on connected servers
    if (connectedServers.some(s => s.id === 'context7')) {
      suggestions.push('📚 Context7: Use "use context7" to get up-to-date documentation');
    }

    if (connectedServers.some(s => s.id === 'memory')) {
      suggestions.push('🧠 Memory: Previous commands and context are being tracked');
    }

    if (connectedServers.some(s => s.id === 'filesystem')) {
      suggestions.push(`📁 Filesystem: Project context available for ${path.basename(workingDirectory)}`);
    }

    // Command-specific suggestions
    if (command.includes('git')) {
      suggestions.push('💡 Try: git status, git log, git diff for repository context');
    }

    if (command.includes('npm') || command.includes('yarn')) {
      suggestions.push('💡 Package.json and dependencies are available via filesystem context');
    }

    return {
      tools: [],
      resources: [],
      suggestions,
    };
  }

  getContext(): any {
    const connectedServers = this.getConnectedServers();
    
    return {
      tools: [],
      resources: [],
      prompts: [],
      servers: connectedServers,
      lastUpdated: new Date(),
      summary: {
        totalServers: this.servers.size,
        connectedServers: connectedServers.length,
        capabilities: connectedServers.map(s => s.capabilities || []).flat(),
      },
    };
  }

  async destroy(): Promise<void> {
    for (const server of this.servers.values()) {
      if (server.process && !server.process.killed) {
        server.process.kill();
      }
    }
    this.servers.clear();
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}