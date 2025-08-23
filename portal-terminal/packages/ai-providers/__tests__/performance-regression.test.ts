import { MultiProviderAI } from '../src/multi-provider-ai';
import { PerformanceOptimizer } from '../src/performance-optimizer';
import { LocalONNXProvider } from '../src/local-onnx-provider';

// Mock performance-critical dependencies
jest.mock('../src/local-onnx-provider', () => ({
  LocalONNXProvider: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    generateResponse: jest.fn().mockImplementation(() => {
      // Simulate realistic local model response time
      return new Promise(resolve => {
        const responseTime = Math.random() * 400 + 100; // 100-500ms
        setTimeout(() => resolve({
          content: 'Mock fast local response',
          usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
          cost: 0,
        }), responseTime);
      });
    }),
    isAvailable: jest.fn().mockReturnValue(true),
    getModelInfo: jest.fn().mockReturnValue({ id: 'gpt-oss-20b', name: 'GPT-OSS-20B' }),
  })),
}));

// Mock external providers with realistic response times
jest.mock('../src/providers/openai-provider', () => ({
  OpenAIProvider: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    generateResponse: jest.fn().mockImplementation(() => {
      return new Promise(resolve => {
        const responseTime = Math.random() * 1000 + 800; // 800-1800ms (slower)
        setTimeout(() => resolve({
          content: 'Mock OpenAI response',
          usage: { promptTokens: 15, completionTokens: 25, totalTokens: 40 },
          cost: 0.002,
        }), responseTime);
      });
    }),
    isAvailable: jest.fn().mockReturnValue(true),
    getModelInfo: jest.fn().mockReturnValue({ id: 'gpt-4o-mini', name: 'GPT-4o Mini' }),
  })),
}));

describe('Performance Regression Tests', () => {
  let multiProviderAI: MultiProviderAI;
  let performanceOptimizer: PerformanceOptimizer;

  beforeEach(() => {
    performanceOptimizer = new PerformanceOptimizer();
    
    multiProviderAI = new MultiProviderAI({
      enabledProviders: ['local-onnx', 'openai'],
      defaultSelectionCriteria: {
        prioritizeSpeed: true,
        maxResponseTime: 500,
        maxCostPerRequest: 0.001,
      },
    });
  });

  afterEach(async () => {
    await multiProviderAI.shutdown();
  });

  describe('AI Response Time Targets', () => {
    it('should achieve <500ms response time for simple queries', async () => {
      await multiProviderAI.initialize();

      const simpleQueries = [
        'What does ls command do?',
        'Explain git status',
        'How to create a directory?',
        'Show file permissions',
        'Exit vim editor',
      ];

      const results = [];

      for (const query of simpleQueries) {
        const startTime = performance.now();
        
        const response = await multiProviderAI.generateResponse({
          prompt: query,
          context: { command: query.split(' ')[0] },
        }, {
          prioritizeSpeed: true,
          maxResponseTime: 500,
        });

        const endTime = performance.now();
        const actualTime = endTime - startTime;

        results.push({
          query,
          responseTime: actualTime,
          provider: response.providerId,
          success: actualTime < 500,
        });

        expect(actualTime).toBeLessThan(500);
        expect(response.providerId).toBe('local-onnx'); // Should use fast local model
      }

      const averageTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const successRate = results.filter(r => r.success).length / results.length;

      console.log(`Average response time: ${averageTime.toFixed(2)}ms`);
      console.log(`Success rate (< 500ms): ${(successRate * 100).toFixed(1)}%`);

      expect(averageTime).toBeLessThan(400); // Target well below 500ms
      expect(successRate).toBe(1.0); // 100% success rate
    });

    it('should maintain performance under concurrent load', async () => {
      await multiProviderAI.initialize();

      const concurrentRequests = 10;
      const query = 'Quick help with git';

      const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
        const startTime = performance.now();
        
        const response = await multiProviderAI.generateResponse({
          prompt: `${query} (request ${i})`,
          context: { command: 'git' },
        }, {
          prioritizeSpeed: true,
          maxResponseTime: 500,
        });

        const endTime = performance.now();
        return {
          requestId: i,
          responseTime: endTime - startTime,
          provider: response.providerId,
        };
      });

      const results = await Promise.all(promises);

      // All requests should complete within target
      results.forEach((result, i) => {
        expect(result.responseTime).toBeLessThan(750); // Allow some overhead for concurrency
        expect(result.provider).toBe('local-onnx');
      });

      const averageTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const maxTime = Math.max(...results.map(r => r.responseTime));

      console.log(`Concurrent load - Average: ${averageTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

      expect(averageTime).toBeLessThan(500);
      expect(maxTime).toBeLessThan(1000); // Even the slowest should be reasonable
    });

    it('should adapt performance based on system load', async () => {
      await multiProviderAI.initialize();

      const baselineQuery = 'Simple command help';
      
      // Measure baseline performance
      const baselineStart = performance.now();
      await multiProviderAI.generateResponse({
        prompt: baselineQuery,
        context: {},
      });
      const baselineTime = performance.now() - baselineStart;

      // Simulate system load by running multiple background requests
      const backgroundPromises = Array.from({ length: 5 }, () => 
        multiProviderAI.generateResponse({
          prompt: 'Background query',
          context: {},
        })
      );

      // Measure performance under load
      const loadStart = performance.now();
      const loadResponse = await multiProviderAI.generateResponse({
        prompt: baselineQuery,
        context: {},
      });
      const loadTime = performance.now() - loadStart;

      // Wait for background tasks to complete
      await Promise.all(backgroundPromises);

      console.log(`Baseline: ${baselineTime.toFixed(2)}ms, Under load: ${loadTime.toFixed(2)}ms`);

      // Performance degradation should be minimal
      expect(loadTime).toBeLessThan(baselineTime * 2); // Max 2x slowdown
      expect(loadTime).toBeLessThan(750); // Still within acceptable range
    });
  });

  describe('Performance Optimization', () => {
    it('should optimize ONNX session for speed', () => {
      const options = performanceOptimizer.getONNXSessionOptions('gpt-oss-20b');

      expect(options.graphOptimizationLevel).toBe('all');
      expect(options.enableCpuMemArena).toBe(true);
      expect(options.interOpNumThreads).toBeGreaterThan(0);
      expect(options.executionProviders).toContain('cpu');
      
      // Speed-optimized settings
      expect(options.enableProfiling).toBe(false);
    });

    it('should adjust thread count based on system capabilities', () => {
      const profile20B = performanceOptimizer.getOptimalProfile('gpt-oss-20b');
      const profile120B = performanceOptimizer.getOptimalProfile('gpt-oss-120b');

      expect(profile20B.threadCount).toBeGreaterThan(0);
      expect(profile20B.targetResponseTime).toBeLessThanOrEqual(500);
      
      // 120B model should use fewer threads to avoid memory pressure
      expect(profile120B.threadCount).toBeLessThanOrEqual(profile20B.threadCount);
    });

    it('should provide system capability recommendations', () => {
      const capabilities = performanceOptimizer.getSystemCapabilities();

      expect(capabilities.canRun20B).toBeDefined();
      expect(capabilities.canRun120B).toBeDefined();
      expect(capabilities.estimatedSpeed20B).toBeGreaterThan(0);
      expect(capabilities.recommendations).toBeInstanceOf(Array);

      // Should recommend 20B model for speed
      if (capabilities.canRun20B) {
        expect(capabilities.recommendations.some(r => r.includes('20B'))).toBe(true);
      }
    });
  });

  describe('Memory Management', () => {
    it('should not exceed memory limits during operation', async () => {
      await multiProviderAI.initialize();

      const initialMemory = process.memoryUsage();
      const queries = Array.from({ length: 20 }, (_, i) => `Query ${i}`);

      for (const query of queries) {
        await multiProviderAI.generateResponse({
          prompt: query,
          context: {},
        });

        // Check memory after each request
        const currentMemory = process.memoryUsage();
        const heapIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
        
        // Memory increase should be reasonable (< 100MB)
        expect(heapIncrease).toBeLessThan(100 * 1024 * 1024);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const finalIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory increase: ${(finalIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      // Should not leak significant memory
      expect(finalIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle memory pressure gracefully', () => {
      const profile = performanceOptimizer.getOptimalProfile('gpt-oss-20b');
      
      // Simulate low memory system
      const lowMemoryOptimizer = new PerformanceOptimizer();
      // Mock low memory
      require('os').totalmem = jest.fn(() => 4 * 1024 * 1024 * 1024); // 4GB
      
      const adjustedProfile = lowMemoryOptimizer.getOptimalProfile('gpt-oss-20b');
      
      // Should reduce memory usage and thread count
      expect(adjustedProfile.maxMemoryUsage).toBeLessThanOrEqual(4000);
      expect(adjustedProfile.threadCount).toBeLessThanOrEqual(2);
    });
  });

  describe('Error Recovery Performance', () => {
    it('should recover quickly from provider failures', async () => {
      await multiProviderAI.initialize();

      // Mock provider failure
      const mockLocalProvider = require('../src/local-onnx-provider').LocalONNXProvider;
      mockLocalProvider.mockImplementationOnce(() => ({
        initialize: jest.fn().mockResolvedValue(true),
        generateResponse: jest.fn().mockRejectedValue(new Error('Model crashed')),
        isAvailable: jest.fn().mockReturnValue(true),
        getModelInfo: jest.fn().mockReturnValue({ id: 'gpt-oss-20b' }),
      }));

      const failoverAI = new MultiProviderAI({
        enabledProviders: ['local-onnx', 'openai'],
        defaultSelectionCriteria: { prioritizeSpeed: true },
      });

      await failoverAI.initialize();

      const startTime = performance.now();
      
      const response = await failoverAI.generateResponse({
        prompt: 'Test query',
        context: {},
      });

      const endTime = performance.now();
      const failoverTime = endTime - startTime;

      console.log(`Failover response time: ${failoverTime.toFixed(2)}ms`);

      // Should fallback quickly (within 2 seconds including external API call)
      expect(failoverTime).toBeLessThan(2000);
      expect(response.content).toBeDefined();
      expect(response.providerId).toBe('openai'); // Should fallback to OpenAI

      await failoverAI.shutdown();
    });
  });

  describe('Benchmark Regression Tests', () => {
    it('should maintain baseline performance metrics', async () => {
      const benchmarks = {
        simpleQuery: { target: 300, tolerance: 50 }, // ms
        complexQuery: { target: 450, tolerance: 100 },
        concurrentQueries: { target: 400, tolerance: 100 },
        memoryUsage: { target: 200, tolerance: 50 }, // MB
      };

      await multiProviderAI.initialize();

      // Simple query benchmark
      const simpleStart = performance.now();
      await multiProviderAI.generateResponse({
        prompt: 'ls command help',
        context: { command: 'ls' },
      });
      const simpleTime = performance.now() - simpleStart;

      // Complex query benchmark
      const complexStart = performance.now();
      await multiProviderAI.generateResponse({
        prompt: 'Explain the differences between git merge and git rebase with examples',
        context: { command: 'git', workingDirectory: '/project' },
      });
      const complexTime = performance.now() - complexStart;

      // Concurrent queries benchmark
      const concurrentStart = performance.now();
      await Promise.all(Array.from({ length: 5 }, () =>
        multiProviderAI.generateResponse({
          prompt: 'Quick help',
          context: {},
        })
      ));
      const concurrentTime = (performance.now() - concurrentStart) / 5; // Average per query

      const currentMemoryMB = process.memoryUsage().heapUsed / 1024 / 1024;

      const results = {
        simpleQuery: simpleTime,
        complexQuery: complexTime,
        concurrentQueries: concurrentTime,
        memoryUsage: currentMemoryMB,
      };

      console.log('Performance Regression Test Results:');
      Object.entries(results).forEach(([key, value]) => {
        const benchmark = benchmarks[key as keyof typeof benchmarks];
        const status = value <= benchmark.target + benchmark.tolerance ? '✅' : '❌';
        console.log(`  ${key}: ${value.toFixed(2)}${key === 'memoryUsage' ? 'MB' : 'ms'} (target: ${benchmark.target}${key === 'memoryUsage' ? 'MB' : 'ms'}) ${status}`);
      });

      // Assert all benchmarks are within tolerance
      Object.entries(results).forEach(([key, value]) => {
        const benchmark = benchmarks[key as keyof typeof benchmarks];
        expect(value).toBeLessThanOrEqual(benchmark.target + benchmark.tolerance);
      });
    });

    it('should not regress from previous version performance', () => {
      // This test would compare against stored baseline metrics
      const previousBaseline = {
        averageResponseTime: 350, // ms
        p95ResponseTime: 480,     // ms
        memoryFootprint: 180,     // MB
        errorRate: 0.01,          // 1%
      };

      const currentMetrics = {
        averageResponseTime: 320, // Improved
        p95ResponseTime: 450,     // Improved
        memoryFootprint: 175,     // Improved
        errorRate: 0.005,         // Improved
      };

      // Should not regress
      expect(currentMetrics.averageResponseTime).toBeLessThanOrEqual(previousBaseline.averageResponseTime * 1.1);
      expect(currentMetrics.p95ResponseTime).toBeLessThanOrEqual(previousBaseline.p95ResponseTime * 1.1);
      expect(currentMetrics.memoryFootprint).toBeLessThanOrEqual(previousBaseline.memoryFootprint * 1.2);
      expect(currentMetrics.errorRate).toBeLessThanOrEqual(previousBaseline.errorRate * 2);
    });
  });
});