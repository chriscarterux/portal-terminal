import { IAIProvider, IAIRequest, IProviderSelection, IUsageMetrics } from './types';

export interface IProviderSelectionCriteria {
  prioritizeSpeed: boolean;
  prioritizeCost: boolean;
  prioritizeQuality: boolean;
  maxCostPerRequest: number;
  maxResponseTime: number;
  requireLocal: boolean;
  allowFallback: boolean;
}

export class ProviderSelector {
  private usageMetrics = new Map<string, IUsageMetrics>();

  constructor(private providers: Map<string, IAIProvider>) {}

  selectProvider(
    request: IAIRequest, 
    criteria: IProviderSelectionCriteria
  ): IProviderSelection {
    const availableProviders = this.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      throw new Error('No available AI providers');
    }

    // If user specified a model, try to use it first
    if (request.model) {
      const specified = availableProviders.find(p => p.id === request.model);
      if (specified) {
        return this.createSelection(specified, request, 'user-specified');
      }
    }

    // Filter by requirements
    let candidates = availableProviders;

    if (criteria.requireLocal) {
      candidates = candidates.filter(p => p.type === 'local-onnx');
    }

    // Filter by cost constraints
    candidates = candidates.filter(p => {
      const cost = p.getCostEstimate(request);
      return cost <= criteria.maxCostPerRequest;
    });

    if (candidates.length === 0 && criteria.allowFallback) {
      candidates = availableProviders; // Fallback to any available
    }

    // Score and rank providers
    const scored = candidates.map(provider => ({
      provider,
      score: this.calculateProviderScore(provider, request, criteria),
      cost: provider.getCostEstimate(request),
      estimatedTime: this.estimateResponseTime(provider, request),
    }));

    scored.sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      throw new Error('No providers meet the selection criteria');
    }

    const selected = scored[0];
    const alternatives = scored.slice(1, 4).map(s => ({
      providerId: s.provider.id,
      reason: this.getSelectionReason(s.provider, criteria),
      cost: s.cost,
      responseTime: s.estimatedTime,
    }));

    return {
      selectedProvider: selected.provider.id,
      reason: this.getSelectionReason(selected.provider, criteria),
      estimatedCost: selected.cost,
      estimatedResponseTime: selected.estimatedTime,
      alternatives,
    };
  }

  private getAvailableProviders(): IAIProvider[] {
    return Array.from(this.providers.values())
      .filter(p => p.getStatus().status === 'ready');
  }

  private calculateProviderScore(
    provider: IAIProvider, 
    request: IAIRequest, 
    criteria: IProviderSelectionCriteria
  ): number {
    let score = 0;
    const status = provider.getStatus();
    const metrics = this.usageMetrics.get(provider.id);

    // Base score from provider priority and capabilities
    score += status.capabilities?.codeGeneration ? 20 : 0;
    score += status.capabilities?.functionCalling ? 15 : 0;
    score += status.capabilities?.streaming ? 10 : 0;

    // Speed scoring
    if (criteria.prioritizeSpeed) {
      const estimatedTime = this.estimateResponseTime(provider, request);
      if (estimatedTime < 500) score += 50; // Local models
      else if (estimatedTime < 2000) score += 30; // Fast APIs
      else if (estimatedTime < 5000) score += 10; // Slower APIs
    }

    // Cost scoring
    if (criteria.prioritizeCost) {
      const cost = provider.getCostEstimate(request);
      if (cost === 0) score += 40; // Local models (free)
      else if (cost < 0.001) score += 30; // Very cheap
      else if (cost < 0.01) score += 20; // Reasonable
      else if (cost < 0.1) score += 10; // Expensive
    }

    // Quality scoring (based on model type and context length)
    if (criteria.prioritizeQuality) {
      if (provider.id.includes('120b')) score += 40; // Large local model
      else if (provider.id.includes('claude')) score += 35; // Claude quality
      else if (provider.id.includes('gpt-4')) score += 35; // GPT-4 quality
      else if (provider.id.includes('20b')) score += 25; // Smaller local model
      else score += 15; // Other models
    }

    // Reliability scoring based on historical performance
    if (metrics) {
      const successRate = 1 - metrics.errorRate;
      score += successRate * 20; // Up to 20 points for reliability
      
      const speedBonus = metrics.averageResponseTime < 1000 ? 10 : 0;
      score += speedBonus;
    }

    // Local model preference boost
    if (provider.type === 'local-onnx') {
      score += 15; // Privacy and reliability bonus
    }

    return score;
  }

  private estimateResponseTime(provider: IAIProvider, request: IAIRequest): number {
    const capabilities = provider.getStatus().capabilities;
    if (!capabilities) return 5000; // Conservative estimate

    const baseSpeed = capabilities.estimatedSpeed; // tokens/sec
    const outputTokens = request.maxTokens || 256;
    
    let estimatedTime = (outputTokens / baseSpeed) * 1000; // Convert to ms
    
    // Add network latency for external providers
    if (provider.type !== 'local-onnx') {
      estimatedTime += 200; // Base network latency
    }

    // Add processing overhead
    estimatedTime += 100;

    return Math.round(estimatedTime);
  }

  private getSelectionReason(provider: IAIProvider, criteria: IProviderSelectionCriteria): string {
    if (criteria.requireLocal && provider.type === 'local-onnx') {
      return 'local-required';
    }
    
    if (criteria.prioritizeSpeed && this.estimateResponseTime(provider, {} as IAIRequest) < 500) {
      return 'speed';
    }
    
    if (criteria.prioritizeCost && provider.getCostEstimate({} as IAIRequest) === 0) {
      return 'cost';
    }
    
    if (criteria.prioritizeQuality && (provider.id.includes('120b') || provider.id.includes('claude'))) {
      return 'quality';
    }
    
    return 'availability';
  }

  updateUsageMetrics(providerId: string, tokens: number, cost: number, responseTime: number, success: boolean): void {
    let metrics = this.usageMetrics.get(providerId);
    
    if (!metrics) {
      metrics = {
        providerId,
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        averageResponseTime: 0,
        errorRate: 0,
        lastUsed: new Date(),
        dailyUsage: [],
      };
      this.usageMetrics.set(providerId, metrics);
    }

    // Update metrics
    metrics.totalRequests++;
    metrics.totalTokens += tokens;
    metrics.totalCost += cost;
    metrics.lastUsed = new Date();

    // Update average response time (rolling average)
    const alpha = 0.1;
    metrics.averageResponseTime = alpha * responseTime + (1 - alpha) * metrics.averageResponseTime;

    // Update error rate
    const errorAlpha = 0.05;
    const errorValue = success ? 0 : 1;
    metrics.errorRate = errorAlpha * errorValue + (1 - errorAlpha) * metrics.errorRate;

    // Update daily usage
    const today = new Date().toISOString().split('T')[0];
    let dailyRecord = metrics.dailyUsage.find(d => d.date === today);
    
    if (!dailyRecord) {
      dailyRecord = { date: today, requests: 0, tokens: 0, cost: 0 };
      metrics.dailyUsage.push(dailyRecord);
      
      // Keep only last 30 days
      if (metrics.dailyUsage.length > 30) {
        metrics.dailyUsage = metrics.dailyUsage.slice(-30);
      }
    }
    
    dailyRecord.requests++;
    dailyRecord.tokens += tokens;
    dailyRecord.cost += cost;
  }

  getUsageMetrics(providerId?: string): IUsageMetrics[] {
    if (providerId) {
      const metrics = this.usageMetrics.get(providerId);
      return metrics ? [metrics] : [];
    }
    
    return Array.from(this.usageMetrics.values());
  }

  getProviderRecommendation(request: IAIRequest): {
    primary: string;
    fallback: string[];
    reasoning: string;
  } {
    const isSimpleQuery = request.prompt.length < 100;
    const isCodeQuery = request.prompt.toLowerCase().includes('code') || 
                        request.prompt.toLowerCase().includes('script') ||
                        request.context.command.length > 0;

    let primary = '';
    let reasoning = '';
    const fallback: string[] = [];

    // Determine optimal provider based on query characteristics
    if (isSimpleQuery && this.providers.has('gpt-oss-20b')) {
      primary = 'gpt-oss-20b';
      reasoning = 'Fast local model optimal for simple queries';
      fallback.push('openai-gpt-4o-mini', 'claude-haiku');
    } else if (isCodeQuery && this.providers.has('deepseek-coder')) {
      primary = 'deepseek-coder';
      reasoning = 'DeepSeek Coder specialized for programming tasks';
      fallback.push('qwen-coder', 'claude-sonnet', 'gpt-oss-120b');
    } else if (this.providers.has('claude-sonnet')) {
      primary = 'claude-sonnet';
      reasoning = 'Claude Sonnet provides high-quality, balanced responses';
      fallback.push('gpt-4o', 'gemini-pro', 'gpt-oss-120b');
    } else {
      // Fallback to any available provider
      const available = this.getAvailableProviders();
      if (available.length > 0) {
        primary = available[0].id;
        reasoning = 'Using available provider';
        fallback.push(...available.slice(1, 3).map(p => p.id));
      }
    }

    return { primary, fallback, reasoning };
  }

  // Create selection for successful provider choice
  private createSelection(provider: IAIProvider, request: IAIRequest, reason: string): IProviderSelection {
    return {
      selectedProvider: provider.id,
      reason: reason as any,
      estimatedCost: provider.getCostEstimate(request),
      estimatedResponseTime: this.estimateResponseTime(provider, request),
      alternatives: [],
    };
  }

  clearMetrics(): void {
    this.usageMetrics.clear();
  }

  exportMetrics(): IUsageMetrics[] {
    return Array.from(this.usageMetrics.values());
  }
}