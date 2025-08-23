import { EventEmitter } from 'events';
import { OpenAIProvider } from './providers/openai-provider';
import { ClaudeProvider } from './providers/claude-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { DeepSeekProvider } from './providers/deepseek-provider';
import { QwenProvider } from './providers/qwen-provider';
import { LocalONNXProvider } from './local-onnx-provider';
import { ProviderSelector, IProviderSelectionCriteria } from './provider-selector';
import { UsageTracker, IUsageReport } from './usage-tracker';
import { 
  IAIProvider, 
  IAIModelConfig, 
  IAIRequest, 
  IAIResponse,
  IAIModelStatus,
  IProviderSelection 
} from './types';

export interface IMultiProviderOptions {
  enabledProviders: string[];
  defaultSelectionCriteria: IProviderSelectionCriteria;
  budgetLimits?: Record<string, { daily: number; weekly: number; monthly: number }>;
  persistUsage?: boolean;
}

export class MultiProviderAI extends EventEmitter {
  private providers = new Map<string, IAIProvider>();
  private selector: ProviderSelector;
  protected usageTracker: UsageTracker;
  private initialized = false;

  constructor(private options: IMultiProviderOptions) {
    super();
    
    this.selector = new ProviderSelector(this.providers);
    this.usageTracker = new UsageTracker({
      persistencePath: options.persistUsage ? '.portal/ai-usage.json' : undefined,
      budgets: options.budgetLimits,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.usageTracker.on('budgetAlert', (alert) => {
      this.emit('budgetAlert', alert);
      console.warn(`💰 Budget alert: ${alert.providerId} ${alert.type} usage at ${alert.percentageUsed.toFixed(1)}%`);
    });

    this.usageTracker.on('usageTracked', (data) => {
      this.emit('usageTracked', data);
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🚀 Initializing Multi-Provider AI System...');

    // Initialize all configured providers
    const configs = this.getProviderConfigs();
    const initPromises: Promise<void>[] = [];

    for (const config of configs) {
      if (this.options.enabledProviders.includes(config.id) && config.enabled) {
        initPromises.push(this.initializeProvider(config));
      }
    }

    // Initialize providers in parallel
    const results = await Promise.allSettled(initPromises);
    
    // Log initialization results
    let successCount = 0;
    let failureCount = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failureCount++;
        console.warn(`Failed to initialize provider:`, result.reason);
      }
    });

    console.log(`✅ AI System: ${successCount} providers ready, ${failureCount} failed`);

    if (successCount === 0) {
      throw new Error('No AI providers could be initialized');
    }

    this.initialized = true;
    this.emit('initialized', { successCount, failureCount });
  }

  private async initializeProvider(config: IAIModelConfig): Promise<void> {
    let provider: IAIProvider;

    switch (config.type) {
      case 'local-onnx':
        provider = new LocalONNXProvider(config);
        break;
      case 'openai':
        provider = new OpenAIProvider(config);
        break;
      case 'anthropic':
        provider = new ClaudeProvider(config);
        break;
      case 'google':
        provider = new GeminiProvider(config);
        break;
      case 'deepseek':
        provider = new DeepSeekProvider(config);
        break;
      case 'qwen':
        provider = new QwenProvider(config);
        break;
      default:
        throw new Error(`Unsupported provider type: ${config.type}`);
    }

    if (await provider.isAvailable()) {
      await provider.initialize();
      this.providers.set(config.id, provider);
      console.log(`✅ ${config.displayName} ready`);
    } else {
      console.log(`⚠️  ${config.displayName} not available (missing API key or model file)`);
    }
  }

  private getProviderConfigs(): IAIModelConfig[] {
    return [
      // Local ONNX Models
      {
        id: 'gpt-oss-20b',
        name: 'gpt-oss-20b',
        displayName: 'GPT-OSS-20B (Local)',
        type: 'local-onnx',
        modelPath: './models/gpt-oss-20b.onnx',
        maxTokens: 512,
        contextLength: 4096,
        enabled: true,
        priority: 95,
        costPer1kTokens: 0,
      },
      {
        id: 'gpt-oss-120b',
        name: 'gpt-oss-120b',
        displayName: 'GPT-OSS-120B (Local)',
        type: 'local-onnx',
        modelPath: './models/gpt-oss-120b.onnx',
        maxTokens: 1024,
        contextLength: 8192,
        enabled: true,
        priority: 90,
        costPer1kTokens: 0,
      },
      
      // OpenAI Models
      {
        id: 'openai-gpt-4o',
        name: 'openai-gpt-4o',
        displayName: 'GPT-4o',
        type: 'openai',
        modelName: 'gpt-4o',
        apiKey: process.env.OPENAI_API_KEY,
        maxTokens: 1024,
        contextLength: 128000,
        enabled: !!process.env.OPENAI_API_KEY,
        priority: 85,
        costPer1kTokens: 0.005,
        rateLimit: { requestsPerMinute: 500, tokensPerMinute: 30000 },
      },
      {
        id: 'openai-gpt-4o-mini',
        name: 'openai-gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        type: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: process.env.OPENAI_API_KEY,
        maxTokens: 512,
        contextLength: 128000,
        enabled: !!process.env.OPENAI_API_KEY,
        priority: 70,
        costPer1kTokens: 0.00015,
        rateLimit: { requestsPerMinute: 1000, tokensPerMinute: 50000 },
      },

      // Anthropic Models
      {
        id: 'claude-sonnet',
        name: 'claude-sonnet',
        displayName: 'Claude 3.5 Sonnet',
        type: 'anthropic',
        modelName: 'claude-3-5-sonnet-20241022',
        apiKey: process.env.ANTHROPIC_API_KEY,
        maxTokens: 1024,
        contextLength: 200000,
        enabled: !!process.env.ANTHROPIC_API_KEY,
        priority: 88,
        costPer1kTokens: 0.003,
        rateLimit: { requestsPerMinute: 50, tokensPerMinute: 10000 },
      },
      {
        id: 'claude-haiku',
        name: 'claude-haiku',
        displayName: 'Claude 3 Haiku',
        type: 'anthropic',
        modelName: 'claude-3-haiku-20240307',
        apiKey: process.env.ANTHROPIC_API_KEY,
        maxTokens: 512,
        contextLength: 200000,
        enabled: !!process.env.ANTHROPIC_API_KEY,
        priority: 75,
        costPer1kTokens: 0.00025,
        rateLimit: { requestsPerMinute: 100, tokensPerMinute: 25000 },
      },

      // Google Models
      {
        id: 'gemini-pro',
        name: 'gemini-pro',
        displayName: 'Gemini 1.5 Pro',
        type: 'google',
        modelName: 'gemini-1.5-pro',
        apiKey: process.env.GOOGLE_API_KEY,
        maxTokens: 1024,
        contextLength: 2000000,
        enabled: !!process.env.GOOGLE_API_KEY,
        priority: 80,
        costPer1kTokens: 0.00125,
        rateLimit: { requestsPerMinute: 60, tokensPerMinute: 32000 },
      },
      {
        id: 'gemini-flash',
        name: 'gemini-flash',
        displayName: 'Gemini 1.5 Flash',
        type: 'google',
        modelName: 'gemini-1.5-flash',
        apiKey: process.env.GOOGLE_API_KEY,
        maxTokens: 512,
        contextLength: 1000000,
        enabled: !!process.env.GOOGLE_API_KEY,
        priority: 72,
        costPer1kTokens: 0.000075,
        rateLimit: { requestsPerMinute: 300, tokensPerMinute: 100000 },
      },

      // DeepSeek Models
      {
        id: 'deepseek-coder',
        name: 'deepseek-coder',
        displayName: 'DeepSeek Coder V2',
        type: 'deepseek',
        modelName: 'deepseek-coder',
        apiKey: process.env.DEEPSEEK_API_KEY,
        maxTokens: 1024,
        contextLength: 16384,
        enabled: !!process.env.DEEPSEEK_API_KEY,
        priority: 82,
        costPer1kTokens: 0.00014,
        rateLimit: { requestsPerMinute: 300, tokensPerMinute: 50000 },
      },

      // Qwen Models
      {
        id: 'qwen-coder',
        name: 'qwen-coder',
        displayName: 'Qwen2.5 Coder',
        type: 'qwen',
        modelName: 'qwen2.5-coder-32b-instruct',
        apiKey: process.env.QWEN_API_KEY,
        maxTokens: 1024,
        contextLength: 32768,
        enabled: !!process.env.QWEN_API_KEY,
        priority: 78,
        costPer1kTokens: 0.0002,
        rateLimit: { requestsPerMinute: 200, tokensPerMinute: 60000 },
      },
    ];
  }

  selectProvider(request: IAIRequest, criteria?: Partial<IProviderSelectionCriteria>): IProviderSelection {
    if (!this.initialized) {
      throw new Error('AI system not initialized');
    }

    const selectionCriteria = { ...this.options.defaultSelectionCriteria, ...criteria };
    return this.selector.selectProvider(request, selectionCriteria);
  }

  getStatus() {
    const statuses = Array.from(this.providers.values()).map(p => p.getStatus());
    const ready = statuses.filter(s => s.status === 'ready');
    const failed = statuses.filter(s => s.status === 'error');
    
    return {
      initialized: this.initialized,
      availableProviders: ready.map(s => s.id),
      failedProviders: failed.map(s => s.id),
      totalProviders: this.providers.size,
    };
  }

  async generateResponse(request: IAIRequest, criteria?: Partial<IProviderSelectionCriteria>): Promise<IAIResponse> {
    if (!this.initialized) {
      throw new Error('AI system not initialized');
    }

    const selectionCriteria = { ...this.options.defaultSelectionCriteria, ...criteria };
    const selection = this.selector.selectProvider(request, selectionCriteria);
    
    const provider = this.providers.get(selection.selectedProvider);
    if (!provider) {
      throw new Error(`Selected provider ${selection.selectedProvider} not found`);
    }

    try {
      const startTime = Date.now();
      const response = await provider.generateResponse(request);
      const responseTime = Date.now() - startTime;
      
      // Track usage
      await this.usageTracker.trackRequest(
        provider.id,
        request,
        response,
        true
      );

      // Create enhanced response with metadata
      const enhancedResponse: IAIResponse = {
        ...response,
        providerId: provider.id,
        responseTime,
        contextUsed: !!(request.context && Object.keys(request.context).length > 0),
        enhancedPrompt: this.buildEnhancedPrompt(request),
      };

      this.emit('responseGenerated', { provider: provider.id, response: enhancedResponse, selection });

      return enhancedResponse;

    } catch (error) {
      // Track failed request
      await this.usageTracker.trackRequest(
        provider.id,
        request,
        { text: '', model: provider.id, tokens: 0, responseTime: 0, cached: false },
        false
      );

      // Try fallback provider if available
      if (selectionCriteria.allowFallback && selection.alternatives.length > 0) {
        console.warn(`Provider ${provider.id} failed, trying fallback...`);
        
        const fallbackProvider = this.providers.get(selection.alternatives[0].providerId);
        if (fallbackProvider) {
          try {
            const startTime = Date.now();
            const response = await fallbackProvider.generateResponse(request);
            const responseTime = Date.now() - startTime;
            await this.usageTracker.trackRequest(fallbackProvider.id, request, response, true);
            
            const enhancedResponse: IAIResponse = {
              ...response,
              providerId: fallbackProvider.id,
              responseTime,
              contextUsed: !!(request.context && Object.keys(request.context).length > 0),
              enhancedPrompt: this.buildEnhancedPrompt(request),
            };
            
            return enhancedResponse;
          } catch (fallbackError) {
            console.error('Fallback provider also failed:', fallbackError);
          }
        }
      }

      throw error;
    }
  }

  private buildEnhancedPrompt(request: IAIRequest): string {
    if (!request.context) {
      return request.prompt;
    }

    const context = request.context;
    let enhancedPrompt = request.prompt;

    // Add shell context if available
    if (context.shellType) {
      enhancedPrompt += `\n\nShell: ${context.shellType}`;
    }

    // Add command context
    if (context.command) {
      enhancedPrompt += `\nCommand: ${context.command}`;
    }

    // Add working directory
    if (context.workingDirectory) {
      enhancedPrompt += `\nWorking Directory: ${context.workingDirectory}`;
    }

    // Add recent commands
    if (context.recentCommands && context.recentCommands.length > 0) {
      enhancedPrompt += `\nRecent Commands: ${context.recentCommands.join(', ')}`;
    }

    // Add last output
    if (context.lastOutput) {
      enhancedPrompt += `\nLast Output: ${context.lastOutput}`;
    }

    return enhancedPrompt;
  }

  async getProviderStatuses(): Promise<IAIModelStatus[]> {
    return Array.from(this.providers.values()).map(p => p.getStatus());
  }

  async getUsageReport(period: 'today' | 'week' | 'month' | 'all' = 'week'): Promise<IUsageReport> {
    return this.usageTracker.generateReport(period);
  }

  getCostSummary() {
    return this.usageTracker.getCostSummary();
  }

  setBudget(providerId: string, limits: { daily?: number; weekly?: number; monthly?: number }): void {
    this.usageTracker.setBudget(providerId, limits);
  }

  getBudgetStatus(providerId: string) {
    return this.usageTracker.getBudgetStatus(providerId);
  }

  getProviderRecommendation(request: IAIRequest) {
    return this.selector.getProviderRecommendation(request);
  }

  async switchProvider(fromId: string, toId: string): Promise<void> {
    const fromProvider = this.providers.get(fromId);
    const toProvider = this.providers.get(toId);
    
    if (!toProvider) {
      throw new Error(`Provider ${toId} not found`);
    }

    if (toProvider.getStatus().status !== 'ready') {
      await toProvider.initialize();
    }

    this.emit('providerSwitched', { from: fromId, to: toId });
  }

  async testAllProviders(): Promise<{
    results: Array<{
      providerId: string;
      status: 'success' | 'failed' | 'unavailable';
      responseTime?: number;
      error?: string;
    }>;
    summary: {
      total: number;
      available: number;
      working: number;
      failed: number;
    };
  }> {
    console.log('🧪 Testing all AI providers...');
    
    const results: any[] = [];
    const testRequest: IAIRequest = {
      prompt: 'Test response - say "OK" if working',
      context: {
        command: 'test',
        workingDirectory: process.cwd(),
        shellType: 'bash',
        recentCommands: [],
      },
      maxTokens: 10,
      temperature: 0.1,
    };

    for (const [providerId, provider] of this.providers.entries()) {
      const result = { providerId, status: 'unavailable' as const };
      
      try {
        if (provider.getStatus().status !== 'ready') {
          if (await provider.isAvailable()) {
            await provider.initialize();
          } else {
            results.push(result);
            continue;
          }
        }

        const startTime = Date.now();
        const response = await provider.generateResponse(testRequest);
        const responseTime = Date.now() - startTime;

        results.push({
          providerId,
          status: 'success' as const,
          responseTime,
        });

        console.log(`✅ ${provider.name}: ${responseTime}ms`);

      } catch (error) {
        results.push({
          providerId,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : String(error),
        });

        console.log(`❌ ${provider.name}: ${error}`);
      }
    }

    const summary = {
      total: this.providers.size,
      available: results.filter(r => r.status !== 'unavailable').length,
      working: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
    };

    console.log(`📊 Test Summary: ${summary.working}/${summary.total} providers working`);

    return { results, summary };
  }

  async benchmarkProviders(): Promise<{
    providers: Array<{
      providerId: string;
      averageResponseTime: number;
      tokensPerSecond: number;
      costPer1kTokens: number;
      reliability: number;
    }>;
    fastest: string;
    cheapest: string;
    mostReliable: string;
  }> {
    console.log('📊 Benchmarking AI provider performance...');
    
    const benchmarkRequests = [
      'Explain the ls command',
      'How do I commit changes in git?',
      'Debug this npm install error',
      'Show me how to create a React component',
      'What does this bash script do?',
    ];

    const providerResults: any[] = [];

    for (const [providerId, provider] of this.providers.entries()) {
      if (provider.getStatus().status !== 'ready') continue;

      const times: number[] = [];
      let totalTokens = 0;
      let successCount = 0;

      console.log(`Testing ${provider.name}...`);

      for (const prompt of benchmarkRequests) {
        try {
          const startTime = Date.now();
          const response = await provider.generateResponse({
            prompt,
            context: {
              command: 'test',
              workingDirectory: process.cwd(),
              shellType: 'bash',
              recentCommands: [],
            },
            maxTokens: 100,
          });

          times.push(Date.now() - startTime);
          totalTokens += response.tokens;
          successCount++;

        } catch (error) {
          console.warn(`  Failed: ${error}`);
        }
      }

      if (times.length > 0) {
        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        const tokensPerSecond = totalTokens / (times.reduce((sum, time) => sum + time, 0) / 1000);
        const reliability = successCount / benchmarkRequests.length;

        providerResults.push({
          providerId,
          averageResponseTime: Math.round(avgTime),
          tokensPerSecond: Math.round(tokensPerSecond),
          costPer1kTokens: provider.getCostEstimate({} as IAIRequest) * 1000 / 100, // Rough estimate
          reliability: Math.round(reliability * 100) / 100,
        });

        console.log(`  ✅ Avg: ${Math.round(avgTime)}ms, Speed: ${Math.round(tokensPerSecond)} tok/s`);
      }
    }

    // Find winners
    const fastest = providerResults.reduce((prev, curr) => 
      prev.averageResponseTime < curr.averageResponseTime ? prev : curr
    );
    
    const cheapest = providerResults.reduce((prev, curr) => 
      prev.costPer1kTokens < curr.costPer1kTokens ? prev : curr
    );
    
    const mostReliable = providerResults.reduce((prev, curr) => 
      prev.reliability > curr.reliability ? prev : curr
    );

    return {
      providers: providerResults,
      fastest: fastest.providerId,
      cheapest: cheapest.providerId,
      mostReliable: mostReliable.providerId,
    };
  }

  getSystemStatus(): {
    initialized: boolean;
    totalProviders: number;
    readyProviders: number;
    localModels: number;
    externalProviders: number;
    totalCost: number;
    requestsToday: number;
  } {
    const statuses = Array.from(this.providers.values()).map(p => p.getStatus());
    const ready = statuses.filter(s => s.status === 'ready');
    const local = statuses.filter(s => s.id.includes('oss'));
    const external = statuses.filter(s => !s.id.includes('oss'));
    const costs = this.usageTracker.getCostSummary();

    return {
      initialized: this.initialized,
      totalProviders: this.providers.size,
      readyProviders: ready.length,
      localModels: local.length,
      externalProviders: external.length,
      totalCost: costs.total,
      requestsToday: this.usageTracker.generateReport('today').totalRequests,
    };
  }

  async shutdown(): Promise<void> {
    await this.destroy();
  }

  async destroy(): Promise<void> {
    const destroyPromises = Array.from(this.providers.values()).map(p => p.destroy());
    await Promise.all(destroyPromises);
    
    this.providers.clear();
    this.removeAllListeners();
    this.initialized = false;
  }
}