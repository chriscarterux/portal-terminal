import * as ort from 'onnxruntime-node';
import { PerformanceOptimizer } from './performance-optimizer';
import { IAIRequest, IAIResponse, IAIModelConfig } from './types';

export class FastInferenceEngine {
  private session: ort.InferenceSession | null = null;
  private optimizer: PerformanceOptimizer;
  private warmupComplete = false;
  private modelConfig: IAIModelConfig;

  constructor(config: IAIModelConfig) {
    this.modelConfig = config;
    this.optimizer = new PerformanceOptimizer();
  }

  async initialize(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Get optimized session options for this model
      const sessionOptions = this.optimizer.getONNXSessionOptions(this.modelConfig.id);
      
      console.log(`🚀 Loading ${this.modelConfig.name} with optimizations...`);
      this.session = await ort.InferenceSession.create(
        this.modelConfig.modelPath!, 
        sessionOptions
      );
      
      const loadTime = Date.now() - startTime;
      console.log(`✅ ${this.modelConfig.name} loaded in ${loadTime}ms`);
      
      // Perform warmup for consistent performance
      if (this.modelConfig.id.includes('20b')) {
        await this.performWarmup();
      }
      
    } catch (error) {
      console.error(`❌ Failed to load ${this.modelConfig.name}:`, error);
      throw error;
    }
  }

  private async performWarmup(): Promise<void> {
    if (!this.session) return;
    
    console.log(`🔥 Warming up ${this.modelConfig.name}...`);
    const startTime = Date.now();
    
    try {
      // Run several small inferences to warm up the model
      const warmupInputs = [
        [1, 2, 3], // Minimal input
        [1, 2, 3, 4, 5], // Small input
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // Medium input
      ];

      for (const input of warmupInputs) {
        const inputTensor = new ort.Tensor('int64', input, [1, input.length]);
        await this.session.run({ input_ids: inputTensor });
      }
      
      this.warmupComplete = true;
      const warmupTime = Date.now() - startTime;
      console.log(`🔥 Warmup complete in ${warmupTime}ms`);
      
    } catch (error) {
      console.warn(`⚠️  Warmup failed for ${this.modelConfig.name}:`, error);
    }
  }

  async fastInference(tokens: number[], maxNewTokens: number = 50): Promise<{
    tokens: number[];
    responseTime: number;
  }> {
    if (!this.session) {
      throw new Error('Model not loaded');
    }

    const startTime = Date.now();
    
    try {
      // Prepare input tensor with optimized shape
      const inputTensor = new ort.Tensor('int64', tokens, [1, tokens.length]);
      
      // Run inference with minimal overhead
      const outputs = await this.session.run({
        input_ids: inputTensor,
      });

      // Extract output tokens (simplified)
      const outputData = outputs.logits?.data as Float32Array;
      const outputTokens = this.extractTokensFromLogits(outputData, maxNewTokens);
      
      const responseTime = Date.now() - startTime;
      
      // Update performance optimizer with actual timing
      this.optimizer.adjustProfileBasedOnPerformance(this.modelConfig.id, responseTime);
      
      return {
        tokens: outputTokens,
        responseTime,
      };
      
    } catch (error) {
      throw new Error(`Inference failed: ${error}`);
    }
  }

  private extractTokensFromLogits(logits: Float32Array, maxTokens: number): number[] {
    // Simplified token extraction - in real implementation would use proper sampling
    const tokens: number[] = [];
    const vocabSize = 50257; // GPT vocabulary size
    
    for (let i = 0; i < Math.min(maxTokens, logits.length / vocabSize); i++) {
      const startIdx = i * vocabSize;
      let maxIdx = 0;
      let maxValue = logits[startIdx];
      
      // Find token with highest probability
      for (let j = 1; j < vocabSize; j++) {
        if (logits[startIdx + j] > maxValue) {
          maxValue = logits[startIdx + j];
          maxIdx = j;
        }
      }
      
      tokens.push(maxIdx);
      
      // Stop at end-of-sequence token (simplified)
      if (maxIdx === 50256) break;
    }
    
    return tokens;
  }

  async benchmarkPerformance(): Promise<{
    averageResponseTime: number;
    tokensPerSecond: number;
    memoryUsage: number;
    meetsTarget: boolean;
  }> {
    if (!this.session) {
      throw new Error('Model not loaded');
    }

    console.log(`📊 Benchmarking ${this.modelConfig.name}...`);
    
    const testInputs = [
      [1, 2, 3, 4, 5], // Short
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // Medium
      Array.from({ length: 50 }, (_, i) => i + 1), // Long
    ];

    const results: number[] = [];
    let totalTokens = 0;

    for (const input of testInputs) {
      const result = await this.fastInference(input, 20);
      results.push(result.responseTime);
      totalTokens += result.tokens.length;
    }

    const avgResponseTime = results.reduce((sum, time) => sum + time, 0) / results.length;
    const totalTime = results.reduce((sum, time) => sum + time, 0);
    const tokensPerSecond = totalTokens / (totalTime / 1000);
    
    const profile = this.optimizer.getOptimalProfile(this.modelConfig.id);
    const meetsTarget = avgResponseTime <= profile.targetResponseTime;

    console.log(`📊 Benchmark Results for ${this.modelConfig.name}:`);
    console.log(`   Average Response Time: ${Math.round(avgResponseTime)}ms`);
    console.log(`   Tokens per Second: ${Math.round(tokensPerSecond)}`);
    console.log(`   Target Met: ${meetsTarget ? '✅' : '❌'}`);

    return {
      averageResponseTime: avgResponseTime,
      tokensPerSecond,
      memoryUsage: this.estimateMemoryUsage(),
      meetsTarget,
    };
  }

  private estimateMemoryUsage(): number {
    // Simple memory usage estimation
    const memUsage = process.memoryUsage();
    return Math.round(memUsage.heapUsed / (1024 * 1024)); // MB
  }

  isWarmupComplete(): boolean {
    return this.warmupComplete;
  }

  async destroy(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }
    this.warmupComplete = false;
  }

  // Quick health check for the inference engine
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    error?: string;
  }> {
    if (!this.session) {
      return {
        status: 'unhealthy',
        responseTime: 0,
        error: 'Model not loaded',
      };
    }

    try {
      const start = Date.now();
      await this.fastInference([1, 2, 3], 5);
      const responseTime = Date.now() - start;
      
      const profile = this.optimizer.getOptimalProfile(this.modelConfig.id);
      const status = responseTime <= profile.targetResponseTime ? 'healthy' :
                    responseTime <= profile.targetResponseTime * 2 ? 'degraded' : 'unhealthy';
      
      return { status, responseTime };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}