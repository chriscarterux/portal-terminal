import { IntegratedTerminal, IIntegratedTerminalOptions, ITerminalContext } from './integrated-terminal';
import { CommandBlock } from './command-block';

export interface IPortalTerminalOptions extends IIntegratedTerminalOptions {
  enableAllFeatures?: boolean;
  aiProvider?: string;
  mcpServers?: string[];
  theme?: 'dark' | 'light' | 'auto';
}

export class PortalTerminal extends IntegratedTerminal {
  private sessionId: string;
  private startupTime: number;
  private featureStatus = {
    ai: false,
    mcp: false,
    suggestions: false,
    errorAnalysis: false,
    performance: false,
  };

  constructor(options: IPortalTerminalOptions = {}) {
    // Enable all features by default
    const enhancedOptions: IIntegratedTerminalOptions = {
      ...options,
      aiEnabled: options.enableAllFeatures !== false && options.aiEnabled !== false,
      mcpEnabled: options.enableAllFeatures !== false && options.mcpEnabled !== false,
      autoSuggestions: options.enableAllFeatures !== false && options.autoSuggestions !== false,
      errorAnalysis: options.enableAllFeatures !== false && options.errorAnalysis !== false,
      performanceMonitoring: options.enableAllFeatures !== false && options.performanceMonitoring !== false,
    };

    super(enhancedOptions);
    
    this.sessionId = `portal-${Date.now()}`;
    this.startupTime = Date.now();
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Portal Terminal...');
    
    try {
      // Start base terminal
      super.start();
      
      // Send enhanced welcome message
      await this.sendWelcomeMessage();
      
      // Start feature initialization
      await this.initializeFeatures();
      
      // Start performance monitoring
      if (this.integratedOptions.performanceMonitoring) {
        this.startPerformanceMonitoring();
      }
      
      const startupTime = Date.now() - this.startupTime;
      console.log(`✅ Portal Terminal ready in ${startupTime}ms`);
      
    } catch (error) {
      console.error('Portal Terminal startup failed:', error);
      throw error;
    }
  }

  private async sendWelcomeMessage(): Promise<void> {
    const welcomeMessage = `
╭─────────────────────────────────────────────╮
│           🌟 Portal Terminal v0.1.0         │
│                                             │
│  AI-Powered Terminal with Local Models     │
│  Model Context Protocol Integration        │
│  Cross-Platform Development Assistant      │
╰─────────────────────────────────────────────╯

`;

    this.dataCallback?.(welcomeMessage);
    
    // Add context info as it becomes available
    setTimeout(() => {
      this.dataCallback?.(`Session: ${this.sessionId}\n`);
      this.dataCallback?.(`Directory: ${this.context.workingDirectory}\n`);
      this.dataCallback?.(`Shell: ${this.context.shellType}\n`);
      
      if (this.context.projectContext) {
        this.dataCallback?.(`Project: ${this.context.projectContext.type}\n`);
      }
      
      if (this.context.gitContext) {
        this.dataCallback?.(`Git: ${this.context.gitContext.branch} (${this.context.gitContext.status})\n`);
      }
      
      this.dataCallback?.('\n');
    }, 500);
  }

  private async initializeFeatures(): Promise<void> {
    const features = [];

    // AI Integration
    if (this.integratedOptions.aiEnabled) {
      try {
        // AI initialization would happen here
        this.featureStatus.ai = true;
        features.push('🤖 AI Assistant');
      } catch (error) {
        console.warn('AI initialization failed:', error);
      }
    }

    // MCP Integration
    if (this.integratedOptions.mcpEnabled) {
      try {
        // MCP initialization would happen here
        this.featureStatus.mcp = true;
        features.push('🔗 MCP Context');
      } catch (error) {
        console.warn('MCP initialization failed:', error);
      }
    }

    // Other features
    if (this.integratedOptions.autoSuggestions) {
      this.featureStatus.suggestions = true;
      features.push('💡 Smart Suggestions');
    }

    if (this.integratedOptions.errorAnalysis) {
      this.featureStatus.errorAnalysis = true;
      features.push('🔍 Error Analysis');
    }

    if (this.integratedOptions.performanceMonitoring) {
      this.featureStatus.performance = true;
      features.push('📊 Performance Monitoring');
    }

    if (features.length > 0) {
      setTimeout(() => {
        this.dataCallback?.(`Features: ${features.join(', ')}\n\n`);
        this.dataCallback?.('Type "help" for AI assistance or start entering commands.\n\n');
        this.dataCallback?.('$ ');
      }, 1000);
    }
  }

  // Override executeCommand to add Portal-specific enhancements
  async executeCommand(command: string): Promise<CommandBlock> {
    // Handle special Portal commands
    if (await this.handleSpecialCommands(command)) {
      // Special command was handled, create a success block
      const block = new CommandBlock(command);
      block.setCompleted(0);
      return block;
    }

    // Execute through integrated terminal
    return super.executeCommand(command);
  }

  private async handleSpecialCommands(command: string): Promise<boolean> {
    const cmd = command.trim().toLowerCase();

    switch (cmd) {
      case 'help':
      case 'portal help':
        await this.showHelp();
        return true;

      case 'status':
      case 'portal status':
        await this.showStatus();
        return true;

      case 'ai':
      case 'portal ai':
        await this.showAIStatus();
        return true;

      case 'mcp':
      case 'portal mcp':
        await this.showMCPStatus();
        return true;

      case 'performance':
      case 'portal performance':
        await this.showPerformance();
        return true;

      case 'context':
      case 'portal context':
        await this.showContext();
        return true;

      default:
        return false;
    }
  }

  private async showHelp(): Promise<void> {
    const help = `
📖 Portal Terminal Help

🎯 Special Commands:
  help              - Show this help
  status            - System status overview
  ai               - AI provider status
  mcp              - MCP server status  
  performance      - Performance metrics
  context          - Current context info

🤖 AI Features:
  • Smart command suggestions
  • Error analysis and fixes
  • Context-aware assistance
  • Multi-provider selection

🔗 MCP Features:
  • Documentation access (Context7)
  • Persistent memory
  • Filesystem context
  • Git repository awareness

💡 Tips:
  • AI suggestions appear automatically
  • Use Tab for command completion
  • Errors get AI-powered analysis
  • Context adapts to your project

`;
    this.dataCallback?.(help);
  }

  private async showStatus(): Promise<void> {
    const status = await this.getSystemStatus();
    
    const statusText = `
📊 Portal Terminal Status

🖥️  Terminal: ${status.terminal.status} (${status.terminal.commands} commands)
🤖 AI: ${status.ai.enabled ? '✅ Enabled' : '❌ Disabled'} (${status.ai.suggestions} suggestions)
🔗 MCP: ${status.mcp.enabled ? '✅ Enabled' : '❌ Disabled'} (${status.mcp.servers} servers)

📈 Performance:
  • Commands: ${status.performance.commandCount}
  • Avg Response: ${status.performance.averageResponseTime}ms
  • AI Usage: ${status.performance.aiSuggestionUsage}%
  • Error Rate: ${status.performance.errorRate}%
  • Uptime: ${Math.round(status.performance.uptime / 1000)}s

📁 Context: ${status.context.projectContext?.type || 'unknown'} project
🌿 Git: ${status.context.gitContext?.branch || 'not a git repository'}

`;
    this.dataCallback?.(statusText);
  }

  private async showAIStatus(): Promise<void> {
    const aiStatus = `
🤖 AI Provider Status

${this.featureStatus.ai ? '✅ AI Assistant: Active' : '❌ AI Assistant: Disabled'}

Available Features:
  • ${this.featureStatus.suggestions ? '✅' : '❌'} Smart Suggestions
  • ${this.featureStatus.errorAnalysis ? '✅' : '❌'} Error Analysis
  • ${this.featureStatus.performance ? '✅' : '❌'} Performance Monitoring

Configured Providers:
  🏠 Local Models:
    • GPT-OSS-20B: ${this.checkModelAvailability('gpt-oss-20b')}
    • GPT-OSS-120B: ${this.checkModelAvailability('gpt-oss-120b')}
  
  🌐 External Providers:
    • OpenAI: ${process.env.OPENAI_API_KEY ? '🔑 Configured' : '❌ No API key'}
    • Claude: ${process.env.ANTHROPIC_API_KEY ? '🔑 Configured' : '❌ No API key'}
    • Gemini: ${process.env.GOOGLE_API_KEY ? '🔑 Configured' : '❌ No API key'}
    • DeepSeek: ${process.env.DEEPSEEK_API_KEY ? '🔑 Configured' : '❌ No API key'}
    • Qwen: ${process.env.QWEN_API_KEY ? '🔑 Configured' : '❌ No API key'}

`;
    this.dataCallback?.(aiStatus);
  }

  private async showMCPStatus(): Promise<void> {
    const mcpContext = await this.getMCPContext();
    
    const mcpStatus = `
🔗 Model Context Protocol Status

${this.featureStatus.mcp ? '✅ MCP Client: Active' : '❌ MCP Client: Disabled'}

Connected Servers:
${mcpContext?.servers?.map((server: any) => 
  `  • ${server.id}: ${server.status === 'running' ? '✅ Running' : '❌ ' + server.status}`
).join('\n') || '  No servers connected'}

Available Resources:
  • Tools: ${mcpContext?.tools?.length || 0}
  • Resources: ${mcpContext?.resources?.length || 0}
  • Prompts: ${mcpContext?.prompts?.length || 0}

Context Enhancement:
  📚 Documentation: ${mcpContext?.servers?.find((s: any) => s.id === 'context7') ? '✅' : '❌'}
  🧠 Memory: ${mcpContext?.servers?.find((s: any) => s.id === 'memory') ? '✅' : '❌'}
  📁 Filesystem: ${mcpContext?.servers?.find((s: any) => s.id === 'filesystem') ? '✅' : '❌'}

`;
    this.dataCallback?.(mcpStatus);
  }

  private async showPerformance(): Promise<void> {
    const metrics = this.getPerformanceMetrics();
    
    const performanceText = `
📊 Performance Metrics

⚡ Response Times:
  • Average: ${metrics.averageResponseTime}ms
  • Target: <2000ms for standard commands
  • Status: ${metrics.averageResponseTime < 2000 ? '✅ Good' : '⚠️ Slow'}

🎯 Success Rate:
  • Commands: ${metrics.commandCount}
  • Errors: ${(metrics.errorRate)}%
  • Status: ${metrics.errorRate < 5 ? '✅ Excellent' : metrics.errorRate < 15 ? '⚠️ Fair' : '❌ Poor'}

🤖 AI Usage:
  • Suggestions: ${metrics.aiSuggestionUsage}%
  • Status: ${metrics.aiSuggestionUsage > 0 ? '✅ Active' : '⚠️ Unused'}

⏱️  System:
  • Uptime: ${Math.round(metrics.uptime / 1000)}s
  • Memory: ${this.getMemoryUsage()}MB

`;
    this.dataCallback?.(performanceText);
  }

  private async showContext(): Promise<void> {
    const context = this.getTerminalContext();
    
    const contextText = `
📁 Current Context

🖥️  Environment:
  • Directory: ${context.workingDirectory}
  • Shell: ${context.shellType}
  • Recent: ${context.recentCommands.slice(-3).join(' → ') || 'none'}

${context.projectContext ? `
📦 Project:
  • Type: ${context.projectContext.type}
  • Dependencies: ${context.projectContext.dependencies.slice(0, 5).join(', ')}
  • Structure: ${context.projectContext.structure.slice(0, 5).join(', ')}
` : ''}

${context.gitContext ? `
🌿 Git Repository:
  • Branch: ${context.gitContext.branch}
  • Status: ${context.gitContext.status}
  • Remotes: ${context.gitContext.remotes.join(', ')}
` : ''}

${context.mcpContext ? `
🔗 MCP Context:
  • Servers: ${context.mcpContext.servers?.length || 0} connected
  • Tools: ${context.mcpContext.tools?.length || 0} available
  • Resources: ${context.mcpContext.resources?.length || 0} accessible
` : ''}

`;
    this.dataCallback?.(contextText);
  }

  private checkModelAvailability(modelId: string): string {
    // Mock model availability check
    return modelId.includes('20b') ? '📥 Download required' : '📥 Download required';
  }

  private getMemoryUsage(): number {
    try {
      const used = process.memoryUsage();
      return Math.round(used.heapUsed / 1024 / 1024);
    } catch {
      return 0;
    }
  }

  // Portal-specific command enhancement
  async executePortalCommand(command: string): Promise<{
    block: CommandBlock;
    aiEnhancement?: {
      suggestion: string;
      explanation: string;
      alternatives: string[];
    };
    mcpEnhancement?: {
      relevantTools: any[];
      relevantResources: any[];
      contextSuggestions: string[];
    };
    performanceData?: {
      responseTime: number;
      aiTime?: number;
      mcpTime?: number;
    };
  }> {
    const startTime = Date.now();
    const result: any = { performanceData: { responseTime: 0 } };

    try {
      // Get AI enhancement
      if (this.featureStatus.ai) {
        const aiStart = Date.now();
        try {
          const suggestion = await this.getAISuggestion(command);
          result.aiEnhancement = {
            suggestion,
            explanation: `AI analysis for: ${command}`,
            alternatives: [`${command} --help`, `man ${command.split(' ')[0]}`],
          };
          result.performanceData.aiTime = Date.now() - aiStart;
        } catch (error) {
          console.warn('AI enhancement failed:', error);
        }
      }

      // Get MCP enhancement
      if (this.featureStatus.mcp) {
        const mcpStart = Date.now();
        try {
          const mcpContext = await this.getMCPContext();
          const relevantContext = await this.searchMCPContext(command);
          
          result.mcpEnhancement = {
            relevantTools: relevantContext.filter((item: any) => item.type === 'tool').slice(0, 3),
            relevantResources: relevantContext.filter((item: any) => item.type === 'resource').slice(0, 3),
            contextSuggestions: ['Context available from connected MCP servers'],
          };
          result.performanceData.mcpTime = Date.now() - mcpStart;
        } catch (error) {
          console.warn('MCP enhancement failed:', error);
        }
      }

      // Execute the actual command
      result.block = await this.executeEnhancedCommand(command, {
        aiSuggestions: this.featureStatus.suggestions,
        mcpContext: this.featureStatus.mcp,
        errorAnalysis: this.featureStatus.errorAnalysis,
      });

      result.performanceData.responseTime = Date.now() - startTime;

      return result;

    } catch (error) {
      // Create error block for failed execution
      result.block = new CommandBlock(command);
      result.block.addOutput(`Error: ${error}\n`);
      result.block.setCompleted(1);
      
      result.performanceData.responseTime = Date.now() - startTime;
      
      return result;
    }
  }

  // Portal Terminal health check
  async getPortalStatus(): Promise<{
    session: {
      id: string;
      uptime: number;
      commands: number;
    };
    features: {
      ai: boolean;
      mcp: boolean;
      suggestions: boolean;
      errorAnalysis: boolean;
      performance: boolean;
    };
    health: {
      overall: 'healthy' | 'degraded' | 'unhealthy';
      components: any;
      metrics: any;
    };
    context: ITerminalContext;
  }> {
    const health = await this.healthCheck();
    const metrics = this.getPerformanceMetrics();

    return {
      session: {
        id: this.sessionId,
        uptime: Date.now() - this.startupTime,
        commands: metrics.commandCount,
      },
      features: this.featureStatus,
      health,
      context: this.getTerminalContext(),
    };
  }

  // Get comprehensive system info for debugging
  async getSystemInfo(): Promise<{
    version: string;
    platform: string;
    architecture: string;
    nodeVersion: string;
    electronVersion?: string;
    features: any;
    providers: any;
    performance: any;
  }> {
    const os = require('os');
    
    return {
      version: '0.1.0',
      platform: os.platform(),
      architecture: os.arch(),
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      features: this.featureStatus,
      providers: {
        ai: this.aiClient ? 'initialized' : 'disabled',
        mcp: this.mcpClient ? 'initialized' : 'disabled',
      },
      performance: this.getPerformanceMetrics(),
    };
  }

  // Portal Terminal specific destroy
  async destroy(): Promise<void> {
    console.log('🔄 Shutting down Portal Terminal...');
    
    try {
      // Save session data if needed
      const finalStatus = await this.getPortalStatus();
      console.log(`Session ${this.sessionId}: ${finalStatus.session.commands} commands executed`);
      
      // Cleanup integrations
      await super.destroy();
      
      console.log('✅ Portal Terminal shutdown complete');
      
    } catch (error) {
      console.warn('Shutdown error:', error);
    }
  }
}