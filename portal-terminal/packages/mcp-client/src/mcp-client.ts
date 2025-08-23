import { EventEmitter } from 'events';
import * as path from 'path';
import { ServerManager } from './server-manager';
import { HealthMonitor } from './health-monitor';
import { ContextAggregator } from './context-aggregator';
import { 
  IMCPServerConfig,
  IMCPContext,
  IMCPToolCall,
  IMCPToolResult,
  IMCPResourceRequest,
  IMCPResourceContent,
  IContextQuery,
  IContextMatch
} from './types';

export interface IMCPClientOptions {
  autoDiscovery?: boolean;
  healthMonitoring?: boolean;
  maxConcurrentRequests?: number;
}

export class MCPClient extends EventEmitter {
  private serverManager: ServerManager;
  private healthMonitor: HealthMonitor;
  private contextAggregator: ContextAggregator;
  private initialized = false;

  constructor(private options: IMCPClientOptions = {}) {
    super();
    
    this.serverManager = new ServerManager();
    this.healthMonitor = new HealthMonitor();
    this.contextAggregator = new ContextAggregator();
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Server manager events
    this.serverManager.on('serverAdded', (config: IMCPServerConfig) => {
      this.emit('serverAdded', config);
    });

    this.serverManager.on('serverRemoved', (serverId: string) => {
      this.emit('serverRemoved', serverId);
    });

    this.serverManager.on('serverStatusChange', (status) => {
      this.emit('serverStatusChange', status);
    });

    this.serverManager.on('contextUpdated', (context: IMCPContext) => {
      this.contextAggregator.updateContext(context);
    });

    this.serverManager.on('serverError', (serverId: string, error: Error) => {
      this.emit('serverError', serverId, error);
    });

    // Health monitor events
    this.healthMonitor.on('healthCheck', (result) => {
      this.emit('healthCheck', result);
    });

    this.healthMonitor.on('healthCheckFailed', (result) => {
      this.emit('healthCheckFailed', result);
    });

    // Context aggregator events
    this.contextAggregator.on('contextUpdated', (context: IMCPContext) => {
      this.emit('contextUpdated', context);
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Auto-discover servers if enabled
      if (this.options.autoDiscovery !== false) {
        const discoveredServers = await this.serverManager.discoverServers();
        
        for (const serverConfig of discoveredServers) {
          if (serverConfig.enabled) {
            await this.serverManager.addServer(serverConfig);
          }
        }
      }

      // Start monitoring if enabled
      if (this.options.healthMonitoring !== false) {
        await this.serverManager.startWatching();
      }

      // Start auto-start servers
      await this.serverManager.startAll();

      this.initialized = true;
      this.emit('initialized');

    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  async addServer(config: IMCPServerConfig): Promise<void> {
    return this.serverManager.addServer(config);
  }

  async removeServer(serverId: string): Promise<void> {
    return this.serverManager.removeServer(serverId);
  }

  async startServer(serverId: string): Promise<void> {
    return this.serverManager.startServer(serverId);
  }

  async stopServer(serverId: string): Promise<void> {
    return this.serverManager.stopServer(serverId);
  }

  async restartServer(serverId: string): Promise<void> {
    return this.serverManager.restartServer(serverId);
  }

  getContext(): IMCPContext {
    return this.contextAggregator.getContext();
  }

  searchContext(query: IContextQuery): IContextMatch[] {
    return this.contextAggregator.search(query);
  }

  async callTool(toolCall: IMCPToolCall): Promise<IMCPToolResult> {
    return this.serverManager.callTool(toolCall);
  }

  async readResource(request: IMCPResourceRequest): Promise<IMCPResourceContent> {
    return this.serverManager.readResource(request);
  }

  getServerStatuses() {
    return this.serverManager.getAllServerStatuses();
  }

  getConnectedServers() {
    return this.serverManager.getConnectedServers();
  }

  async getHealthReport() {
    return this.healthMonitor.generateHealthReport();
  }

  getContextSummary() {
    return this.contextAggregator.getContextSummary();
  }

  // Terminal-specific context methods
  async getRelevantContext(command: string, workingDirectory: string): Promise<{
    tools: IMCPTool[];
    resources: IMCPResource[];
    suggestions: string[];
  }> {
    const tools: IMCPTool[] = [];
    const resources: IMCPResource[] = [];
    const suggestions: string[] = [];

    // Search for relevant tools based on command
    const toolMatches = this.searchContext({
      type: 'tool',
      query: command,
      limit: 5,
    });

    tools.push(...toolMatches.map(match => match.item as IMCPTool));

    // Search for relevant resources based on working directory
    const resourceMatches = this.searchContext({
      type: 'resource',
      query: `file directory ${path.basename(workingDirectory)}`,
      limit: 10,
    });

    resources.push(...resourceMatches.map(match => match.item as IMCPResource));

    // Generate suggestions based on available context
    if (tools.length > 0) {
      suggestions.push(`Available tools: ${tools.map(t => t.name).join(', ')}`);
    }

    if (resources.length > 0) {
      suggestions.push(`Related files: ${resources.slice(0, 3).map(r => path.basename(r.uri)).join(', ')}`);
    }

    return { tools, resources, suggestions };
  }

  async destroy(): Promise<void> {
    await this.serverManager.stopAll();
    this.serverManager.destroy();
    this.healthMonitor.removeAllListeners();
    this.contextAggregator.removeAllListeners();
    this.removeAllListeners();
    this.initialized = false;
  }
}