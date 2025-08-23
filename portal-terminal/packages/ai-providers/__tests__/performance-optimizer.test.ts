import { PerformanceOptimizer } from '../src/performance-optimizer';

// Mock os module
jest.mock('os', () => ({
  cpus: () => Array(8).fill({ model: 'Test CPU' }),
  totalmem: () => 64 * 1024 * 1024 * 1024, // 64GB for 120B support
  freemem: () => 32 * 1024 * 1024 * 1024, // 32GB free
  platform: () => 'darwin',
  arch: () => 'arm64',
}));

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer();
  });

  describe('getOptimalProfile', () => {
    it('should return profile for 20B model optimized for speed', () => {
      const profile = optimizer.getOptimalProfile('gpt-oss-20b');
      
      expect(profile.modelId).toBe('gpt-oss-20b');
      expect(profile.targetResponseTime).toBeLessThanOrEqual(500);
      expect(profile.cacheStrategy).toBe('aggressive');
    });

    it('should return profile for 120B model optimized for quality', () => {
      const profile = optimizer.getOptimalProfile('gpt-oss-120b');
      
      expect(profile.modelId).toBe('gpt-oss-120b');
      expect(profile.targetResponseTime).toBeGreaterThan(1000);
      expect(profile.maxMemoryUsage).toBeGreaterThan(16000);
    });

    it('should create default profile for unknown models', () => {
      const profile = optimizer.getOptimalProfile('unknown-model');
      
      expect(profile.modelId).toBe('unknown-model');
      expect(profile.targetResponseTime).toBe(2000);
      expect(profile.threadCount).toBeGreaterThan(0);
    });
  });

  describe('getSystemCapabilities', () => {
    it('should assess system capabilities correctly', () => {
      const capabilities = optimizer.getSystemCapabilities();
      
      expect(capabilities.canRun20B).toBe(true);
      expect(capabilities.canRun120B).toBe(true);
      expect(capabilities.estimatedSpeed20B).toBeGreaterThan(10);
      expect(capabilities.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('benchmarkModel', () => {
    it('should provide benchmark recommendations', () => {
      const benchmark = optimizer.benchmarkModel('gpt-oss-20b');
      
      expect(benchmark.recommendedSettings).toBeDefined();
      expect(benchmark.warnings).toBeInstanceOf(Array);
      expect(benchmark.recommendedSettings.targetResponseTime).toBeLessThanOrEqual(500);
    });

    it('should warn about insufficient memory', () => {
      // Create new optimizer instance with limited memory by mocking os directly
      const originalTotalmem = require('os').totalmem;
      const originalFreemem = require('os').freemem;
      
      require('os').totalmem = jest.fn(() => 4 * 1024 * 1024 * 1024); // 4GB
      require('os').freemem = jest.fn(() => 2 * 1024 * 1024 * 1024); // 2GB free
      
      const limitedOptimizer = new PerformanceOptimizer();
      const benchmark = limitedOptimizer.benchmarkModel('gpt-oss-120b');
      
      // Restore original functions
      require('os').totalmem = originalTotalmem;
      require('os').freemem = originalFreemem;
      
      expect(benchmark.warnings.length).toBeGreaterThan(0);
      expect(benchmark.warnings[0]).toContain('RAM');
    });
  });

  describe('getONNXSessionOptions', () => {
    it('should return optimized session options', () => {
      const options = optimizer.getONNXSessionOptions('gpt-oss-20b');
      
      expect(options.graphOptimizationLevel).toBe('all');
      expect(options.enableCpuMemArena).toBe(true);
      expect(options.interOpNumThreads).toBeGreaterThan(0);
      expect(options.executionProviders).toContain('cpu');
    });

    it('should include GPU providers on supported platforms', () => {
      const options = optimizer.getONNXSessionOptions('gpt-oss-20b');
      
      // On macOS, should include CoreML
      expect(options.executionProviders).toContain('coreml');
    });
  });

  describe('adjustProfileBasedOnPerformance', () => {
    it('should adjust profile when response time is too slow', () => {
      const initialProfile = optimizer.getOptimalProfile('gpt-oss-20b');
      const initialThreads = initialProfile.threadCount;
      
      // Simulate slow response
      optimizer.adjustProfileBasedOnPerformance('gpt-oss-20b', 1000);
      
      const adjustedProfile = optimizer.getOptimalProfile('gpt-oss-20b');
      expect(adjustedProfile.threadCount).toBeLessThanOrEqual(initialThreads);
    });
  });
});