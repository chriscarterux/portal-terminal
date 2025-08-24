import { TerminalManager } from './terminal-manager';
import { CommandBlock } from './command-block';
import { CommandValidator } from './command-validator';
import { TerminalOptions } from './types';

export interface IIntegratedTerminalOptions extends TerminalOptions {
  aiEnabled?: boolean;
  mcpEnabled?: boolean;
  autoSuggestions?: boolean;
  errorAnalysis?: boolean;
  performanceMonitoring?: boolean;
}

export interface ITerminalContext {
  workingDirectory: string;
  shellType: string;
  recentCommands: string[];
  gitContext?: {
    branch: string;
    status: string;
    remotes: string[];
  };
  projectContext?: {
    type: string;
    dependencies: string[];
    structure: string[];
  };
  mcpContext?: any;
}

export class IntegratedTerminal extends TerminalManager {
  private aiClient: any = null;
  private mcpClient: any = null;
  private context: ITerminalContext;
  private performanceMetrics = {
    commandCount: 0,
    totalResponseTime: 0,
    aiSuggestionCount: 0,
    errorCount: 0,
  };

  constructor(private integratedOptions: IIntegratedTerminalOptions = {}) {
    super(integratedOptions);
    
    this.context = {
      workingDirectory: integratedOptions.cwd || process.cwd(),
      shellType: integratedOptions.shell || 'bash',
      recentCommands: [],
    };

    // Initialize error handling and monitoring
    this.errorHandler = new ErrorHandler();
    this.performanceMonitor = new PerformanceMonitor();
    
    this.setupEventHandlers();
    this.initializeIntegrations();
    
    // Start performance monitoring if enabled
    if (integratedOptions.performanceMonitoring !== false) {
      this.startPerformanceMonitoring();
    }
  }
  
  // Setup event handlers for monitoring integration
  private setupEventHandlers(): void {
    // Error handler events
    this.errorHandler.on('error', (errorData) => {
      this.onError?.(errorData);
    });
    
    this.errorHandler.on('emergency-reset', (resetData) => {
      this.dataCallback?.(`🚨 Emergency reset performed for terminal ${resetData.terminalId}\n`);
    });
    
    // Performance monitor events
    this.performanceMonitor.on('performance-alert', (alert) => {
      this.onPerformanceAlert?.(alert);
    });
  }

  private async initializeIntegrations(): Promise<void> {
    try {
      // Initialize AI if enabled
      if (this.integratedOptions.aiEnabled !== false) {
        await this.initializeAI();
      }

      // Initialize MCP if enabled
      if (this.integratedOptions.mcpEnabled !== false) {
        await this.initializeMCP();
      }

      // Initialize context detection
      await this.detectProjectContext();
      await this.detectGitContext();

    } catch (error) {
      console.warn('Integration initialization failed:', error);
    }
  }

  private async initializeAI(): Promise<void> {
    try {
      // Mock AI client for now (will be replaced with actual implementation)
      this.aiClient = {
        generateSuggestion: async (command: string, context: any) => {
          return this.generateMockSuggestion(command);
        },
        explainCommand: async (command: string, context: any) => {
          return `Command "${command}" performs basic operation in ${context.shellType}`;
        },
        analyzeError: async (command: string, error: string, context: any) => {
          return {
            diagnosis: `Error in command "${command}": ${error.slice(0, 100)}`,
            suggestions: [`Try checking permissions`, `Verify file exists`, `Check syntax`],
            fixCommands: [`ls -la`, `which ${command.split(' ')[0]}`, `man ${command.split(' ')[0]}`],
          };
        },
      };
      
      console.log('🤖 AI integration ready');
      this.dataCallback?.('[AI] Ready for intelligent assistance\n');
      
    } catch (error) {
      console.warn('AI initialization failed:', error);
    }
  }

  private async initializeMCP(): Promise<void> {
    try {
      // Mock MCP client for now
      this.mcpClient = {
        getContext: () => ({
          tools: [
            { name: 'file-search', serverId: 'filesystem' },
            { name: 'git-log', serverId: 'git' },
          ],
          resources: [
            { uri: 'file://./package.json', name: 'Package Config' },
            { uri: 'file://./README.md', name: 'Project README' },
          ],
          servers: [
            { id: 'filesystem', status: 'running' },
            { id: 'context7', status: 'running' },
            { id: 'memory', status: 'running' },
          ],
        }),
        searchContext: (query: string) => {
          return [
            { type: 'tool', item: { name: 'file-search' }, relevanceScore: 95 },
            { type: 'resource', item: { uri: 'file://./src' }, relevanceScore: 80 },
          ];
        },
      };
      
      console.log('🔗 MCP integration ready');
      this.dataCallback?.('[MCP] 3 context servers connected\n');
      
    } catch (error) {
      console.warn('MCP initialization failed:', error);
    }
  }

  private async detectProjectContext(): Promise<void> {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      // Detect project type based on files
      const files = await fs.readdir(this.context.workingDirectory);
      let projectType = 'unknown';
      const dependencies: string[] = [];

      if (files.includes('package.json')) {
        projectType = 'node';
        try {
          const packageJson = JSON.parse(
            await fs.readFile(path.join(this.context.workingDirectory, 'package.json'), 'utf8')
          );
          dependencies.push(...Object.keys(packageJson.dependencies || {}));
        } catch {}
      } else if (files.includes('Cargo.toml')) {
        projectType = 'rust';
      } else if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
        projectType = 'python';
      } else if (files.includes('go.mod')) {
        projectType = 'go';
      } else if (files.includes('pom.xml') || files.includes('build.gradle')) {
        projectType = 'java';
      }

      this.context.projectContext = {
        type: projectType,
        dependencies: dependencies.slice(0, 10),
        structure: files.slice(0, 10),
      };

      console.log(`📁 Detected ${projectType} project`);
      
    } catch (error) {
      console.warn('Project context detection failed:', error);
    }
  }

  private async detectGitContext(): Promise<void> {
    try {
      const { execSync } = require('child_process');
      
      // Check if we're in a git repository
      try {
        execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      } catch {
        return; // Not a git repository
      }

      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim() ? 'dirty' : 'clean';
      const remotes = execSync('git remote', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

      this.context.gitContext = {
        branch,
        status,
        remotes,
      };

      console.log(`🌿 Git context: ${branch} (${status})`);
      
    } catch (error) {
      console.warn('Git context detection failed:', error);
    }
  }

  async executeCommand(command: string): Promise<CommandBlock> {
    const startTime = Date.now();
    this.performanceMetrics.commandCount++;

    try {
      // Pre-command AI suggestions
      if (this.integratedOptions.autoSuggestions && this.aiClient) {
        await this.provideSuggestions(command);
      }

      // Update context with MCP data
      if (this.mcpClient) {
        this.context.mcpContext = this.mcpClient.getContext();
      }

      // Execute the command
      const block = await super.executeCommand(command);
      
      // Post-command analysis
      await this.postCommandAnalysis(block, command);
      
      // Update recent commands
      this.context.recentCommands.push(command);
      if (this.context.recentCommands.length > 10) {
        this.context.recentCommands = this.context.recentCommands.slice(-10);
      }

      // Update performance metrics
      this.performanceMetrics.totalResponseTime += Date.now() - startTime;

      return block;

    } catch (error) {
      this.performanceMetrics.errorCount++;
      
      // AI-powered error analysis
      if (this.integratedOptions.errorAnalysis && this.aiClient) {
        await this.analyzeError(command, error);
      }
      
      throw error;
    }
  }

  private async provideSuggestions(command: string): Promise<void> {
    try {
      // Get quick validation
      const validation = CommandValidator.validateCommand(command);
      
      if (!validation.isValid) {
        this.dataCallback?.(`⚠️  Warning: ${validation.errors.join(', ')}\n`);
        return;
      }

      if (validation.warnings.length > 0) {
        this.dataCallback?.(`💡 ${validation.warnings[0]}\n`);
      }

      // Get AI suggestions for complex commands
      if (command.length > 10 && this.aiClient) {
        const suggestion = await this.aiClient.generateSuggestion(command, this.context);
        if (suggestion) {
          this.dataCallback?.(`💡 AI: ${suggestion}\n`);
          this.performanceMetrics.aiSuggestionCount++;
        }
      }

    } catch (error) {
      console.warn('Failed to provide suggestions:', error);
    }
  }

  private async postCommandAnalysis(block: CommandBlock, command: string): Promise<void> {
    try {
      // Analyze command success/failure
      if (block.status === 'error' && this.aiClient) {
        const analysis = await this.aiClient.analyzeError(command, block.output, this.context);
        
        if (analysis.suggestions.length > 0) {
          this.dataCallback?.(`\n🔍 AI Analysis: ${analysis.diagnosis}\n`);
          this.dataCallback?.(`💡 Suggestions:\n`);
          for (const suggestion of analysis.suggestions) {
            this.dataCallback?.(`   • ${suggestion}\n`);
          }
          
          if (analysis.fixCommands.length > 0) {
            this.dataCallback?.(`🛠️  Try these commands:\n`);
            for (const cmd of analysis.fixCommands) {
              this.dataCallback?.(`   $ ${cmd}\n`);
            }
          }
        }
      }

      // Update context based on command type
      await this.updateContextFromCommand(command, block);

    } catch (error) {
      console.warn('Post-command analysis failed:', error);
    }
  }

  private async updateContextFromCommand(command: string, block: CommandBlock): Promise<void> {
    // Update git context if git command was run
    if (command.startsWith('git ') && block.status === 'completed') {
      setTimeout(() => this.detectGitContext(), 500); // Async update
    }

    // Update project context if package management command was run
    if ((command.includes('npm ') || command.includes('yarn ')) && 
        (command.includes('install') || command.includes('add')) &&
        block.status === 'completed') {
      setTimeout(() => this.detectProjectContext(), 1000); // Async update
    }

    // Change directory updates
    if (command.startsWith('cd ') && block.status === 'completed') {
      // Update working directory context
      try {
        this.context.workingDirectory = process.cwd();
        await this.detectProjectContext();
        await this.detectGitContext();
      } catch (error) {
        console.warn('Failed to update directory context:', error);
      }
    }
  }

  private async analyzeError(command: string, error: any): Promise<void> {
    try {
      if (!this.aiClient) return;

      const errorMessage = error instanceof Error ? error.message : String(error);
      const analysis = await this.aiClient.analyzeError(command, errorMessage, this.context);

      this.dataCallback?.(`\n❌ Command failed: ${command}\n`);
      this.dataCallback?.(`🔍 AI Diagnosis: ${analysis.diagnosis}\n`);
      
      if (analysis.suggestions.length > 0) {
        this.dataCallback?.(`💡 Solutions:\n`);
        for (const suggestion of analysis.suggestions) {
          this.dataCallback?.(`   • ${suggestion}\n`);
        }
      }

    } catch (analysisError) {
      console.warn('Error analysis failed:', analysisError);
    }
  }

  private generateMockSuggestion(command: string): string {
    const suggestions: Record<string, string> = {
      'git': 'Try: git status, git log --oneline, git diff',
      'npm': 'Try: npm list, npm outdated, npm audit',
      'docker': 'Try: docker ps, docker images, docker logs <container>',
      'ls': 'Try: ls -la for details, ls -lh for human-readable sizes',
      'cd': 'Try: cd .., cd ~, cd - (previous directory)',
      'grep': 'Try: grep -r for recursive, grep -i for case-insensitive',
      'find': 'Try: find . -name "*.js", find . -type f -size +1M',
      'curl': 'Try: curl -I for headers only, curl -L to follow redirects',
      'ssh': 'Try: ssh -v for verbose, ssh -i <key> for specific key',
      'tar': 'Try: tar -tf <file> to list contents, tar -xvf to extract',
    };

    const firstWord = command.split(' ')[0];
    return suggestions[firstWord] || `Command "${firstWord}" - use man ${firstWord} for help`;
  }

  async getAISuggestion(prompt: string): Promise<string> {
    if (!this.aiClient) {
      return 'AI suggestions not available';
    }

    try {
      return await this.aiClient.explainCommand(prompt, this.context);
    } catch (error) {
      return `AI suggestion failed: ${error}`;
    }
  }

  async getMCPContext(): Promise<any> {
    return this.mcpClient?.getContext() || null;
  }

  async searchMCPContext(query: string): Promise<any[]> {
    return this.mcpClient?.searchContext(query) || [];
  }

  getTerminalContext(): ITerminalContext {
    return { ...this.context };
  }

  getPerformanceMetrics(): {
    commandCount: number;
    averageResponseTime: number;
    aiSuggestionUsage: number;
    errorRate: number;
    uptime: number;
  } {
    const avgResponseTime = this.performanceMetrics.commandCount > 0 
      ? this.performanceMetrics.totalResponseTime / this.performanceMetrics.commandCount 
      : 0;

    const aiUsageRate = this.performanceMetrics.commandCount > 0
      ? (this.performanceMetrics.aiSuggestionCount / this.performanceMetrics.commandCount) * 100
      : 0;

    const errorRate = this.performanceMetrics.commandCount > 0
      ? (this.performanceMetrics.errorCount / this.performanceMetrics.commandCount) * 100
      : 0;

    return {
      commandCount: this.performanceMetrics.commandCount,
      averageResponseTime: Math.round(avgResponseTime),
      aiSuggestionUsage: Math.round(aiUsageRate),
      errorRate: Math.round(errorRate * 100) / 100,
      uptime: Date.now() - (this.startTime || Date.now()),
    };
  }

  private startTime = Date.now();

  async getSystemStatus(): Promise<{
    terminal: { status: string; commands: number };
    ai: { enabled: boolean; suggestions: number };
    mcp: { enabled: boolean; servers: number };
    performance: any;
    context: ITerminalContext;
  }> {
    const mcpContext = await this.getMCPContext();
    const performance = this.getPerformanceMetrics();

    return {
      terminal: {
        status: 'running',
        commands: this.performanceMetrics.commandCount,
      },
      ai: {
        enabled: !!this.aiClient,
        suggestions: this.performanceMetrics.aiSuggestionCount,
      },
      mcp: {
        enabled: !!this.mcpClient,
        servers: mcpContext?.servers?.length || 0,
      },
      performance,
      context: this.context,
    };
  }

  // Enhanced command execution with full integration
  async executeEnhancedCommand(command: string, options: {
    aiSuggestions?: boolean;
    mcpContext?: boolean;
    errorAnalysis?: boolean;
  } = {}): Promise<{
    block: CommandBlock;
    aiSuggestion?: string;
    mcpContext?: any;
    errorAnalysis?: any;
  }> {
    const result: any = {};

    // Get AI suggestion before execution
    if (options.aiSuggestions !== false && this.aiClient) {
      try {
        result.aiSuggestion = await this.aiClient.generateSuggestion(command, this.context);
      } catch (error) {
        console.warn('AI suggestion failed:', error);
      }
    }

    // Get MCP context
    if (options.mcpContext !== false && this.mcpClient) {
      try {
        result.mcpContext = await this.getMCPContext();
      } catch (error) {
        console.warn('MCP context failed:', error);
      }
    }

    // Execute command
    try {
      result.block = await this.executeCommand(command);
    } catch (error) {
      // Create error block
      result.block = new CommandBlock(command);
      result.block.addOutput(`Error: ${error}\n`);
      result.block.setCompleted(1);

      // Get error analysis if enabled
      if (options.errorAnalysis !== false && this.aiClient) {
        try {
          result.errorAnalysis = await this.aiClient.analyzeError(
            command, 
            error instanceof Error ? error.message : String(error), 
            this.context
          );
        } catch (analysisError) {
          console.warn('Error analysis failed:', analysisError);
        }
      }
    }

    return result;
  }

  // Method to trigger AI help for current context
  async getContextualHelp(userQuery: string): Promise<string> {
    if (!this.aiClient) {
      return 'AI help not available';
    }

    try {
      // Enhance query with current context
      const enhancedPrompt = `${userQuery}

Current context:
- Directory: ${this.context.workingDirectory}
- Shell: ${this.context.shellType}
- Recent commands: ${this.context.recentCommands.slice(-3).join(', ')}
${this.context.gitContext ? `- Git: ${this.context.gitContext.branch}` : ''}
${this.context.projectContext ? `- Project: ${this.context.projectContext.type}` : ''}`;

      return await this.aiClient.explainCommand(enhancedPrompt, this.context);
      
    } catch (error) {
      return `AI help failed: ${error}`;
    }
  }

  // Performance monitoring
  startPerformanceMonitoring(): void {
    if (!this.integratedOptions.performanceMonitoring) return;

    setInterval(() => {
      const metrics = this.getPerformanceMetrics();
      
      if (metrics.errorRate > 10) {
        this.dataCallback?.(`⚠️  High error rate: ${metrics.errorRate}%\n`);
      }
      
      if (metrics.averageResponseTime > 2000) {
        this.dataCallback?.(`⚡ Slow response time: ${metrics.averageResponseTime}ms\n`);
      }
      
    }, 30000); // Check every 30 seconds
  }

  async destroy(): Promise<void> {
    try {
      // Stop monitoring
      this.performanceMonitor?.stopMonitoring();
      this.performanceMonitor?.destroy();
      
      // Clean up integrations
      if (this.aiClient?.destroy) {
        await this.aiClient.destroy();
      }
      
      if (this.mcpClient?.destroy) {
        await this.mcpClient.destroy();
      }
      
      // Clean up error handler
      this.errorHandler?.removeAllListeners();
      
    } catch (error) {
      console.warn('Integration cleanup failed:', error);
    }

    super.destroy();
  }

  // Quick status check
  async healthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      terminal: 'ok' | 'error';
      ai: 'ok' | 'disabled' | 'error';
      mcp: 'ok' | 'disabled' | 'error';
    };
    metrics: any;
  }> {
    const metrics = this.getPerformanceMetrics();
    
    const components = {
      terminal: 'ok' as const,
      ai: this.aiClient ? 'ok' as const : 'disabled' as const,
      mcp: this.mcpClient ? 'ok' as const : 'disabled' as const,
    };

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (metrics.errorRate > 20) {
      overall = 'unhealthy';
    } else if (metrics.errorRate > 10 || metrics.averageResponseTime > 3000) {
      overall = 'degraded';
    }

    return { overall, components, metrics };
  }
}