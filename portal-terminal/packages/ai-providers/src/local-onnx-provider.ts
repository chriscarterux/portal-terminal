import * as ort from 'onnxruntime-node';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IAIProvider, IAIRequest, IAIResponse, IAIModelStatus, IAIModelConfig } from './types';

export class LocalONNXProvider implements IAIProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly type = 'local-onnx';
  
  private session: ort.InferenceSession | null = null;
  private tokenizer: any = null; // Will implement tokenizer loading
  private status: IAIModelStatus;
  private loadStartTime: number = 0;

  constructor(private config: IAIModelConfig) {
    this.id = config.id;
    this.name = config.name;
    
    this.status = {
      id: config.id,
      status: 'unloaded',
      capabilities: {
        streaming: false,
        functionCalling: false,
        codeGeneration: true,
        contextLength: config.contextLength,
        estimatedSpeed: config.id.includes('20b') ? 10 : 2, // tokens/sec estimate
        memoryRequirement: config.id.includes('20b') ? 8000 : 32000, // MB estimate
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.modelPath) return false;
    
    try {
      await fs.access(this.config.modelPath);
      return true;
    } catch {
      return false;
    }
  }

  async initialize(): Promise<void> {
    if (!this.config.modelPath || !await this.isAvailable()) {
      throw new Error(`Model file not found: ${this.config.modelPath}`);
    }

    this.status.status = 'loading';
    this.loadStartTime = Date.now();

    try {
      // Configure ONNX Runtime for optimal performance
      const sessionOptions: ort.InferenceSession.SessionOptions = {
        executionProviders: this.getOptimalExecutionProviders(),
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
        executionMode: 'sequential', // Better for single requests
        interOpNumThreads: this.getOptimalThreadCount(),
        intraOpNumThreads: this.getOptimalThreadCount(),
      };

      console.log(`Loading ONNX model: ${this.config.name}`);
      this.session = await ort.InferenceSession.create(this.config.modelPath, sessionOptions);
      
      // Load tokenizer (placeholder - would load actual tokenizer)
      await this.loadTokenizer();
      
      this.status.status = 'ready';
      this.status.loadTime = Date.now() - this.loadStartTime;
      this.status.memoryUsage = this.estimateMemoryUsage();
      
      console.log(`✅ ${this.config.name} loaded in ${this.status.loadTime}ms`);
      
    } catch (error) {
      this.status.status = 'error';
      this.status.errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private getOptimalExecutionProviders(): string[] {
    // Prefer GPU providers for best performance, fallback to CPU
    const providers = [];
    
    // Check for CUDA availability (NVIDIA GPUs)
    providers.push('cuda');
    
    // Check for DirectML (Windows ML)
    if (process.platform === 'win32') {
      providers.push('dml');
    }
    
    // Check for Metal Performance Shaders (macOS/iOS)
    if (process.platform === 'darwin') {
      providers.push('coreml');
    }
    
    // Always include CPU as fallback
    providers.push('cpu');
    
    return providers;
  }

  private getOptimalThreadCount(): number {
    const cpuCount = require('os').cpus().length;
    
    // For 20B model: use more threads for speed
    // For 120B model: use fewer threads to avoid memory pressure
    if (this.config.id.includes('20b')) {
      return Math.min(cpuCount, 8);
    } else {
      return Math.min(cpuCount, 4);
    }
  }

  private async loadTokenizer(): Promise<void> {
    // Placeholder for tokenizer loading
    // In real implementation, would load GPT tokenizer
    this.tokenizer = {
      encode: (text: string) => Array.from({ length: Math.ceil(text.length / 4) }, (_, i) => i),
      decode: (tokens: number[]) => tokens.map(t => String.fromCharCode(65 + (t % 26))).join(''),
    };
  }

  private estimateMemoryUsage(): number {
    // Rough memory usage estimation based on model size
    if (this.config.id.includes('20b')) {
      return 8000; // ~8GB for 20B model
    } else if (this.config.id.includes('120b')) {
      return 32000; // ~32GB for 120B model
    }
    return 1000; // Default
  }

  async generateResponse(request: IAIRequest): Promise<IAIResponse> {
    if (!this.session || this.status.status !== 'ready') {
      throw new Error(`Model ${this.id} not ready`);
    }

    this.status.status = 'busy';
    const startTime = Date.now();

    try {
      // Prepare input prompt
      const prompt = this.buildPrompt(request);
      const tokens = this.tokenizer.encode(prompt);
      
      // Prepare ONNX input tensors
      const inputTensor = new ort.Tensor('int64', tokens, [1, tokens.length]);
      
      // Run inference
      const outputs = await this.session.run({
        input_ids: inputTensor,
        // Add other required inputs based on model architecture
      });

      // Decode output
      const outputTokens = outputs.logits.data as number[];
      const responseText = this.tokenizer.decode(outputTokens);
      
      const responseTime = Date.now() - startTime;
      this.status.status = 'ready';
      this.status.lastUsed = new Date();

      return {
        text: responseText,
        model: this.id,
        tokens: outputTokens.length,
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
    
    // Build context-aware prompt for terminal assistance
    let prompt = `You are an AI assistant helping with terminal commands and development tasks.

Current Context:
- Command: ${context.command}
- Working Directory: ${context.workingDirectory}
- Shell: ${context.shellType}
- Recent Commands: ${context.recentCommands.slice(-3).join(', ')}`;

    if (context.gitContext) {
      prompt += `
- Git Branch: ${context.gitContext.branch}
- Git Status: ${context.gitContext.status}`;
    }

    if (context.projectContext) {
      prompt += `
- Project Type: ${context.projectContext.type}
- Dependencies: ${context.projectContext.dependencies.slice(0, 5).join(', ')}`;
    }

    if (context.mcpContext) {
      prompt += `
- MCP Context: Available tools and resources from connected servers`;
    }

    prompt += `

User Request: ${request.prompt}

Provide a helpful, concise response focused on terminal/development assistance.`;

    return prompt;
  }

  private extractSuggestions(text: string): string[] {
    // Extract actionable suggestions from AI response
    const suggestions: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.includes('try:') || line.includes('consider:') || line.includes('suggestion:')) {
        suggestions.push(line.trim());
      }
    }
    
    return suggestions.slice(0, 3); // Limit to top 3
  }

  private extractCommands(text: string): string[] {
    // Extract potential commands from AI response
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
    
    return commands.slice(0, 3); // Limit to top 3
  }

  getStatus(): IAIModelStatus {
    return { ...this.status };
  }

  async destroy(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }
    
    this.tokenizer = null;
    this.status.status = 'unloaded';
  }

  // Performance monitoring
  async warmup(): Promise<void> {
    if (this.status.status !== 'ready') return;
    
    // Run a small inference to warm up the model
    const warmupRequest: IAIRequest = {
      prompt: 'test',
      context: {
        command: 'echo test',
        workingDirectory: '/tmp',
        shellType: 'bash',
        recentCommands: [],
      },
    };
    
    try {
      await this.generateResponse(warmupRequest);
      console.log(`🔥 ${this.name} warmed up successfully`);
    } catch (error) {
      console.warn(`Failed to warmup ${this.name}:`, error);
    }
  }

  getPerformanceMetrics(): {
    avgResponseTime: number;
    totalRequests: number;
    successRate: number;
    memoryUsage: number;
  } {
    // Placeholder for performance tracking
    return {
      avgResponseTime: this.config.id.includes('20b') ? 400 : 2000,
      totalRequests: 0,
      successRate: 100,
      memoryUsage: this.status.memoryUsage || 0,
    };
  }
}