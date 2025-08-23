export interface IAIModelConfig {
  id: string;
  name: string;
  displayName: string;
  type: 'local-onnx' | 'openai' | 'anthropic' | 'google' | 'deepseek' | 'qwen';
  modelPath?: string; // For local models
  apiKey?: string; // For external providers
  baseUrl?: string; // For custom endpoints
  modelName?: string; // Specific model name for API
  maxTokens: number;
  contextLength: number;
  enabled: boolean;
  priority: number; // Higher priority = preferred
  costPer1kTokens?: number; // Cost tracking
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface IAIModelCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  codeGeneration: boolean;
  contextLength: number;
  estimatedSpeed: number; // tokens per second
  memoryRequirement: number; // MB
}

export interface IAIModelStatus {
  id: string;
  status: 'unloaded' | 'loading' | 'ready' | 'error' | 'busy';
  loadTime?: number;
  lastUsed?: Date;
  memoryUsage?: number;
  errorMessage?: string;
  capabilities?: IAIModelCapabilities;
}

export interface IAIPromptContext {
  command: string;
  workingDirectory: string;
  shellType: string;
  recentCommands: string[];
  mcpContext?: any;
  gitContext?: {
    branch: string;
    status: string;
    remotes: string[];
  };
  projectContext?: {
    type: string;
    dependencies: string[];
    structure: string[];
  };
}

export interface IAIRequest {
  prompt: string;
  context: IAIPromptContext;
  model?: string; // Preferred model ID
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface IAIResponse {
  text: string;
  model: string;
  tokens: number;
  responseTime: number;
  cached: boolean;
  suggestions?: string[];
  commands?: string[];
}

export interface IAIProvider {
  id: string;
  name: string;
  type: string;
  isAvailable(): Promise<boolean>;
  initialize(): Promise<void>;
  generateResponse(request: IAIRequest): Promise<IAIResponse>;
  getStatus(): IAIModelStatus;
  getCostEstimate(request: IAIRequest): number;
  getRateLimit(): { requestsPerMinute: number; tokensPerMinute: number } | null;
  destroy(): Promise<void>;
}

export interface IUsageMetrics {
  providerId: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  errorRate: number;
  lastUsed: Date;
  dailyUsage: {
    date: string;
    requests: number;
    tokens: number;
    cost: number;
  }[];
}

export interface IProviderSelection {
  selectedProvider: string;
  reason: 'cost' | 'speed' | 'quality' | 'availability' | 'fallback';
  estimatedCost: number;
  estimatedResponseTime: number;
  alternatives: Array<{
    providerId: string;
    reason: string;
    cost: number;
    responseTime: number;
  }>;
}