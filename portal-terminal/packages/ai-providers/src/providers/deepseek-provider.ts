import { IAIProvider, IAIRequest, IAIResponse, IAIModelStatus, IAIModelConfig } from '../types';

export class DeepSeekProvider implements IAIProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly type = 'deepseek';
  
  private apiKey: string;
  private baseUrl: string;
  private status: IAIModelStatus;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(private config: IAIModelConfig) {
    this.id = config.id;
    this.name = config.name;
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.deepseek.com/v1';
    
    this.status = {
      id: config.id,
      status: 'unloaded',
      capabilities: {
        streaming: true,
        functionCalling: false,
        codeGeneration: true,
        contextLength: config.contextLength,
        estimatedSpeed: 60, // tokens/sec - DeepSeek is quite fast
        memoryRequirement: 100, // MB
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('DeepSeek API key required');
    }

    this.status.status = 'loading';
    const startTime = Date.now();

    try {
      await this.testConnection();
      
      this.status.status = 'ready';
      this.status.loadTime = Date.now() - startTime;
      
      console.log(`✅ DeepSeek provider initialized in ${this.status.loadTime}ms`);
      
    } catch (error) {
      this.status.status = 'error';
      this.status.errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  async generateResponse(request: IAIRequest): Promise<IAIResponse> {
    if (this.status.status !== 'ready') {
      throw new Error('DeepSeek provider not ready');
    }

    this.enforceRateLimit();
    this.status.status = 'busy';
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(request);
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.modelName || 'deepseek-coder',
          messages: [
            {
              role: 'system',
              content: 'You are DeepSeek Coder, an AI assistant specialized in programming and terminal tasks. Provide clear, practical code solutions.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: request.maxTokens || this.config.maxTokens,
          temperature: request.temperature || 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from DeepSeek API');
      }

      const responseText = data.choices[0].message.content;
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
    
    let prompt = `Terminal Context:
- Command: ${context.command}
- Directory: ${context.workingDirectory}
- Shell: ${context.shellType}`;

    if (context.recentCommands?.length > 0) {
      prompt += `\n- Recent: ${context.recentCommands.slice(-2).join(', ')}`;
    }

    if (context.gitContext) {
      prompt += `\n- Git: ${context.gitContext.branch} (${context.gitContext.status})`;
    }

    if (context.projectContext) {
      prompt += `\n- Project: ${context.projectContext.type}`;
      if (context.projectContext.dependencies.length > 0) {
        prompt += ` with ${context.projectContext.dependencies.slice(0, 3).join(', ')}`;
      }
    }

    prompt += `\n\nRequest: ${request.prompt}

Provide code-focused assistance with clear examples and best practices.`;

    return prompt;
  }

  private extractSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    
    // Look for numbered lists and bullet points
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[\d\.]+\.\s/) || 
          trimmed.startsWith('- ') || 
          trimmed.startsWith('* ') ||
          trimmed.includes('💡') ||
          trimmed.includes('tip:') ||
          trimmed.includes('best practice:')) {
        suggestions.push(trimmed.replace(/^[\d\.\-\*\s💡]+/, '').trim());
      }
    }
    
    return suggestions.slice(0, 4);
  }

  private extractCommands(text: string): string[] {
    const commands: string[] = [];
    
    // Extract from code blocks with various languages
    const codeBlocks = text.match(/```(?:bash|sh|shell|zsh|fish|terminal|console|cmd)?\n(.*?)\n```/gs);
    if (codeBlocks) {
      for (const block of codeBlocks) {
        const lines = block
          .replace(/```(?:bash|sh|shell|zsh|fish|terminal|console|cmd)?\n?/g, '')
          .replace(/\n```/g, '')
          .split('\n');
        
        for (const line of lines) {
          const command = line
            .replace(/^\$\s*/, '') // Remove shell prompt
            .replace(/^>\s*/, '') // Remove Windows prompt
            .replace(/^#.*/, '') // Remove comments
            .trim();
          
          if (command && this.isValidCommand(command)) {
            commands.push(command);
          }
        }
      }
    }

    // Also look for inline code with command-like patterns
    const inlineCode = text.match(/`([^`]+)`/g);
    if (inlineCode) {
      for (const code of inlineCode) {
        const command = code.replace(/`/g, '').trim();
        if (this.isValidCommand(command) && command.length < 100) {
          commands.push(command);
        }
      }
    }
    
    return [...new Set(commands)].slice(0, 3);
  }

  private isValidCommand(text: string): boolean {
    if (!text || text.length > 300) return false;
    
    // Common development and system commands
    const commandPrefixes = [
      'git', 'npm', 'yarn', 'pnpm', 'pip', 'cargo', 'go', 'python', 'node',
      'cd', 'ls', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'chmod', 'chown',
      'curl', 'wget', 'ssh', 'scp', 'rsync', 'tar', 'zip', 'unzip',
      'docker', 'docker-compose', 'kubectl', 'helm', 'terraform',
      'aws', 'gcloud', 'az', 'heroku', 'vercel', 'netlify',
      'make', 'cmake', 'gcc', 'clang', 'rustc', 'javac',
      'ps', 'top', 'htop', 'kill', 'killall', 'systemctl', 'service'
    ];
    
    const firstWord = text.split(' ')[0].toLowerCase();
    return commandPrefixes.includes(firstWord) ||
           text.includes('./') || // Local executables
           text.includes('sudo ') ||
           (text.includes('-') && text.split(' ').length <= 5); // Commands with flags
  }

  private enforceRateLimit(): void {
    if (!this.config.rateLimit) return;

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 60000 / this.config.rateLimit.requestsPerMinute;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      throw new Error(`DeepSeek rate limit exceeded. Wait ${Math.ceil(waitTime/1000)}s.`);
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