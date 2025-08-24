import { TerminalManager } from './terminal-manager';
import { CommandBlock } from './command-block';
import { TerminalOptions } from './types';

export interface IMCPTerminalOptions extends TerminalOptions {
  mcpEnabled?: boolean;
}

export class MCPTerminal extends TerminalManager {
  private mcpClient: any = null;
  private mcpEnabled: boolean;

  constructor(options: IMCPTerminalOptions = {}) {
    super(options);
    this.mcpEnabled = options.mcpEnabled !== false;
    
    if (this.mcpEnabled) {
      this.initializeMCP();
    }
  }

  private async initializeMCP(): Promise<void> {
    try {
      // Dynamic import to avoid build issues
      const { MCPClient } = await import('@portal/mcp-client');
      
      this.mcpClient = new MCPClient({
        autoDiscovery: true,
        healthMonitoring: true,
      });

      this.mcpClient.on('serverConnected', (status: any) => {
        console.log(`🔗 MCP Server connected: ${status.name}`);
        this.dataCallback?.(`[MCP] Connected to ${status.name}\n`);
      });

      this.mcpClient.on('serverError', (status: any) => {
        console.warn(`❌ MCP Server error: ${status.name} - ${status.lastError}`);
      });

      await this.mcpClient.initialize();
      console.log('✅ MCP Client initialized');
      
    } catch (error) {
      console.warn('Failed to initialize MCP client:', error);
      this.mcpClient = null;
      this.mcpEnabled = false;
    }
  }

  async start(): Promise<void> {
    super.start();
    
    if (this.mcpEnabled && this.mcpClient) {
      // Add MCP context to welcome message
      const welcomeEnhancement = await this.getMCPWelcomeMessage();
      if (welcomeEnhancement) {
        setTimeout(() => {
          this.dataCallback?.(welcomeEnhancement);
        }, 1000);
      }
    }
  }

  private async getMCPWelcomeMessage(): Promise<string> {
    if (!this.mcpClient) return '';

    try {
      const context = this.mcpClient.getContext();
      const connected = context.servers?.length || 0;
      
      if (connected > 0) {
        return `[MCP] ${connected} context servers available\n`;
      }
    } catch (error) {
      console.warn('Failed to get MCP welcome message:', error);
    }
    
    return '';
  }

  async executeCommand(command: string): Promise<CommandBlock> {
    // Execute the base command
    const block = await super.executeCommand(command);
    
    // Enhance with MCP context if available
    if (this.mcpEnabled && this.mcpClient) {
      await this.enhanceBlockWithMCP(block, command);
    }
    
    return block;
  }

  private async enhanceBlockWithMCP(block: CommandBlock, command: string): Promise<void> {
    try {
      const relevantContext = await this.mcpClient.getRelevantContext(
        command,
        process.cwd()
      );

      if (relevantContext && relevantContext.suggestions.length > 0) {
        // Add MCP suggestions to the output
        const suggestions = relevantContext.suggestions.join('\n');
        this.dataCallback?.(`\n[MCP Context]\n${suggestions}\n`);
      }
    } catch (error) {
      console.warn('Failed to enhance command with MCP:', error);
    }
  }

  getMCPContext(): any {
    return this.mcpClient?.getContext() || null;
  }

  getMCPServerStatuses(): any[] {
    return this.mcpClient?.getServerStatuses() || [];
  }

  async getMCPHealthReport(): Promise<any> {
    if (!this.mcpClient) return null;
    
    const servers = this.mcpClient.getServerStatuses();
    const connected = servers.filter((s: any) => s.status === 'running').length;
    
    return {
      timestamp: new Date(),
      summary: {
        totalServers: servers.length,
        connectedServers: connected,
        healthyPercentage: servers.length > 0 ? (connected / servers.length) * 100 : 0,
      },
      servers,
    };
  }

  isMCPEnabled(): boolean {
    return this.mcpEnabled && this.mcpClient !== null;
  }

  async searchMCPContext(query: any): Promise<any[]> {
    return []; // Placeholder for context search
  }

  async callMCPTool(toolCall: any): Promise<any> {
    return {
      success: false,
      error: 'MCP tool execution not yet implemented',
    };
  }

  async readMCPResource(request: any): Promise<any> {
    throw new Error('MCP resource reading not yet implemented');
  }

  async destroy(): Promise<void> {
    if (this.mcpClient) {
      await this.mcpClient.destroy();
      this.mcpClient = null;
    }
    
    super.destroy();
  }
}