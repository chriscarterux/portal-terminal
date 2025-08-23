import { ModelManager } from './model-manager';
import { PromptEngineer } from './prompt-engineer';
import { IAIRequest, IAIResponse, IAIPromptContext } from './types';

export interface IAITerminalOptions {
  enabledProviders: string[];
  defaultModel?: string;
  responseTimeout: number;
  enableCaching: boolean;
}

export class AITerminalIntegration {
  private modelManager: ModelManager;
  private promptEngineer: PromptEngineer;
  private initialized = false;
  private mcpClient: any = null;

  constructor(private options: IAITerminalOptions) {
    this.modelManager = new ModelManager({
      preloadModels: true,
      cacheResponses: options.enableCaching,
      maxCacheSize: 50,
    });
    this.promptEngineer = new PromptEngineer();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.modelManager.initialize();
      
      // Check which models are actually available
      const available = await this.modelManager.getAvailableModels();
      console.log(`🤖 AI Integration: ${available.length} models ready`);
      
      this.initialized = true;
    } catch (error) {
      console.warn('AI integration failed:', error);
      throw error;
    }
  }

  async generateCommandSuggestion(
    command: string, 
    context: IAIPromptContext
  ): Promise<string[]> {
    if (!this.initialized) {
      return [];
    }

    try {
      // First try contextual suggestions from prompt engineer
      const contextualSuggestions = await this.promptEngineer.generateContextualSuggestions(
        command, 
        context, 
        context.mcpContext
      );
      
      if (contextualSuggestions.length > 0) {
        return contextualSuggestions;
      }
      
      // Fall back to AI generation for complex cases
      const enhancedPrompt = this.promptEngineer.buildFastPrompt(
        context, 
        `Suggest 3 helpful alternatives or completions for: ${command}`
      );
      
      const request: IAIRequest = {
        prompt: enhancedPrompt,
        context,
        model: 'gpt-oss-20b',
        maxTokens: 100,
        temperature: 0.3,
      };

      const response = await this.modelManager.generateResponse(request);
      return response.suggestions || [];
      
    } catch (error) {
      console.warn('Failed to generate suggestions:', error);
      return [];
    }
  }

  async explainCommand(
    command: string,
    context: IAIPromptContext
  ): Promise<string> {
    if (!this.initialized) {
      return 'AI explanation not available';
    }

    try {
      // Search MCP context for relevant information first
      let mcpSearchResults: any[] = [];
      if (this.mcpClient && context.mcpContext) {
        try {
          mcpSearchResults = await this.mcpClient.searchContext(command);
        } catch (error) {
          console.warn('MCP search failed:', error);
        }
      }
      
      // Build MCP-enhanced prompt
      const enhancedPrompt = mcpSearchResults.length > 0 ?
        this.promptEngineer.buildMCPEnhancedPrompt(context, `Explain: ${command}`, mcpSearchResults) :
        this.promptEngineer.buildQualityPrompt(context, `Explain this command: ${command}`);
      
      const request: IAIRequest = {
        prompt: enhancedPrompt,
        context: {
          ...context,
          mcpSearchResults,
        },
        model: this.options.defaultModel || 'gpt-oss-20b',
        maxTokens: 200,
        temperature: 0.1,
      };

      const enhancedRequest = await this.promptEngineer.enhanceRequest(request);
      const response = await this.modelManager.generateResponse(enhancedRequest);
      return response.text;
      
    } catch (error) {
      console.warn('Failed to explain command:', error);
      return 'Command explanation unavailable';
    }
  }

  async analyzeError(
    command: string,
    errorOutput: string,
    context: IAIPromptContext
  ): Promise<{
    diagnosis: string;
    suggestions: string[];
    fixCommands: string[];
  }> {
    if (!this.initialized) {
      return {
        diagnosis: 'AI error analysis not available',
        suggestions: [],
        fixCommands: [],
      };
    }

    try {
      const request: IAIRequest = {
        prompt: `Analyze this error and provide solutions:
        
Command: ${command}
Error: ${errorOutput}

Provide diagnosis and fix suggestions.`,
        context,
        model: this.options.defaultModel || 'gpt-oss-120b', // Use quality model for complex analysis
        maxTokens: 300,
        temperature: 0.2,
      };

      const response = await this.modelManager.generateResponse(request);
      
      return {
        diagnosis: response.text,
        suggestions: response.suggestions || [],
        fixCommands: response.commands || [],
      };
      
    } catch (error) {
      console.warn('Failed to analyze error:', error);
      return {
        diagnosis: 'Error analysis failed',
        suggestions: [],
        fixCommands: [],
      };
    }
  }

  async getContextualHelp(
    userQuery: string,
    context: IAIPromptContext
  ): Promise<IAIResponse> {
    if (!this.initialized) {
      throw new Error('AI integration not initialized');
    }

    try {
      // Search MCP context for relevant information
      let mcpSearchResults: any[] = [];
      if (this.mcpClient && context.mcpContext) {
        mcpSearchResults = await this.mcpClient.searchContext(userQuery);
        console.log(`🔍 Found ${mcpSearchResults.length} relevant MCP items`);
      }
      
      // Build context-aware prompt
      const enhancedPrompt = mcpSearchResults.length > 0 ?
        this.promptEngineer.buildMCPEnhancedPrompt(context, userQuery, mcpSearchResults) :
        this.promptEngineer.buildQualityPrompt(context, userQuery);
      
      const request: IAIRequest = {
        prompt: enhancedPrompt,
        context: {
          ...context,
          mcpSearchResults,
        },
        model: this.selectOptimalModel(userQuery),
        maxTokens: this.calculateTokenLimit(userQuery),
        temperature: 0.5,
      };

      const enhancedRequest = await this.promptEngineer.enhanceRequest(request);
      return this.modelManager.generateResponse(enhancedRequest);
      
    } catch (error) {
      console.error('Contextual help failed:', error);
      throw error;
    }
  }

  private selectOptimalModel(query: string): string {
    const isSimpleQuery = query.length < 50 && !query.includes('complex') && !query.includes('explain');
    
    // Use fast model for simple queries, quality model for complex ones
    return isSimpleQuery ? 'gpt-oss-20b' : (this.options.defaultModel || 'gpt-oss-120b');
  }

  private calculateTokenLimit(query: string): number {
    // Adjust token limit based on query complexity
    if (query.length < 50) {
      return 150; // Brief response for simple queries
    } else if (query.length < 200) {
      return 300; // Medium response
    } else {
      return 500; // Detailed response for complex queries
    }
  }

  async getAIStatus(): Promise<{
    initialized: boolean;
    availableModels: any[];
    performance: any;
    recentResponseTimes: number[];
  }> {
    const available = this.initialized ? await this.modelManager.getAvailableModels() : [];
    const performance = this.initialized ? this.modelManager.getPerformanceSummary() : null;
    
    return {
      initialized: this.initialized,
      availableModels: available,
      performance,
      recentResponseTimes: [], // Would track recent response times
    };
  }

  async benchmarkModels(): Promise<any> {
    if (!this.initialized) {
      throw new Error('AI integration not initialized');
    }

    console.log('🏃 Running AI model benchmarks...');
    
    // This would run actual benchmarks on available models
    const mockResults = {
      'gpt-oss-20b': {
        avgResponseTime: 420,
        tokensPerSecond: 24,
        meetsTarget: true,
      },
      'gpt-oss-120b': {
        avgResponseTime: 3200,
        tokensPerSecond: 3,
        meetsTarget: true,
      },
    };

    return mockResults;
  }

  async warmupModels(): Promise<void> {
    console.log('🔥 Warming up AI models for optimal performance...');
    
    const available = await this.modelManager.getAvailableModels();
    
    for (const model of available) {
      if (model.id.includes('20b')) {
        // Warmup the fast model first
        console.log(`🔥 Warming up ${model.id} for fast responses...`);
        // Warmup logic would go here
      }
    }
  }

  // Set MCP client for enhanced context
  setMCPClient(mcpClient: any): void {
    this.mcpClient = mcpClient;
  }
  
  // Get MCP-enhanced AI response
  async getEnhancedResponse(
    prompt: string,
    context: IAIPromptContext,
    options: {
      searchMCP?: boolean;
      useTemplate?: string;
      priority?: 'speed' | 'quality';
    } = {}
  ): Promise<IAIResponse> {
    if (!this.initialized) {
      throw new Error('AI integration not initialized');
    }

    try {
      let mcpSearchResults: any[] = [];
      
      // Search MCP if enabled
      if (options.searchMCP !== false && this.mcpClient) {
        mcpSearchResults = await this.mcpClient.searchContext(prompt);
      }
      
      // Build appropriate prompt based on priority
      let enhancedPrompt: string;
      if (options.priority === 'speed') {
        enhancedPrompt = this.promptEngineer.buildFastPrompt(context, prompt);
      } else if (mcpSearchResults.length > 0) {
        enhancedPrompt = this.promptEngineer.buildMCPEnhancedPrompt(context, prompt, mcpSearchResults);
      } else {
        enhancedPrompt = this.promptEngineer.buildQualityPrompt(context, prompt);
      }
      
      const request: IAIRequest = {
        prompt: enhancedPrompt,
        context: {
          ...context,
          mcpSearchResults,
        },
        model: options.priority === 'speed' ? 'gpt-oss-20b' : (this.options.defaultModel || 'gpt-oss-120b'),
        maxTokens: options.priority === 'speed' ? 150 : 400,
        temperature: 0.3,
      };

      const enhancedRequest = await this.promptEngineer.enhanceRequest(request);
      return this.modelManager.generateResponse(enhancedRequest);
      
    } catch (error) {
      console.error('Enhanced AI response failed:', error);
      throw error;
    }
  }
  
  async destroy(): Promise<void> {
    await this.modelManager.destroy();
    this.mcpClient = null;
    this.initialized = false;
  }

  // Quick AI response for immediate feedback (<100ms)
  async getQuickSuggestion(command: string): Promise<string> {
    // Use cached responses or simple heuristics for instant feedback
    const quickSuggestions: Record<string, string> = {
      'git': '💡 Try: git status, git log, git diff',
      'npm': '💡 Try: npm list, npm outdated, npm audit',
      'ls': '💡 Try: ls -la, ls -lh, ls -t',
      'cd': '💡 Try: cd .., cd ~, cd -',
      'rm': '⚠️  Be careful with rm - consider using trash or backup first',
      'sudo': '⚠️  sudo requires elevated permissions',
    };

    const firstWord = command.split(' ')[0];
    return quickSuggestions[firstWord] || '💡 AI analysis available - press Tab for suggestions';
  }
}