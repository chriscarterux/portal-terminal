import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { IAIProvider, IAIRequest, IAIResponse, IAIModelStatus, IAIModelConfig } from './types';

export class ExternalProvider implements IAIProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly type: string;
  
  private client: OpenAI | Anthropic | null = null;
  private status: IAIModelStatus;

  constructor(private config: IAIModelConfig) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    
    this.status = {
      id: config.id,
      status: 'unloaded',
      capabilities: {
        streaming: true,
        functionCalling: config.type === 'openai' || config.type === 'anthropic',
        codeGeneration: true,
        contextLength: config.contextLength,
        estimatedSpeed: 50, // tokens/sec for external APIs
        memoryRequirement: 100, // Minimal local memory
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error(`API key required for ${this.config.name}`);
    }

    this.status.status = 'loading';
    const startTime = Date.now();

    try {
      switch (this.config.type) {
        case 'openai':
          this.client = new OpenAI({
            apiKey: this.config.apiKey,
            baseURL: this.config.baseUrl,
          });
          break;
          
        case 'anthropic':
          this.client = new Anthropic({
            apiKey: this.config.apiKey,
            baseURL: this.config.baseUrl,
          });
          break;
          
        default:
          throw new Error(`External provider ${this.config.type} not yet implemented`);
      }

      // Test connection with a simple request
      await this.testConnection();
      
      this.status.status = 'ready';
      this.status.loadTime = Date.now() - startTime;
      
      console.log(`✅ ${this.config.name} initialized in ${this.status.loadTime}ms`);
      
    } catch (error) {
      this.status.status = 'error';
      this.status.errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    try {
      switch (this.config.type) {
        case 'openai':
          await (this.client as OpenAI).models.list();
          break;
        case 'anthropic':
          // Anthropic doesn't have a simple test endpoint, so we'll skip
          break;
      }
    } catch (error) {
      throw new Error(`Connection test failed: ${error}`);
    }
  }

  async generateResponse(request: IAIRequest): Promise<IAIResponse> {
    if (!this.client || this.status.status !== 'ready') {
      throw new Error(`Provider ${this.id} not ready`);
    }

    this.status.status = 'busy';
    const startTime = Date.now();

    try {
      let responseText = '';
      let tokens = 0;

      switch (this.config.type) {
        case 'openai':
          const openaiResponse = await (this.client as OpenAI).chat.completions.create({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: 'You are an AI assistant helping with terminal commands and development tasks. Provide concise, actionable responses.',
              },
              {
                role: 'user',
                content: this.buildPrompt(request),
              },
            ],
            max_tokens: request.maxTokens || this.config.maxTokens,
            temperature: request.temperature || 0.7,
          });
          
          responseText = openaiResponse.choices[0]?.message?.content || '';
          tokens = openaiResponse.usage?.total_tokens || 0;
          break;

        case 'anthropic':
          const claudeResponse = await (this.client as Anthropic).messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: request.maxTokens || this.config.maxTokens,
            temperature: request.temperature || 0.7,
            system: 'You are an AI assistant helping with terminal commands and development tasks. Provide concise, actionable responses.',
            messages: [
              {
                role: 'user',
                content: this.buildPrompt(request),
              },
            ],
          });
          
          responseText = claudeResponse.content[0]?.type === 'text' 
            ? claudeResponse.content[0].text 
            : '';
          tokens = claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens;
          break;

        default:
          throw new Error(`Provider ${this.config.type} not implemented`);
      }

      const responseTime = Date.now() - startTime;
      this.status.status = 'ready';
      this.status.lastUsed = new Date();

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
    
    let prompt = `Command: ${context.command}
Working Directory: ${context.workingDirectory}
Shell: ${context.shellType}`;

    if (context.recentCommands.length > 0) {
      prompt += `\nRecent Commands: ${context.recentCommands.slice(-3).join(', ')}`;
    }

    if (context.gitContext) {
      prompt += `\nGit Branch: ${context.gitContext.branch}`;
    }

    if (context.projectContext) {
      prompt += `\nProject Type: ${context.projectContext.type}`;
    }

    prompt += `\n\nUser Request: ${request.prompt}`;

    return prompt;
  }

  private extractSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.includes('try:') || line.includes('consider:') || line.includes('suggestion:')) {
        suggestions.push(line.trim());
      }
    }
    
    return suggestions.slice(0, 3);
  }

  private extractCommands(text: string): string[] {
    const commands: string[] = [];
    const codeBlocks = text.match(/```(?:bash|sh|shell)?\n(.*?)\n```/gs);
    
    if (codeBlocks) {
      for (const block of codeBlocks) {
        const command = block.replace(/```(?:bash|sh|shell)?\n?/g, '').replace(/\n```/g, '').trim();
        if (command && !command.includes('\n')) {
          commands.push(command);
        }
      }
    }
    
    return commands.slice(0, 3);
  }

  getStatus(): IAIModelStatus {
    return { ...this.status };
  }

  async destroy(): Promise<void> {
    this.client = null;
    this.status.status = 'unloaded';
  }
}