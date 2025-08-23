import * as os from 'os';
import { IAIModelConfig, IAIRequest } from './types';

export interface IPerformanceProfile {
  modelId: string;
  targetResponseTime: number; // milliseconds
  maxMemoryUsage: number; // MB
  threadCount: number;
  batchSize: number;
  cacheStrategy: 'none' | 'lru' | 'aggressive';
}

export class PerformanceOptimizer {
  private profiles = new Map<string, IPerformanceProfile>();
  private systemInfo: any;

  constructor() {
    this.systemInfo = this.analyzeSystem();
    this.initializeProfiles();
  }

  private analyzeSystem(): any {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    
    return {
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || 'unknown',
      totalMemoryGB: Math.round(totalMemory / (1024 * 1024 * 1024)),
      freeMemoryGB: Math.round(freeMemory / (1024 * 1024 * 1024)),
      platform: os.platform(),
      arch: os.arch(),
      hasGPU: this.detectGPU(),
    };
  }

  private detectGPU(): boolean {
    // Simple GPU detection (would be enhanced with proper detection)
    return process.platform === 'darwin' || // macOS has Metal
           process.env.CUDA_VISIBLE_DEVICES !== undefined || // NVIDIA
           process.env.ROCm_VISIBLE_DEVICES !== undefined; // AMD
  }

  private initializeProfiles(): void {
    // Profile for GPT-OSS-20B: Optimized for <500ms response time
    this.profiles.set('gpt-oss-20b', {
      modelId: 'gpt-oss-20b',
      targetResponseTime: 400, // 400ms target for safety margin
      maxMemoryUsage: 8000, // 8GB
      threadCount: Math.min(this.systemInfo.cpuCount, 8),
      batchSize: 1, // Single request for lowest latency
      cacheStrategy: 'aggressive',
    });

    // Profile for GPT-OSS-120B: Optimized for quality over speed
    this.profiles.set('gpt-oss-120b', {
      modelId: 'gpt-oss-120b',
      targetResponseTime: 4000, // 4 second target
      maxMemoryUsage: 32000, // 32GB
      threadCount: Math.min(this.systemInfo.cpuCount, 4), // Fewer threads to avoid memory pressure
      batchSize: 1,
      cacheStrategy: 'lru',
    });
  }

  getOptimalProfile(modelId: string): IPerformanceProfile {
    const profile = this.profiles.get(modelId);
    if (!profile) {
      // Create default profile
      return {
        modelId,
        targetResponseTime: 2000,
        maxMemoryUsage: 4000,
        threadCount: Math.min(this.systemInfo.cpuCount, 4),
        batchSize: 1,
        cacheStrategy: 'lru',
      };
    }

    // Adjust profile based on system capabilities
    return this.adjustProfileForSystem(profile);
  }

  private adjustProfileForSystem(profile: IPerformanceProfile): IPerformanceProfile {
    const adjusted = { ...profile };

    // Reduce memory usage if system has limited RAM
    if (this.systemInfo.totalMemoryGB < 16) {
      adjusted.maxMemoryUsage = Math.min(adjusted.maxMemoryUsage, 4000);
      adjusted.threadCount = Math.min(adjusted.threadCount, 2);
    }

    // Increase thread count if we have many cores and enough memory
    if (this.systemInfo.cpuCount > 8 && this.systemInfo.totalMemoryGB > 32) {
      adjusted.threadCount = Math.min(this.systemInfo.cpuCount, 12);
    }

    // Adjust for GPU availability
    if (this.systemInfo.hasGPU) {
      adjusted.targetResponseTime = Math.round(adjusted.targetResponseTime * 0.7); // 30% faster with GPU
    }

    return adjusted;
  }

  optimizeRequest(request: IAIRequest, modelId: string): IAIRequest {
    const profile = this.getOptimalProfile(modelId);
    
    return {
      ...request,
      maxTokens: this.calculateOptimalTokens(request, profile),
      temperature: this.adjustTemperature(request, profile),
    };
  }

  private calculateOptimalTokens(request: IAIRequest, profile: IPerformanceProfile): number {
    // For fast models (20B), limit tokens for speed
    if (profile.targetResponseTime < 500) {
      return Math.min(request.maxTokens || 256, 256);
    }
    
    // For quality models (120B), allow more tokens
    return Math.min(request.maxTokens || 512, 1024);
  }

  private adjustTemperature(request: IAIRequest, profile: IPerformanceProfile): number {
    // Lower temperature for faster, more deterministic responses
    if (profile.targetResponseTime < 500) {
      return Math.min(request.temperature || 0.3, 0.3);
    }
    
    return request.temperature || 0.7;
  }

  getONNXSessionOptions(modelId: string): any {
    const profile = this.getOptimalProfile(modelId);
    
    return {
      executionProviders: this.getExecutionProviders(),
      graphOptimizationLevel: 'all',
      enableCpuMemArena: true,
      enableMemPattern: true,
      executionMode: 'sequential',
      interOpNumThreads: profile.threadCount,
      intraOpNumThreads: profile.threadCount,
      
      // Performance-specific options
      ...(profile.targetResponseTime < 500 && {
        // Optimize for speed
        enableProfiling: false,
        optimizedModelFilePath: undefined, // Don't save optimized model for speed
      }),
      
      ...(profile.targetResponseTime >= 1000 && {
        // Optimize for quality
        enableProfiling: true,
        optimizedModelFilePath: `./cache/${modelId}-optimized.onnx`,
      }),
    };
  }

  private getExecutionProviders(): string[] {
    const providers = [];
    
    // Add GPU providers based on platform
    if (this.systemInfo.hasGPU) {
      if (process.platform === 'darwin') {
        providers.push('coreml');
      } else if (process.platform === 'win32') {
        providers.push('dml'); // DirectML for Windows
      }
      providers.push('cuda'); // NVIDIA CUDA
    }
    
    // Always include CPU as fallback
    providers.push('cpu');
    
    return providers;
  }

  benchmarkModel(modelId: string): {
    recommendedSettings: IPerformanceProfile;
    warnings: string[];
  } {
    const profile = this.getOptimalProfile(modelId);
    const warnings: string[] = [];

    // Check memory requirements
    if (profile.maxMemoryUsage > this.systemInfo.totalMemoryGB * 1024 * 0.8) {
      warnings.push(`Model requires ${Math.round(profile.maxMemoryUsage/1024)}GB RAM, but only ${this.systemInfo.totalMemoryGB}GB available`);
    }

    // Check performance expectations
    if (!this.systemInfo.hasGPU && modelId.includes('120b')) {
      warnings.push('120B model will be slow without GPU acceleration');
    }

    if (this.systemInfo.cpuCount < 4 && modelId.includes('20b')) {
      warnings.push('20B model performance may be limited with fewer than 4 CPU cores');
    }

    return {
      recommendedSettings: profile,
      warnings,
    };
  }

  getSystemCapabilities(): {
    canRun20B: boolean;
    canRun120B: boolean;
    estimatedSpeed20B: number;
    estimatedSpeed120B: number;
    recommendations: string[];
  } {
    const can20B = this.systemInfo.totalMemoryGB >= 8;
    const can120B = this.systemInfo.totalMemoryGB >= 32;
    
    // Estimate speeds based on system specs
    let speed20B = 5; // base tokens/sec
    let speed120B = 1; // base tokens/sec
    
    if (this.systemInfo.hasGPU) {
      speed20B *= 3;
      speed120B *= 2;
    }
    
    if (this.systemInfo.cpuCount > 8) {
      speed20B *= 1.5;
      speed120B *= 1.3;
    }

    const recommendations: string[] = [];
    
    if (!can120B && can20B) {
      recommendations.push('Use GPT-OSS-20B for best performance on this system');
    }
    
    if (!this.systemInfo.hasGPU) {
      recommendations.push('Consider GPU acceleration for significant performance gains');
    }
    
    if (this.systemInfo.freeMemoryGB < 4) {
      recommendations.push('Close other applications to free memory for AI models');
    }

    return {
      canRun20B: can20B,
      canRun120B: can120B,
      estimatedSpeed20B: Math.round(speed20B),
      estimatedSpeed120B: Math.round(speed120B),
      recommendations,
    };
  }

  // Method to monitor and adjust performance in real-time
  adjustProfileBasedOnPerformance(modelId: string, actualResponseTime: number): void {
    const profile = this.profiles.get(modelId);
    if (!profile) return;

    // If response time is too slow, adjust settings
    if (actualResponseTime > profile.targetResponseTime * 1.5) {
      // Reduce thread count to avoid contention
      profile.threadCount = Math.max(1, profile.threadCount - 1);
      
      // Reduce batch size
      profile.batchSize = 1;
      
      console.log(`⚡ Adjusted performance profile for ${modelId} due to slow response`);
    }
    
    // If response time is very fast, we can potentially increase quality
    if (actualResponseTime < profile.targetResponseTime * 0.5) {
      profile.threadCount = Math.min(this.systemInfo.cpuCount, profile.threadCount + 1);
    }
  }
}