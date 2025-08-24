import { IAIProvider, IAIRequest, IAIResponse, IAIModelStatus, IAIModelConfig } from '../types';

export class GeminiProvider implements IAIProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly type = 'google';
  
  private apiKey: string;
  private baseUrl: string;
  private status: IAIModelStatus;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(private config: IAIModelConfig) {
    this.id = config.id;
    this.name = config.name;
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    
    this.status = {
      id: config.id,
      status: 'unloaded',
      capabilities: {
        streaming: true,
        functionCalling: true,
        codeGeneration: true,
        contextLength: config.contextLength,
        estimatedSpeed: 40, // tokens/sec
        memoryRequirement: 100, // MB
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('Google API key required');
    }

    this.status.status = 'loading';
    const startTime = Date.now();

    try {
      // Test connection with a simple request
      await this.testConnection();
      
      this.status.status = 'ready';
      this.status.loadTime = Date.now() - startTime;
      
      console.log(`✅ Gemini provider initialized in ${this.status.loadTime}ms`);
      
    } catch (error) {
      this.status.status = 'error';
      this.status.errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  async generateResponse(request: IAIRequest): Promise<IAIResponse> {
    if (this.status.status !== 'ready') {
      throw new Error('Gemini provider not ready');
    }

    this.enforceRateLimit();
    this.status.status = 'busy';
    const startTime = Date.now();

    try {
      const modelName = this.config.modelName || 'gemini-1.5-flash';
      const url = `${this.baseUrl}/models/${modelName}:generateContent?key=${this.apiKey}`;
      
      const prompt = this.buildPrompt(request);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: request.temperature || 0.7,
            maxOutputTokens: request.maxTokens || this.config.maxTokens,
            topP: 0.8,
            topK: 40,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response from Gemini API');
      }

      const responseText = data.candidates[0].content.parts[0].text;
      const responseTime = Date.now() - startTime;
      
      // Estimate token usage (Gemini doesn't always provide usage info)
      const estimatedTokens = Math.ceil((request.prompt.length + responseText.length) / 4);

      this.status.status = 'ready';
      this.status.lastUsed = new Date();
      this.requestCount++;

      return {
        text: responseText,
        model: this.id,
        tokens: estimatedTokens,
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
    
    let prompt = `As an AI assistant for terminal and development tasks, help with the following:

Context:
- Command: ${context.command}
- Working Directory: ${context.workingDirectory}
- Shell: ${context.shellType}`;

    if (context.recentCommands?.length > 0) {
      prompt += `\n- Recent Commands: ${context.recentCommands.slice(-3).join(', ')}`;
    }

    if (context.gitContext) {
      prompt += `\n- Git Branch: ${context.gitContext.branch}`;
      prompt += `\n- Git Status: ${context.gitContext.status}`;
    }

    if (context.projectContext) {
      prompt += `\n- Project Type: ${context.projectContext.type}`;
      prompt += `\n- Dependencies: ${context.projectContext.dependencies.slice(0, 5).join(', ')}`;
    }

    prompt += `\n\nUser Request: ${request.prompt}

Please provide a helpful response with:
1. Clear explanation
2. Practical examples
3. Potential issues to watch for
4. Alternative approaches if applicable

Use code blocks for terminal commands.`;

    return prompt;
  }

  private extractSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[\d\.]+\.\s/) || // Numbered suggestions
          trimmed.startsWith('- ') || // Bullet points
          trimmed.startsWith('* ') || // Alternative bullet
          trimmed.includes('tip:') ||
          trimmed.includes('note:') ||
          trimmed.includes('warning:')) {
        suggestions.push(trimmed.replace(/^[\d\.\-\*\s]+/, '').trim());
      }
    }
    
    return suggestions.slice(0, 4);
  }

  private extractCommands(text: string): string[] {
    const commands: string[] = [];
    
    // Extract from code blocks
    const codeBlocks = text.match(/```(?:bash|sh|shell|zsh|fish)?\n(.*?)\n```/gs);
    if (codeBlocks) {
      for (const block of codeBlocks) {
        const lines = block
          .replace(/```(?:bash|sh|shell|zsh|fish)?\n?/g, '')
          .replace(/\n```/g, '')
          .split('\n');
        
        for (const line of lines) {
          const command = line.replace(/^\$\s*/, '').replace(/^#.*/, '').trim();
          if (command && this.isValidCommand(command)) {
            commands.push(command);
          }
        }
      }
    }
    
    return [...new Set(commands)].slice(0, 3);
  }

  private isValidCommand(text: string): boolean {
    if (!text || text.length > 200) return false;
    
    const commandPrefixes = [
      'git', 'npm', 'yarn', 'pnpm', 'cd', 'ls', 'dir', 'mkdir', 'rm', 'del',
      'cp', 'copy', 'mv', 'move', 'chmod', 'curl', 'wget', 'ssh', 'docker',
      'kubectl', 'helm', 'terraform', 'aws', 'gcloud', 'az', 'heroku'
    ];
    
    const firstWord = text.split(' ')[0].toLowerCase();
    return commandPrefixes.includes(firstWord);
  }

  private enforceRateLimit(): void {
    if (!this.config.rateLimit) return;

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 60000 / this.config.rateLimit.requestsPerMinute;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      throw new Error(`Gemini rate limit exceeded. Wait ${Math.ceil(waitTime/1000)}s.`);
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
      const testUrl = `${this.baseUrl}/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'test' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
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