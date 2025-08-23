import { IAIProvider, IAIRequest, IAIResponse, IAIModelStatus, IAIModelConfig } from '../types';

export class QwenProvider implements IAIProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly type = 'qwen';
  
  private apiKey: string;
  private baseUrl: string;
  private status: IAIModelStatus;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(private config: IAIModelConfig) {
    this.id = config.id;
    this.name = config.name;
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://dashscope.aliyuncs.com/api/v1';
    
    this.status = {
      id: config.id,
      status: 'unloaded',
      capabilities: {
        streaming: true,
        functionCalling: true,
        codeGeneration: true,
        contextLength: config.contextLength,
        estimatedSpeed: 55, // tokens/sec
        memoryRequirement: 100, // MB
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('Qwen API key required');
    }

    this.status.status = 'loading';
    const startTime = Date.now();

    try {
      await this.testConnection();
      
      this.status.status = 'ready';
      this.status.loadTime = Date.now() - startTime;
      
      console.log(`✅ Qwen provider initialized in ${this.status.loadTime}ms`);
      
    } catch (error) {
      this.status.status = 'error';
      this.status.errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  async generateResponse(request: IAIRequest): Promise<IAIResponse> {
    if (this.status.status !== 'ready') {
      throw new Error('Qwen provider not ready');
    }

    this.enforceRateLimit();
    this.status.status = 'busy';
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(request);
      
      const response = await fetch(`${this.baseUrl}/services/aigc/text-generation/generation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.modelName || 'qwen2.5-coder-32b-instruct',
          input: {
            messages: [
              {
                role: 'system',
                content: 'You are Qwen Coder, an AI assistant specialized in programming, development, and terminal tasks. Provide practical, efficient solutions.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
          },
          parameters: {
            max_tokens: request.maxTokens || this.config.maxTokens,
            temperature: request.temperature || 0.7,
            top_p: 0.8,
            repetition_penalty: 1.05,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.output?.text) {
        throw new Error('Invalid response from Qwen API');
      }

      const responseText = data.output.text;
      const tokens = data.usage?.total_tokens || Math.ceil((request.prompt.length + responseText.length) / 4);
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

  private buildPrompt(request: IAIRequest): string {
    const { context } = request;
    
    let prompt = `Development Context:
• Command: ${context.command}
• Location: ${context.workingDirectory}
• Shell: ${context.shellType}`;

    if (context.recentCommands?.length > 0) {
      prompt += `\n• History: ${context.recentCommands.slice(-2).join(' → ')}`;
    }

    if (context.gitContext) {
      prompt += `\n• Git: ${context.gitContext.branch}`;
      if (context.gitContext.status !== 'clean') {
        prompt += ` (${context.gitContext.status})`;
      }
    }

    if (context.projectContext) {
      prompt += `\n• Stack: ${context.projectContext.type}`;
      if (context.projectContext.dependencies.length > 0) {
        const mainDeps = context.projectContext.dependencies
          .slice(0, 3)
          .map(dep => dep.split('@')[0]) // Remove version numbers
          .join(', ');
        prompt += ` (${mainDeps})`;
      }
    }

    prompt += `\n\nTask: ${request.prompt}

Please provide practical code solutions with clear explanations.`;

    return prompt;
  }

  private extractSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Look for various suggestion patterns
      if (trimmed.match(/^[\d\.]+\.\s/) || // 1. 2. 3.
          trimmed.startsWith('- ') || // Bullet points
          trimmed.startsWith('• ') || // Bullet points (Unicode)
          trimmed.startsWith('→ ') || // Arrow points
          trimmed.includes('suggest') ||
          trimmed.includes('recommend') ||
          trimmed.includes('consider') ||
          trimmed.includes('alternatively')) {
        
        const cleaned = trimmed.replace(/^[\d\.\-\•\→\s]+/, '').trim();
        if (cleaned.length > 10) {
          suggestions.push(cleaned);
        }
      }
    }
    
    return suggestions.slice(0, 4);
  }

  private extractCommands(text: string): string[] {
    const commands: string[] = [];
    
    // Extract from code blocks
    const codeBlocks = text.match(/```(?:bash|sh|shell|zsh|fish|terminal|console|cmd|powershell)?\n(.*?)\n```/gs);
    if (codeBlocks) {
      for (const block of codeBlocks) {
        const lines = block
          .replace(/```(?:bash|sh|shell|zsh|fish|terminal|console|cmd|powershell)?\n?/g, '')
          .replace(/\n```/g, '')
          .split('\n');
        
        for (const line of lines) {
          const command = line
            .replace(/^\$\s*/, '') // Remove $ prompt
            .replace(/^>\s*/, '') // Remove > prompt
            .replace(/^PS.*>\s*/, '') // Remove PowerShell prompt
            .replace(/^#.*/, '') // Remove full-line comments
            .replace(/\s+#.*/, '') // Remove end-of-line comments
            .trim();
          
          if (command && this.isValidCommand(command)) {
            commands.push(command);
          }
        }
      }
    }

    // Extract inline commands (be more selective)
    const inlineCommands = text.match(/`([^`\n]{3,80})`/g);
    if (inlineCommands) {
      for (const cmd of inlineCommands) {
        const command = cmd.replace(/`/g, '').trim();
        if (this.isValidCommand(command) && this.isProbablyCommand(command)) {
          commands.push(command);
        }
      }
    }
    
    return [...new Set(commands)].slice(0, 3);
  }

  private isValidCommand(text: string): boolean {
    if (!text || text.length > 200) return false;
    
    const commandPrefixes = [
      // Package managers
      'npm', 'yarn', 'pnpm', 'pip', 'conda', 'cargo', 'go get', 'composer',
      // Version control
      'git', 'svn', 'hg', 'bzr',
      // File operations
      'cd', 'ls', 'dir', 'pwd', 'mkdir', 'rmdir', 'rm', 'del', 'cp', 'copy', 'mv', 'move',
      // File viewing/editing
      'cat', 'less', 'more', 'head', 'tail', 'grep', 'find', 'locate',
      // Permissions
      'chmod', 'chown', 'chgrp', 'umask',
      // Network
      'curl', 'wget', 'ping', 'traceroute', 'nslookup', 'dig',
      // Remote access
      'ssh', 'scp', 'rsync', 'sftp',
      // Development tools
      'make', 'cmake', 'gcc', 'clang', 'rustc', 'javac', 'dotnet',
      // Containers & Cloud
      'docker', 'podman', 'kubectl', 'helm', 'terraform', 'ansible',
      // Process management
      'ps', 'top', 'htop', 'kill', 'killall', 'jobs', 'bg', 'fg', 'nohup',
      // System
      'systemctl', 'service', 'crontab', 'mount', 'umount', 'df', 'du'
    ];
    
    const firstWords = text.toLowerCase().split(' ').slice(0, 2).join(' ');
    return commandPrefixes.some(prefix => firstWords.startsWith(prefix));
  }

  private isProbablyCommand(text: string): boolean {
    // Additional heuristics to filter out non-commands from inline code
    return !text.includes('.com') && 
           !text.includes('http') && 
           !text.includes('@') && 
           !text.includes('function') &&
           !text.includes('const ') &&
           !text.includes('var ') &&
           !text.includes('let ') &&
           text.split(' ').length <= 8; // Commands are usually short
  }

  private enforceRateLimit(): void {
    if (!this.config.rateLimit) return;

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 60000 / this.config.rateLimit.requestsPerMinute;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      throw new Error(`Qwen rate limit exceeded. Wait ${Math.ceil(waitTime/1000)}s.`);
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

  getStatus(): IAIModelStatus {
    return { ...this.status };
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async destroy(): Promise<void> {
    this.status.status = 'unloaded';
  }

  getRequestCount(): number {
    return this.requestCount;
  }
}