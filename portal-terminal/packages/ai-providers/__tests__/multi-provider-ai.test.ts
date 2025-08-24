import { MultiProviderAI } from '../src/multi-provider-ai';
import { EventEmitter } from 'events';

// Mock the provider classes
jest.mock('../src/providers/openai-provider', () => ({
  OpenAIProvider: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    generateResponse: jest.fn().mockResolvedValue({
      content: 'Mock AI response',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      cost: 0.001,
    }),
    isAvailable: jest.fn().mockReturnValue(true),
    getModelInfo: jest.fn().mockReturnValue({ id: 'gpt-4o', name: 'GPT-4o' }),
  })),
}));

jest.mock('../src/providers/claude-provider', () => ({
  ClaudeProvider: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    generateResponse: jest.fn().mockResolvedValue({
      content: 'Mock Claude response',
      usage: { promptTokens: 15, completionTokens: 25, totalTokens: 40 },
      cost: 0.003,
    }),
    isAvailable: jest.fn().mockReturnValue(true),
    getModelInfo: jest.fn().mockReturnValue({ id: 'claude-3-sonnet', name: 'Claude 3 Sonnet' }),
  })),
}));

jest.mock('../src/local-onnx-provider', () => ({
  LocalONNXProvider: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    generateResponse: jest.fn().mockResolvedValue({
      content: 'Mock local AI response',
      usage: { promptTokens: 12, completionTokens: 18, totalTokens: 30 },
      cost: 0, // Local models are free
    }),
    isAvailable: jest.fn().mockReturnValue(true),
    getModelInfo: jest.fn().mockReturnValue({ id: 'gpt-oss-20b', name: 'GPT-OSS-20B' }),
  })),
}));

describe('MultiProviderAI', () => {
  let multiProviderAI: MultiProviderAI;

  beforeEach(() => {
    multiProviderAI = new MultiProviderAI({
      enabledProviders: ['openai', 'claude', 'local-onnx'],
      defaultSelectionCriteria: {
        prioritizeSpeed: true,
        maxResponseTime: 500,
        maxCostPerRequest: 0.01,
      },
      budgetLimits: {
        openai: { daily: 5, weekly: 20, monthly: 50 },
        claude: { daily: 3, weekly: 15, monthly: 30 },
      },
      persistUsage: false,
    });
  });

  afterEach(async () => {
    await multiProviderAI.shutdown();
  });

  describe('initialization', () => {
    it('should initialize all enabled providers', async () => {
      await multiProviderAI.initialize();
      
      const status = multiProviderAI.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.availableProviders.length).toBeGreaterThan(0);
    });

    it('should handle provider initialization failures gracefully', async () => {
      // Mock one provider to fail
      const mockProvider = require('../src/providers/openai-provider').OpenAIProvider;
      mockProvider.mockImplementationOnce(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('API key invalid')),
        isAvailable: jest.fn().mockReturnValue(false),
      }));

      const failingAI = new MultiProviderAI({
        enabledProviders: ['openai', 'claude'],
        defaultSelectionCriteria: { prioritizeSpeed: true },
      });

      await failingAI.initialize();
      
      const status = failingAI.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.failedProviders.length).toBeGreaterThan(0);
      
      await failingAI.shutdown();
    });
  });

  describe('provider selection', () => {
    beforeEach(async () => {
      await multiProviderAI.initialize();
    });

    it('should select fastest provider for speed-prioritized requests', async () => {
      const request = {
        prompt: 'Quick help with git command',
        context: { command: 'git status' },
      };

      const selection = multiProviderAI.selectProvider(request, {
        prioritizeSpeed: true,
        maxResponseTime: 500,
      });

      // Should prefer local model for speed
      expect(selection.providerId).toBe('local-onnx');
      expect(selection.estimatedResponseTime).toBeLessThan(500);
    });

    it('should select quality provider for complex requests', async () => {
      const request = {
        prompt: 'Help me debug this complex webpack configuration error with multiple build targets and optimization issues',
        context: { command: 'npm run build', error: 'Complex error...' },
      };

      const selection = multiProviderAI.selectProvider(request, {
        prioritizeQuality: true,
        maxResponseTime: 10000,
        maxCostPerRequest: 0.01,
      });

      // Should prefer Claude or GPT-4 for complex queries
      expect(['claude', 'openai']).toContain(selection.providerId);
      expect(selection.estimatedCost).toBeLessThanOrEqual(0.01);
    });

    it('should respect budget constraints', async () => {
      // Simulate budget exhaustion
      multiProviderAI['usageTracker'].recordUsage('openai', {
        promptTokens: 100000,
        completionTokens: 100000,
        totalTokens: 200000,
        cost: 10, // Exceed daily budget
      });

      const request = {
        prompt: 'Test request',
        context: {},
      };

      const selection = multiProviderAI.selectProvider(request, {
        maxCostPerRequest: 0.01,
      });

      // Should not select OpenAI due to budget
      expect(selection.providerId).not.toBe('openai');
    });
  });

  describe('response generation', () => {
    beforeEach(async () => {
      await multiProviderAI.initialize();
    });

    it('should generate response using selected provider', async () => {
      const request = {
        prompt: 'Explain git status command',
        context: { command: 'git status' },
      };

      const response = await multiProviderAI.generateResponse(request);

      expect(response.content).toBeDefined();
      expect(response.providerId).toBeDefined();
      expect(response.responseTime).toBeGreaterThan(0);
      expect(response.usage).toBeDefined();
    });

    it('should fallback to alternative provider on failure', async () => {
      // Mock primary provider to fail
      const mockLocalProvider = require('../src/local-onnx-provider').LocalONNXProvider;
      mockLocalProvider.mockImplementationOnce(() => ({
        initialize: jest.fn().mockResolvedValue(true),
        generateResponse: jest.fn().mockRejectedValue(new Error('Model not loaded')),
        isAvailable: jest.fn().mockReturnValue(true),
        getModelInfo: jest.fn().mockReturnValue({ id: 'gpt-oss-20b' }),
      }));

      const aiWithFailingLocal = new MultiProviderAI({
        enabledProviders: ['local-onnx', 'openai', 'claude'],
        defaultSelectionCriteria: { prioritizeSpeed: true },
      });

      await aiWithFailingLocal.initialize();

      const request = {
        prompt: 'Test request',
        context: {},
      };

      const response = await aiWithFailingLocal.generateResponse(request);

      // Should fallback to working provider
      expect(response.content).toBeDefined();
      expect(['openai', 'claude']).toContain(response.providerId);
      
      await aiWithFailingLocal.shutdown();
    });

    it('should track usage and costs', async () => {
      const request = {
        prompt: 'Test request for usage tracking',
        context: {},
      };

      const initialUsage = multiProviderAI.getUsageReport();
      await multiProviderAI.generateResponse(request);
      const finalUsage = multiProviderAI.getUsageReport();

      expect(finalUsage.totalRequests).toBe(initialUsage.totalRequests + 1);
      expect(finalUsage.totalCost).toBeGreaterThanOrEqual(initialUsage.totalCost);
    });
  });

  describe('performance optimization', () => {
    beforeEach(async () => {
      await multiProviderAI.initialize();
    });

    it('should meet response time targets', async () => {
      const request = {
        prompt: 'Quick command help',
        context: { command: 'ls' },
      };

      const startTime = Date.now();
      const response = await multiProviderAI.generateResponse(request, {
        prioritizeSpeed: true,
        maxResponseTime: 500,
      });
      const actualTime = Date.now() - startTime;

      // Should meet target (with some buffer for test execution)
      expect(actualTime).toBeLessThan(1000);
      expect(response.responseTime).toBeLessThan(600);
    });

    it('should optimize request parameters based on criteria', async () => {
      const speedRequest = {
        prompt: 'Quick help',
        maxTokens: 1000, // Will be reduced for speed
        temperature: 0.8, // Will be reduced for speed
      };

      const qualityRequest = {
        prompt: 'Complex analysis needed',
        maxTokens: 100, // Will be increased for quality
        temperature: 0.1, // Will be increased for creativity
      };

      const speedResponse = await multiProviderAI.generateResponse(speedRequest, {
        prioritizeSpeed: true,
        maxResponseTime: 500,
      });

      const qualityResponse = await multiProviderAI.generateResponse(qualityRequest, {
        prioritizeQuality: true,
        maxResponseTime: 5000,
      });

      expect(speedResponse.responseTime).toBeLessThan(qualityResponse.responseTime);
    });
  });

  describe('error handling and resilience', () => {
    beforeEach(async () => {
      await multiProviderAI.initialize();
    });

    it('should handle network errors gracefully', async () => {
      // Mock network error
      const mockProvider = require('../src/providers/openai-provider').OpenAIProvider;
      mockProvider.mockImplementationOnce(() => ({
        initialize: jest.fn().mockResolvedValue(true),
        generateResponse: jest.fn().mockRejectedValue(new Error('Network timeout')),
        isAvailable: jest.fn().mockReturnValue(true),
        getModelInfo: jest.fn().mockReturnValue({ id: 'gpt-4o' }),
      }));

      const networkErrorAI = new MultiProviderAI({
        enabledProviders: ['openai', 'claude'],
        defaultSelectionCriteria: { prioritizeSpeed: true },
      });

      await networkErrorAI.initialize();

      const request = {
        prompt: 'Test request',
        context: {},
      };

      const response = await networkErrorAI.generateResponse(request);
      
      // Should fallback to working provider
      expect(response.content).toBeDefined();
      expect(response.providerId).toBe('claude');
      
      await networkErrorAI.shutdown();
    });

    it('should emit budget alerts when approaching limits', async () => {
      let budgetAlert: any = null;
      
      multiProviderAI.on('budgetAlert', (alert) => {
        budgetAlert = alert;
      });

      // Simulate high usage to trigger alert
      multiProviderAI['usageTracker'].recordUsage('openai', {
        promptTokens: 50000,
        completionTokens: 50000,
        totalTokens: 100000,
        cost: 4, // 80% of daily budget
      });

      // Generate one more request to trigger alert
      const request = {
        prompt: 'Test request',
        context: {},
      };

      await multiProviderAI.generateResponse(request);

      expect(budgetAlert).toBeDefined();
      expect(budgetAlert.providerId).toBe('openai');
      expect(budgetAlert.type).toBe('daily');
      expect(budgetAlert.percentageUsed).toBeGreaterThan(80);
    });
  });

  describe('context integration', () => {
    beforeEach(async () => {
      await multiProviderAI.initialize();
    });

    it('should enhance requests with terminal context', async () => {
      const request = {
        prompt: 'Help with this command',
        context: {
          command: 'git status',
          workingDirectory: '/Users/test/project',
          shellType: 'zsh',
          recentCommands: ['git add .', 'git commit -m "fix"'],
          lastOutput: 'Changes not staged for commit',
        },
      };

      const response = await multiProviderAI.generateResponse(request);

      expect(response.content).toBeDefined();
      expect(response.contextUsed).toBe(true);
      expect(response.enhancedPrompt).toContain('git status');
    });

    it('should adapt responses based on shell type', async () => {
      const bashRequest = {
        prompt: 'List files',
        context: { shellType: 'bash', command: 'ls' },
      };

      const powershellRequest = {
        prompt: 'List files',
        context: { shellType: 'powershell', command: 'Get-ChildItem' },
      };

      const bashResponse = await multiProviderAI.generateResponse(bashRequest);
      const powershellResponse = await multiProviderAI.generateResponse(powershellRequest);

      expect(bashResponse.content).toBeDefined();
      expect(powershellResponse.content).toBeDefined();
      
      // Responses should be tailored to shell context
      expect(bashResponse.enhancedPrompt).toContain('bash');
      expect(powershellResponse.enhancedPrompt).toContain('powershell');
    });
  });
});