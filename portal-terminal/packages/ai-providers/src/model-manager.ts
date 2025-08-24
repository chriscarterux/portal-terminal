import { EventEmitter } from 'events';
import { LocalONNXProvider } from './local-onnx-provider';
import { ExternalProvider } from './external-provider';
import { PromptEngineer } from './prompt-engineer';
import { 
  IAIModelConfig, 
  IAIProvider, 
  IAIRequest, 
  IAIResponse, 
  IAIModelStatus,
  IAIPromptContext 
} from './types';

export interface IModelManagerOptions {
  modelsDirectory?: string;
  preloadModels?: boolean;
  cacheResponses?: boolean;
  maxCacheSize?: number;
}

export class ModelManager extends EventEmitter {
  private providers = new Map<string, IAIProvider>();
  private promptEngineer: PromptEngineer;
  private responseCache = new Map<string, IAIResponse>();
  private requestQueue: Array<{ request: IAIRequest; resolve: Function; reject: Function }> = [];
  private isProcessingQueue = false;

  constructor(private options: IModelManagerOptions = {}) {
    super();
    this.promptEngineer = new PromptEngineer();
  }

  async initialize(): Promise<void> {
    const configs = this.getDefaultModelConfigs();
    
    for (const config of configs) {
      if (config.enabled) {
        await this.addModel(config);
      }
    }

    if (this.options.preloadModels) {
      await this.preloadAvailableModels();
    }

    this.emit('initialized');
  }

  private getDefaultModelConfigs(): IAIModelConfig[] {
    const modelsDir = this.options.modelsDirectory || path.join(process.cwd(), 'models');
    
    return [
      {
        id: 'gpt-oss-20b',
        name: 'GPT-OSS-20B (Local)',
        type: 'local-onnx',
        modelPath: path.join(modelsDir, 'gpt-oss-20b.onnx'),
        maxTokens: 2048,
        contextLength: 4096,
        enabled: true,
        priority: 90, // High priority for local model
      },
      {
        id: 'gpt-oss-120b',
        name: 'GPT-OSS-120B (Local)',
        type: 'local-onnx',
        modelPath: path.join(modelsDir, 'gpt-oss-120b.onnx'),
        maxTokens: 4096,
        contextLength: 8192,
        enabled: true,
        priority: 95, // Highest priority for best local model
      },
      {
        id: 'openai-gpt-4',
        name: 'OpenAI GPT-4',
        type: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        maxTokens: 4096,
        contextLength: 128000,
        enabled: !!process.env.OPENAI_API_KEY,
        priority: 80,
      },
      {
        id: 'anthropic-claude',
        name: 'Anthropic Claude',
        type: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        maxTokens: 4096,
        contextLength: 200000,
        enabled: !!process.env.ANTHROPIC_API_KEY,
        priority: 85,
      },
    ];
  }

  private async addModel(config: IAIModelConfig): Promise<void> {
    let provider: IAIProvider;

    switch (config.type) {
      case 'local-onnx':
        provider = new LocalONNXProvider(config);
        break;
      case 'openai':
      case 'anthropic':
      case 'google':
      case 'deepseek':
      case 'qwen':
        provider = new ExternalProvider(config);
        break;
      default:
        throw new Error(`Unsupported model type: ${config.type}`);
    }

    // Check if provider is available before adding
    if (await provider.isAvailable()) {
      this.providers.set(config.id, provider);
      this.emit('modelAdded', config);
      console.log(`📦 Added model: ${config.name}`);
    } else {
      console.log(`⚠️  Model not available: ${config.name}`);
    }
  }

  private async preloadAvailableModels(): Promise<void> {
    const localProviders = Array.from(this.providers.values())
      .filter(p => p.type === 'local-onnx');

    for (const provider of localProviders) {
      try {
        await provider.initialize();
        await (provider as LocalONNXProvider).warmup();
      } catch (error) {
        console.warn(`Failed to preload ${provider.name}:`, error);
      }
    }
  }

  async generateResponse(request: IAIRequest): Promise<IAIResponse> {
    // Add to queue for processing
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ request, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;
    
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const { request, resolve, reject } = this.requestQueue.shift()!;
      
      try {
        const response = await this.executeRequest(request);
        resolve(response);
      } catch (error) {
        reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  private async executeRequest(request: IAIRequest): Promise<IAIResponse> {
    // Check cache first
    if (this.options.cacheResponses) {
      const cacheKey = this.getCacheKey(request);
      const cached = this.responseCache.get(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    // Select best available model
    const provider = this.selectOptimalProvider(request);
    if (!provider) {
      throw new Error('No available AI providers');
    }

    // Enhance prompt with context
    const enhancedRequest = await this.promptEngineer.enhanceRequest(request);
    
    // Generate response
    const response = await provider.generateResponse(enhancedRequest);
    
    // Cache if enabled
    if (this.options.cacheResponses) {
      this.cacheResponse(request, response);
    }

    this.emit('responseGenerated', { request, response, provider: provider.id });
    return response;
  }

  private selectOptimalProvider(request: IAIRequest): IAIProvider | null {
    const availableProviders = Array.from(this.providers.values())
      .filter(p => p.getStatus().status === 'ready')
      .sort((a, b) => {
        const configA = this.getProviderConfig(a.id);
        const configB = this.getProviderConfig(b.id);
        return (configB?.priority || 0) - (configA?.priority || 0);
      });

    // Prefer specific model if requested
    if (request.model) {
      const specific = availableProviders.find(p => p.id === request.model);
      if (specific) return specific;
    }

    // For performance-critical requests, prefer 20B model
    const isPerformanceCritical = request.prompt.length < 100;
    if (isPerformanceCritical) {
      const fast = availableProviders.find(p => p.id.includes('20b'));
      if (fast) return fast;
    }

    // Return highest priority available provider
    return availableProviders[0] || null;
  }

  private getProviderConfig(providerId: string): IAIModelConfig | null {
    const configs = this.getDefaultModelConfigs();
    return configs.find(c => c.id === providerId) || null;
  }

  private getCacheKey(request: IAIRequest): string {
    const key = {
      prompt: request.prompt,
      command: request.context.command,
      cwd: request.context.workingDirectory,
    };
    return Buffer.from(JSON.stringify(key)).toString('base64');
  }

  private cacheResponse(request: IAIRequest, response: IAIResponse): void {
    const key = this.getCacheKey(request);
    this.responseCache.set(key, response);
    
    // Limit cache size
    if (this.responseCache.size > (this.options.maxCacheSize || 100)) {
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }
  }

  async getModelStatuses(): Promise<IAIModelStatus[]> {
    return Array.from(this.providers.values()).map(p => p.getStatus());
  }

  async getAvailableModels(): Promise<IAIModelStatus[]> {
    return (await this.getModelStatuses()).filter(s => s.status === 'ready');
  }

  async loadModel(modelId: string): Promise<void> {
    const provider = this.providers.get(modelId);
    if (!provider) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (provider.getStatus().status === 'ready') {
      return; // Already loaded
    }

    await provider.initialize();
    this.emit('modelLoaded', modelId);
  }

  async unloadModel(modelId: string): Promise<void> {
    const provider = this.providers.get(modelId);
    if (!provider) return;

    await provider.destroy();
    this.emit('modelUnloaded', modelId);
  }

  async switchModel(fromId: string, toId: string): Promise<void> {
    await this.unloadModel(fromId);
    await this.loadModel(toId);
    this.emit('modelSwitched', { from: fromId, to: toId });
  }

  getPerformanceSummary(): any {
    const statuses = Array.from(this.providers.values()).map(p => p.getStatus());
    const ready = statuses.filter(s => s.status === 'ready').length;
    
    return {
      totalModels: statuses.length,
      readyModels: ready,
      avgLoadTime: statuses.reduce((sum, s) => sum + (s.loadTime || 0), 0) / statuses.length,
      totalMemoryUsage: statuses.reduce((sum, s) => sum + (s.memoryUsage || 0), 0),
      cacheSize: this.responseCache.size,
      queueLength: this.requestQueue.length,
    };
  }

  clearCache(): void {
    this.responseCache.clear();
    this.emit('cacheCleared');
  }

  async destroy(): Promise<void> {
    // Destroy all providers
    const destroyPromises = Array.from(this.providers.values()).map(p => p.destroy());
    await Promise.all(destroyPromises);
    
    this.providers.clear();
    this.responseCache.clear();
    this.requestQueue.length = 0;
    this.removeAllListeners();
  }
}