import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { IMCPServerConfig } from './types';

export class ServerDiscovery extends EventEmitter {
  private readonly configPaths: string[] = [];
  private watchTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    super();
    this.initializeConfigPaths();
  }

  private initializeConfigPaths(): void {
    const homeDir = os.homedir();
    
    // Standard MCP server configuration locations
    this.configPaths.push(
      path.join(homeDir, '.config', 'mcp', 'servers.json'),
      path.join(homeDir, '.mcp', 'servers.json'),
      path.join(process.cwd(), 'mcp-servers.json'),
      path.join(process.cwd(), '.mcp', 'servers.json')
    );

    // Platform-specific paths
    if (process.platform === 'darwin') {
      this.configPaths.push(
        path.join(homeDir, 'Library', 'Application Support', 'Portal Terminal', 'mcp-servers.json')
      );
    } else if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      this.configPaths.push(
        path.join(appData, 'Portal Terminal', 'mcp-servers.json')
      );
    } else {
      this.configPaths.push(
        path.join(homeDir, '.local', 'share', 'portal-terminal', 'mcp-servers.json')
      );
    }
  }

  async discoverServers(): Promise<IMCPServerConfig[]> {
    const allServers: IMCPServerConfig[] = [];

    for (const configPath of this.configPaths) {
      try {
        const servers = await this.loadServersFromFile(configPath);
        allServers.push(...servers);
      } catch (error) {
        // Silently continue if config file doesn't exist or is invalid
        continue;
      }
    }

    // Add built-in server configurations
    allServers.push(...this.getBuiltInServers());

    return this.deduplicateServers(allServers);
  }

  private async loadServersFromFile(filePath: string): Promise<IMCPServerConfig[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(content);
      
      if (Array.isArray(config)) {
        return config.map(this.validateServerConfig);
      } else if (config.servers && Array.isArray(config.servers)) {
        return config.servers.map(this.validateServerConfig);
      } else {
        throw new Error('Invalid server configuration format');
      }
    } catch (error) {
      throw new Error(`Failed to load servers from ${filePath}: ${error}`);
    }
  }

  private validateServerConfig(config: any): IMCPServerConfig {
    if (!config.id || !config.name || !config.command) {
      throw new Error('Server config must have id, name, and command');
    }

    return {
      id: config.id,
      name: config.name,
      command: config.command,
      args: config.args || [],
      env: config.env || {},
      cwd: config.cwd,
      transport: config.transport || 'stdio',
      url: config.url,
      enabled: config.enabled !== false,
      autoStart: config.autoStart !== false,
      restartOnFailure: config.restartOnFailure !== false,
      maxRestarts: config.maxRestarts || 3,
      healthCheckInterval: config.healthCheckInterval || 30000,
    };
  }

  private getBuiltInServers(): IMCPServerConfig[] {
    return [
      {
        id: 'filesystem',
        name: 'Filesystem Server',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', process.cwd()],
        transport: 'stdio',
        enabled: true,
        autoStart: true,
        restartOnFailure: true,
        maxRestarts: 3,
        healthCheckInterval: 30000,
      },
      {
        id: 'git',
        name: 'Git Server',
        command: 'npx',
        args: ['@modelcontextprotocol/server-git', '--repository', process.cwd()],
        transport: 'stdio',
        enabled: true,
        autoStart: true,
        restartOnFailure: true,
        maxRestarts: 3,
        healthCheckInterval: 30000,
      },
      {
        id: 'postgres',
        name: 'PostgreSQL Server',
        command: 'npx',
        args: ['@modelcontextprotocol/server-postgres'],
        env: {
          POSTGRES_CONNECTION_STRING: process.env.POSTGRES_CONNECTION_STRING || '',
        },
        transport: 'stdio',
        enabled: !!process.env.POSTGRES_CONNECTION_STRING,
        autoStart: false,
        restartOnFailure: true,
        maxRestarts: 3,
        healthCheckInterval: 30000,
      },
      {
        id: 'brave-search',
        name: 'Brave Search Server',
        command: 'npx',
        args: ['@modelcontextprotocol/server-brave-search'],
        env: {
          BRAVE_API_KEY: process.env.BRAVE_API_KEY || '',
        },
        transport: 'stdio',
        enabled: !!process.env.BRAVE_API_KEY,
        autoStart: false,
        restartOnFailure: true,
        maxRestarts: 3,
        healthCheckInterval: 30000,
      },
    ];
  }

  private deduplicateServers(servers: IMCPServerConfig[]): IMCPServerConfig[] {
    const seen = new Set<string>();
    return servers.filter(server => {
      if (seen.has(server.id)) {
        return false;
      }
      seen.add(server.id);
      return true;
    });
  }

  async startWatching(): Promise<void> {
    for (const configPath of this.configPaths) {
      try {
        const dir = path.dirname(configPath);
        await fs.mkdir(dir, { recursive: true });
        
        this.watchTimers.set(configPath, setInterval(async () => {
          await this.checkForConfigChanges(configPath);
        }, 5000));
      } catch (error) {
        console.warn(`Could not set up watching for ${configPath}:`, error);
      }
    }
  }

  private async checkForConfigChanges(configPath: string): Promise<void> {
    try {
      const servers = await this.loadServersFromFile(configPath);
      
      for (const serverConfig of servers) {
        if (!this.servers.has(serverConfig.id)) {
          this.emit('serverDiscovered', serverConfig);
        }
      }
    } catch (error) {
      // Config file doesn't exist or is invalid - this is normal
    }
  }

  stopWatching(): void {
    for (const timer of this.watchTimers.values()) {
      clearInterval(timer);
    }
    this.watchTimers.clear();
  }

}