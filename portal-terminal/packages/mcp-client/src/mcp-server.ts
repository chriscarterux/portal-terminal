import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { IMCPServerConfig, IMCPServerStatus, IMCPCapabilities } from './types';

export class MCPServer extends EventEmitter {
  private process: ChildProcess | null = null;
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private status: IMCPServerStatus;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(private config: IMCPServerConfig) {
    super();
    
    this.status = {
      id: config.id,
      status: 'stopped',
      restartCount: 0,
    };
  }

  async start(): Promise<void> {
    if (this.status.status === 'running' || this.status.status === 'starting') {
      return;
    }

    this.status.status = 'starting';
    this.emit('statusChange', this.status);

    try {
      await this.startProcess();
      await this.initializeClient();
      await this.setupHealthCheck();
      
      this.status.status = 'running';
      this.status.connectionTime = new Date();
      this.emit('statusChange', this.status);
      this.emit('connected');
      
    } catch (error) {
      this.status.status = 'error';
      this.status.lastError = error instanceof Error ? error.message : String(error);
      this.emit('statusChange', this.status);
      this.emit('error', error);
      
      if (this.config.restartOnFailure && this.status.restartCount < this.config.maxRestarts) {
        setTimeout(() => this.restart(), 5000);
      }
    }
  }

  private async startProcess(): Promise<void> {
    if (this.config.transport !== 'stdio') {
      throw new Error(`Transport ${this.config.transport} not yet implemented`);
    }

    this.process = spawn(this.config.command, this.config.args || [], {
      cwd: this.config.cwd,
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.on('error', (error) => {
      this.status.status = 'error';
      this.status.lastError = error.message;
      this.emit('error', error);
    });

    this.process.on('exit', (code, signal) => {
      this.status.status = code === 0 ? 'stopped' : 'crashed';
      this.emit('disconnected', { code, signal });
      
      if (this.config.restartOnFailure && code !== 0 && this.status.restartCount < this.config.maxRestarts) {
        setTimeout(() => this.restart(), 5000);
      }
    });
  }

  private async initializeClient(): Promise<void> {
    if (!this.process) {
      throw new Error('Process not started');
    }

    this.transport = new StdioClientTransport({
      reader: this.process.stdout!,
      writer: this.process.stdin!,
    });

    this.client = new Client({
      name: 'portal-terminal',
      version: '0.1.0',
    }, {
      capabilities: {
        sampling: {},
      },
    });

    await this.client.connect(this.transport);
    
    // Get server capabilities
    const serverInfo = await this.client.getServerInfo();
    this.status.capabilities = {
      tools: !!serverInfo.capabilities.tools,
      resources: !!serverInfo.capabilities.resources,
      prompts: !!serverInfo.capabilities.prompts,
      sampling: !!serverInfo.capabilities.sampling,
      logging: !!serverInfo.capabilities.logging,
    };
  }

  private async setupHealthCheck(): Promise<void> {
    if (this.config.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(async () => {
        await this.performHealthCheck();
      }, this.config.healthCheckInterval);
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('Client not initialized');
      }

      // Simple ping to check if server is responsive
      await this.client.ping();
      this.status.lastSeen = new Date();
      
    } catch (error) {
      this.status.lastError = error instanceof Error ? error.message : String(error);
      this.emit('healthCheckFailed', error);
    }
  }

  async restart(): Promise<void> {
    this.status.restartCount++;
    await this.stop();
    await this.start();
  }

  async stop(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.warn('Error closing MCP client:', error);
      }
      this.client = null;
    }

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        console.warn('Error closing transport:', error);
      }
      this.transport = null;
    }

    if (this.process && !this.process.killed) {
      this.process.kill();
      this.process = null;
    }

    this.status.status = 'stopped';
    this.emit('statusChange', this.status);
    this.emit('disconnected');
  }

  async listTools(): Promise<IMCPTool[]> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const response = await this.client.listTools();
    return response.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      serverId: this.config.id,
    }));
  }

  async listResources(): Promise<IMCPResource[]> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const response = await this.client.listResources();
    return response.resources.map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
      serverId: this.config.id,
    }));
  }

  async listPrompts(): Promise<IMCPPrompt[]> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const response = await this.client.listPrompts();
    return response.prompts.map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
      serverId: this.config.id,
    }));
  }

  async callTool(name: string, arguments_: any): Promise<IMCPToolResult> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      const response = await this.client.callTool({
        name,
        arguments: arguments_,
      });

      return {
        success: !response.isError,
        content: response.content,
        isText: response.content.some(c => c.type === 'text'),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async readResource(uri: string): Promise<IMCPResourceContent> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const response = await this.client.readResource({ uri });
    const content = response.contents[0];

    return {
      uri,
      mimeType: content.mimeType,
      text: content.type === 'text' ? content.text : undefined,
      blob: content.type === 'blob' ? Buffer.from(content.blob, 'base64') : undefined,
    };
  }

  getStatus(): IMCPServerStatus {
    return { ...this.status };
  }

  getConfig(): IMCPServerConfig {
    return { ...this.config };
  }

  isConnected(): boolean {
    return this.status.status === 'running' && this.client !== null;
  }
}