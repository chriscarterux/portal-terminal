import { EventEmitter } from 'events';
import { MCPServer } from './mcp-server';
import { ServerDiscovery } from './server-discovery';
import { ContextAggregator } from './context-aggregator';
import { 
  IMCPServerConfig, 
  IMCPServerStatus, 
  IMCPContext,
  IMCPTool,
  IMCPResource,
  IMCPPrompt,
  IMCPToolCall,
  IMCPToolResult,
  IMCPResourceRequest,
  IMCPResourceContent
} from './types';

export class ServerManager extends EventEmitter {
  private servers = new Map<string, MCPServer>();
  private discovery: ServerDiscovery;
  private contextAggregator: ContextAggregator;

  constructor() {
    super();
    this.discovery = new ServerDiscovery();
    this.contextAggregator = new ContextAggregator();
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.discovery.on('serverDiscovered', (config: IMCPServerConfig) => {
      this.emit('serverDiscovered', config);
    });
  }

  async addServer(config: IMCPServerConfig): Promise<void> {
    if (this.servers.has(config.id)) {
      throw new Error(`Server ${config.id} already exists`);
    }

    const server = new MCPServer(config);
    this.setupServerEventHandlers(server);
    
    this.servers.set(config.id, server);
    this.emit('serverAdded', config);

    if (config.autoStart) {
      await server.start();
    }
  }

  private setupServerEventHandlers(server: MCPServer): void {
    server.on('statusChange', (status: IMCPServerStatus) => {
      this.emit('serverStatusChange', status);
      this.updateAggregatedContext();
    });

    server.on('connected', () => {
      this.updateAggregatedContext();
    });

    server.on('disconnected', () => {
      this.updateAggregatedContext();
    });

    server.on('error', (error: Error) => {
      this.emit('serverError', server.getConfig().id, error);
    });
  }

  async removeServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }

    await server.stop();
    this.servers.delete(serverId);
    this.emit('serverRemoved', serverId);
    this.updateAggregatedContext();
  }

  async startServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    await server.start();
  }

  async stopServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    await server.stop();
  }

  async restartServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    await server.restart();
  }

  getServerStatus(serverId: string): IMCPServerStatus | null {
    const server = this.servers.get(serverId);
    return server ? server.getStatus() : null;
  }

  getAllServerStatuses(): IMCPServerStatus[] {
    return Array.from(this.servers.values()).map(server => server.getStatus());
  }

  getConnectedServers(): IMCPServerStatus[] {
    return this.getAllServerStatuses().filter(status => status.status === 'running');
  }

  async discoverServers(): Promise<IMCPServerConfig[]> {
    return this.discovery.discoverServers();
  }

  async startWatching(): Promise<void> {
    return this.discovery.startWatching();
  }

  stopWatching(): void {
    this.discovery.stopWatching();
  }

  async getAggregatedContext(): Promise<IMCPContext> {
    return this.contextAggregator.getContext();
  }

  private async updateAggregatedContext(): Promise<void> {
    const connectedServers = Array.from(this.servers.values())
      .filter(server => server.isConnected());

    const tools: IMCPTool[] = [];
    const resources: IMCPResource[] = [];
    const prompts: IMCPPrompt[] = [];

    for (const server of connectedServers) {
      try {
        const serverTools = await server.listTools();
        const serverResources = await server.listResources();
        const serverPrompts = await server.listPrompts();
        
        tools.push(...serverTools);
        resources.push(...serverResources);
        prompts.push(...serverPrompts);
      } catch (error) {
        console.warn(`Failed to get context from server ${server.getConfig().id}:`, error);
      }
    }

    const context: IMCPContext = {
      tools,
      resources,
      prompts,
      servers: this.getAllServerStatuses(),
      lastUpdated: new Date(),
    };

    this.contextAggregator.updateContext(context);
    this.emit('contextUpdated', context);
  }

  async callTool(toolCall: IMCPToolCall): Promise<IMCPToolResult> {
    const server = this.servers.get(toolCall.serverId);
    if (!server) {
      return {
        success: false,
        error: `Server ${toolCall.serverId} not found`,
      };
    }

    if (!server.isConnected()) {
      return {
        success: false,
        error: `Server ${toolCall.serverId} not connected`,
      };
    }

    return server.callTool(toolCall.name, toolCall.arguments);
  }

  async readResource(request: IMCPResourceRequest): Promise<IMCPResourceContent> {
    const server = this.servers.get(request.serverId);
    if (!server) {
      throw new Error(`Server ${request.serverId} not found`);
    }

    if (!server.isConnected()) {
      throw new Error(`Server ${request.serverId} not connected`);
    }

    return server.readResource(request.uri);
  }

  async startAll(): Promise<void> {
    const startPromises = Array.from(this.servers.values())
      .filter(server => server.getConfig().autoStart)
      .map(server => server.start().catch(error => {
        console.warn(`Failed to start server ${server.getConfig().id}:`, error);
      }));

    await Promise.all(startPromises);
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.servers.values())
      .map(server => server.stop().catch(error => {
        console.warn(`Failed to stop server ${server.getConfig().id}:`, error);
      }));

    await Promise.all(stopPromises);
  }

  destroy(): void {
    this.stopAll();
    this.removeAllListeners();
  }
}