import Anthropic from '@anthropic-ai/sdk';
import { IAIProvider, IAIRequest, IAIResponse, IAIModelStatus, IAIModelConfig } from '../types';

export class ClaudeProvider implements IAIProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly type = 'anthropic';
  
  private client: Anthropic | null = null;
  private status: IAIModelStatus;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(private config: IAIModelConfig) {
    this.id = config.id;
    this.name = config.name;
    
    this.status = {
      id: config.id,
      status: 'unloaded',
      capabilities: {
        streaming: true,
        functionCalling: true,
        codeGeneration: true,
        contextLength: config.contextLength,
        estimatedSpeed: 45, // tokens/sec
        memoryRequirement: 100, // MB
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key required');
    }

    this.status.status = 'loading';
    const startTime = Date.now();

    try {
      this.client = new Anthropic({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl,
      });

      // Test connection with a minimal request
      await this.testConnection();
      
      this.status.status = 'ready';
      this.status.loadTime = Date.now() - startTime;
      
      console.log(`✅ Claude provider initialized in ${this.status.loadTime}ms`);
      
    } catch (error) {
      this.status.status = 'error';
      this.status.errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  async generateResponse(request: IAIRequest): Promise<IAIResponse> {
    if (!this.client || this.status.status !== 'ready') {
      throw new Error('Claude provider not ready');
    }

    this.enforceRateLimit();
    this.status.status = 'busy';
    const startTime = Date.now();

    try {
      const systemPrompt = this.buildSystemPrompt(request.context);
      
      const response = await this.client.messages.create({
        model: this.config.modelName || 'claude-3-5-sonnet-20241022',
        max_tokens: request.maxTokens || this.config.maxTokens,
        temperature: request.temperature || 0.7,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
      });

      const responseText = response.content[0]?.type === 'text' 
        ? response.content[0].text 
        : '';
      
      const tokens = response.usage.input_tokens + response.usage.output_tokens;
      const responseTime = Date.now() - startTime;

      this.status.status = 'ready';
      this.status.lastUsed = new Date();
      this.requestCount++;

      return {
        text: responseText,
        model: this.id,
        tokens,
        responseTime,
        cached: false,
        suggestions: this.extractSuggestions(responseText),
        commands: this.extractCommands(responseText),
      };

    } catch (error) {
      this.status.status = 'error';
      this.status.errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private buildSystemPrompt(context: any): string {
    let systemPrompt = `You are Claude, an AI assistant specialized in helping with terminal commands and development tasks.

You have access to the following context:
- Working directory: ${context.workingDirectory}
- Shell: ${context.shellType}
- Current command: ${context.command}`;

    if (context.recentCommands?.length > 0) {
      systemPrompt += `\n- Recent commands: ${context.recentCommands.slice(-3).join(', ')}`;
    }

    if (context.gitContext) {
      systemPrompt += `\n- Git context: Branch "${context.gitContext.branch}", Status: ${context.gitContext.status}`;
    }

    if (context.projectContext) {
      systemPrompt += `\n- Project: ${context.projectContext.type} with dependencies: ${context.projectContext.dependencies.slice(0, 3).join(', ')}`;
    }

    if (context.mcpContext) {
      systemPrompt += `\n- Enhanced context: Available through Model Context Protocol servers`;
    }

    systemPrompt += `

Guidelines:
1. Provide practical, actionable advice
2. Include code examples when helpful
3. Warn about potentially dangerous operations
4. Suggest alternatives when appropriate
5. Keep responses concise but comprehensive
6. Format code blocks with proper syntax highlighting`;

    return systemPrompt;
  }

  private extractSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[\d\.]+\.\s/) || // Numbered list
          trimmed.startsWith('- ') || // Bullet point
          trimmed.includes('try:') || 
          trimmed.includes('consider:') ||
          trimmed.includes('alternatively:')) {
        suggestions.push(trimmed);
      }
    }
    
    return suggestions.slice(0, 5);
  }

  private extractCommands(text: string): string[] {
    const commands: string[] = [];
    
    // Extract from code blocks with shell indicators
    const codeBlocks = text.match(/```(?:bash|sh|shell|zsh|fish)?\n(.*?)\n```/gs);
    if (codeBlocks) {
      for (const block of codeBlocks) {
        const lines = block
          .replace(/```(?:bash|sh|shell|zsh|fish)?\n?/g, '')
          .replace(/\n```/g, '')
          .split('\n');
        
        for (const line of lines) {
          const command = line.replace(/^\$\s*/, '').trim(); // Remove $ prompt
          if (command && this.isValidCommand(command)) {
            commands.push(command);
          }
        }
      }
    }

    // Extract inline commands
    const inlineCommands = text.match(/`([^`]+)`/g);
    if (inlineCommands) {
      for (const cmd of inlineCommands) {
        const command = cmd.replace(/`/g, '').trim();
        if (this.isValidCommand(command)) {
          commands.push(command);
        }
      }
    }
    
    return [...new Set(commands)].slice(0, 3); // Remove duplicates, limit to 3
  }

  private isValidCommand(text: string): boolean {
    // Validate that text looks like a terminal command
    const commandPrefixes = [
      'git', 'npm', 'yarn', 'pnpm', 'cd', 'ls', 'mkdir', 'rm', 'cp', 'mv', 
      'chmod', 'chown', 'curl', 'wget', 'ssh', 'scp', 'rsync', 'find', 'grep',
      'awk', 'sed', 'cat', 'less', 'head', 'tail', 'sort', 'uniq', 'wc',
      'ps', 'top', 'kill', 'killall', 'jobs', 'nohup', 'screen', 'tmux',
      'docker', 'kubectl', 'helm', 'terraform', 'ansible', 'make', 'cmake'
    ];
    
    const firstWord = text.split(' ')[0].toLowerCase();
    return commandPrefixes.includes(firstWord) ||
           (text.length < 100 && text.includes('-') && !text.includes('.com'));
  }

  private enforceRateLimit(): void {
    if (!this.config.rateLimit) return;

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 60000 / this.config.rateLimit.requestsPerMinute;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      throw new Error(`Claude rate limit exceeded. Wait ${Math.ceil(waitTime/1000)}s.`);
    }

    this.lastRequestTime = now;
  }

  getCostEstimate(request: IAIRequest): number {
    if (!this.config.costPer1kTokens) return 0;
    
    const inputTokens = Math.ceil(request.prompt.length / 4);
    const outputTokens = request.maxTokens || 256;
    const totalTokens = inputTokens + outputTokens;
    
    return (totalTokens / 1000) * this.config.costPer1kTokens;
  }

  getRateLimit(): { requestsPerMinute: number; tokensPerMinute: number } | null {
    return this.config.rateLimit || null;
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      // Test with minimal request
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307', // Fastest model for testing
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      console.warn('Claude connection test failed:', error);
      return false;
    }
  }

  getRequestCount(): number {
    return this.requestCount;
  }
}