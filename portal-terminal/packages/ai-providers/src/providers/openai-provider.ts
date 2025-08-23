import OpenAI from 'openai';
import { IAIProvider, IAIRequest, IAIResponse, IAIModelStatus, IAIModelConfig } from '../types';

export class OpenAIProvider implements IAIProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly type = 'openai';
  
  private client: OpenAI | null = null;
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
        estimatedSpeed: 50, // tokens/sec
        memoryRequirement: 100, // MB
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key required');
    }

    this.status.status = 'loading';
    const startTime = Date.now();

    try {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl,
      });

      // Test connection
      await this.client.models.list();
      
      this.status.status = 'ready';
      this.status.loadTime = Date.now() - startTime;
      
      console.log(`✅ OpenAI provider initialized in ${this.status.loadTime}ms`);
      
    } catch (error) {
      this.status.status = 'error';
      this.status.errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  async generateResponse(request: IAIRequest): Promise<IAIResponse> {
    if (!this.client || this.status.status !== 'ready') {
      throw new Error('OpenAI provider not ready');
    }

    // Check rate limits
    this.enforceRateLimit();

    this.status.status = 'busy';
    const startTime = Date.now();

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt(request.context),
        },
        {
          role: 'user',
          content: request.prompt,
        },
      ];

      const completion = await this.client.chat.completions.create({
        model: this.config.modelName || 'gpt-4o-mini',
        messages,
        max_tokens: request.maxTokens || this.config.maxTokens,
        temperature: request.temperature || 0.7,
        stream: false, // We'll add streaming later
      });

      const responseText = completion.choices[0]?.message?.content || '';
      const tokens = completion.usage?.total_tokens || 0;
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
    let systemPrompt = `You are a helpful AI assistant for terminal and development tasks.

Current context:
- Working directory: ${context.workingDirectory}
- Shell: ${context.shellType}
- Command: ${context.command}`;

    if (context.recentCommands?.length > 0) {
      systemPrompt += `\n- Recent commands: ${context.recentCommands.slice(-3).join(', ')}`;
    }

    if (context.gitContext) {
      systemPrompt += `\n- Git branch: ${context.gitContext.branch}`;
    }

    if (context.projectContext) {
      systemPrompt += `\n- Project type: ${context.projectContext.type}`;
    }

    systemPrompt += `\n\nProvide concise, actionable responses. Include code examples when helpful.`;

    return systemPrompt;
  }

  private extractSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.includes('try:') || trimmed.includes('consider:')) {
        suggestions.push(trimmed);
      }
    }
    
    return suggestions.slice(0, 3);
  }

  private extractCommands(text: string): string[] {
    const commands: string[] = [];
    
    // Extract from code blocks
    const codeBlocks = text.match(/```(?:bash|sh|shell|zsh)?\n(.*?)\n```/gs);
    if (codeBlocks) {
      for (const block of codeBlocks) {
        const command = block
          .replace(/```(?:bash|sh|shell|zsh)?\n?/g, '')
          .replace(/\n```/g, '')
          .trim();
        if (command && !command.includes('\n')) {
          commands.push(command);
        }
      }
    }

    // Extract inline commands
    const inlineCommands = text.match(/`([^`]+)`/g);
    if (inlineCommands) {
      for (const cmd of inlineCommands) {
        const command = cmd.replace(/`/g, '').trim();
        if (this.looksLikeCommand(command)) {
          commands.push(command);
        }
      }
    }
    
    return commands.slice(0, 3);
  }

  private looksLikeCommand(text: string): boolean {
    const commandPrefixes = ['git ', 'npm ', 'yarn ', 'cd ', 'ls ', 'mkdir ', 'rm ', 'cp ', 'mv ', 'chmod ', 'curl ', 'wget '];
    return commandPrefixes.some(prefix => text.toLowerCase().startsWith(prefix)) ||
           (text.length < 50 && !text.includes(' ') && !text.includes('.'));
  }

  private enforceRateLimit(): void {
    if (!this.config.rateLimit) return;

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 60000 / this.config.rateLimit.requestsPerMinute; // ms between requests

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime/1000)}s before next request.`);
    }

    this.lastRequestTime = now;
  }

  getCostEstimate(request: IAIRequest): number {
    if (!this.config.costPer1kTokens) return 0;
    
    // Estimate input + output tokens
    const inputTokens = Math.ceil(request.prompt.length / 4); // Rough estimate
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

  async destroy(): Promise<void> {
    this.client = null;
    this.status.status = 'unloaded';
  }

  // OpenAI-specific methods
  async listAvailableModels(): Promise<string[]> {
    if (!this.client) return [];
    
    try {
      const models = await this.client.models.list();
      return models.data
        .filter(model => model.id.includes('gpt'))
        .map(model => model.id)
        .sort();
    } catch {
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}