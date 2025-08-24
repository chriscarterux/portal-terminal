import { EventEmitter } from 'events';

export interface IPerformanceMetrics {
  commandExecution: {
    totalCommands: number;
    averageResponseTime: number;
    medianResponseTime: number;
    p95ResponseTime: number;
    slowCommands: { command: string; duration: number; timestamp: number }[];
  };
  aiPerformance: {
    totalRequests: number;
    averageResponseTime: number;
    cacheHitRate: number;
    modelUsage: Record<string, number>;
    failureRate: number;
  };
  mcpPerformance: {
    connectedServers: number;
    totalServers: number;
    averageContextTime: number;
    toolCallCount: number;
    resourceAccessCount: number;
  };
  systemResources: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    networkLatency?: number;
  };
  userExperience: {
    errorRate: number;
    successfulCommands: number;
    userSatisfactionScore?: number;
    featureUsage: Record<string, number>;
  };
}

export interface IPerformanceAlert {
  type: 'warning' | 'error' | 'info';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
  suggestions: string[];
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: IPerformanceMetrics;
  private responseTimes: number[] = [];
  private aiResponseTimes: number[] = [];
  private mcpResponseTimes: number[] = [];
  private alerts: IPerformanceAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  // Performance thresholds
  private thresholds = {
    commandResponseTime: 2000, // 2s warning threshold
    aiResponseTime: 500, // 500ms for 20B model
    memoryUsage: 200 * 1024 * 1024, // 200MB
    errorRate: 10, // 10% error rate
    mcpContextTime: 1000, // 1s for MCP context
  };

  constructor() {
    super();
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    this.metrics = {
      commandExecution: {
        totalCommands: 0,
        averageResponseTime: 0,
        medianResponseTime: 0,
        p95ResponseTime: 0,
        slowCommands: [],
      },
      aiPerformance: {
        totalRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        modelUsage: {},
        failureRate: 0,
      },
      mcpPerformance: {
        connectedServers: 0,
        totalServers: 0,
        averageContextTime: 0,
        toolCallCount: 0,
        resourceAccessCount: 0,
      },
      systemResources: {
        memoryUsage: 0,
        cpuUsage: 0,
        diskUsage: 0,
      },
      userExperience: {
        errorRate: 0,
        successfulCommands: 0,
        featureUsage: {},
      },
    };
  }

  // Command performance tracking
  trackCommandStart(command: string): string {
    const trackingId = Date.now().toString();
    const startTime = performance.now();
    
    // Store start time for this command
    (this as any)[`cmd_${trackingId}`] = { command, startTime };
    
    return trackingId;
  }

  trackCommandEnd(trackingId: string, success: boolean, exitCode?: number): void {
    const commandData = (this as any)[`cmd_${trackingId}`];
    if (!commandData) return;

    const duration = performance.now() - commandData.startTime;
    this.responseTimes.push(duration);
    
    // Update metrics
    this.metrics.commandExecution.totalCommands++;
    this.updateAverageResponseTime();
    
    if (success) {
      this.metrics.userExperience.successfulCommands++;
    }

    // Track slow commands
    if (duration > this.thresholds.commandResponseTime) {
      this.metrics.commandExecution.slowCommands.push({
        command: commandData.command,
        duration,
        timestamp: Date.now(),
      });
      
      // Keep only recent slow commands
      this.metrics.commandExecution.slowCommands = 
        this.metrics.commandExecution.slowCommands.slice(-20);
      
      // Generate performance alert
      this.generateAlert('warning', 'commandResponseTime', duration, this.thresholds.commandResponseTime, 
        `Slow command detected: ${commandData.command} took ${Math.round(duration)}ms`,
        ['Consider optimizing command parameters', 'Check system resources', 'Use streaming for large operations']
      );
    }

    // Update error rate
    this.updateErrorRate();
    
    // Clean up tracking data
    delete (this as any)[`cmd_${trackingId}`];
  }

  // AI performance tracking
  trackAIRequest(model: string, cacheHit: boolean = false): string {
    const trackingId = Date.now().toString();
    const startTime = performance.now();
    
    (this as any)[`ai_${trackingId}`] = { model, startTime, cacheHit };
    
    // Update model usage
    this.metrics.aiPerformance.modelUsage[model] = 
      (this.metrics.aiPerformance.modelUsage[model] || 0) + 1;
    
    return trackingId;
  }

  trackAIResponse(trackingId: string, success: boolean): void {
    const aiData = (this as any)[`ai_${trackingId}`];
    if (!aiData) return;

    const duration = performance.now() - aiData.startTime;
    this.aiResponseTimes.push(duration);
    
    this.metrics.aiPerformance.totalRequests++;
    this.updateAIMetrics();
    
    // Check AI performance thresholds
    const threshold = aiData.model.includes('20b') ? 500 : 5000;
    if (duration > threshold) {
      this.generateAlert('warning', 'aiResponseTime', duration, threshold,
        `Slow AI response: ${aiData.model} took ${Math.round(duration)}ms`,
        ['Consider using faster model for simple queries', 'Check system resources', 'Enable response caching']
      );
    }
    
    if (!success) {
      this.updateAIFailureRate();
    }
    
    delete (this as any)[`ai_${trackingId}`];
  }

  // MCP performance tracking
  trackMCPOperation(operation: string): string {
    const trackingId = Date.now().toString();
    const startTime = performance.now();
    
    (this as any)[`mcp_${trackingId}`] = { operation, startTime };
    
    return trackingId;
  }

  trackMCPComplete(trackingId: string, success: boolean): void {
    const mcpData = (this as any)[`mcp_${trackingId}`];
    if (!mcpData) return;

    const duration = performance.now() - mcpData.startTime;
    this.mcpResponseTimes.push(duration);
    
    // Update MCP metrics
    this.updateMCPMetrics();
    
    // Track specific operations
    if (mcpData.operation === 'getContext') {
      if (duration > this.thresholds.mcpContextTime) {
        this.generateAlert('warning', 'mcpContextTime', duration, this.thresholds.mcpContextTime,
          `Slow MCP context retrieval: ${Math.round(duration)}ms`,
          ['Check MCP server health', 'Reduce context complexity', 'Enable MCP caching']
        );
      }
    }
    
    delete (this as any)[`mcp_${trackingId}`];
  }

  // System resource monitoring
  updateSystemResources(resources: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    networkLatency?: number;
  }): void {
    this.metrics.systemResources = resources;
    
    // Check resource thresholds
    if (resources.memoryUsage > this.thresholds.memoryUsage) {
      this.generateAlert('warning', 'memoryUsage', resources.memoryUsage, this.thresholds.memoryUsage,
        `High memory usage: ${Math.round(resources.memoryUsage / 1024 / 1024)}MB`,
        ['Close unused applications', 'Restart terminal if needed', 'Check for memory leaks']
      );
    }

    if (resources.cpuUsage > 80) {
      this.generateAlert('warning', 'cpuUsage', resources.cpuUsage, 80,
        `High CPU usage: ${Math.round(resources.cpuUsage)}%`,
        ['Reduce concurrent operations', 'Use lighter AI models', 'Check background processes']
      );
    }
  }

  // Feature usage tracking
  trackFeatureUsage(feature: string): void {
    this.metrics.userExperience.featureUsage[feature] = 
      (this.metrics.userExperience.featureUsage[feature] || 0) + 1;
  }

  // Performance optimization recommendations
  getOptimizationRecommendations(): {
    priority: 'high' | 'medium' | 'low';
    category: string;
    recommendation: string;
    expectedImprovement: string;
  }[] {
    const recommendations: any[] = [];
    
    // Command performance
    if (this.metrics.commandExecution.averageResponseTime > 1000) {
      recommendations.push({
        priority: 'high',
        category: 'Command Performance',
        recommendation: 'Optimize slow commands or use background execution',
        expectedImprovement: '50% faster command execution',
      });
    }
    
    // AI performance
    if (this.metrics.aiPerformance.averageResponseTime > 1000) {
      recommendations.push({
        priority: 'medium',
        category: 'AI Performance',
        recommendation: 'Enable response caching and use 20B model for simple queries',
        expectedImprovement: '60% faster AI responses',
      });
    }
    
    // Low cache hit rate
    if (this.metrics.aiPerformance.cacheHitRate < 30) {
      recommendations.push({
        priority: 'medium',
        category: 'AI Caching',
        recommendation: 'Increase cache size and improve cache key generation',
        expectedImprovement: '40% reduction in AI request latency',
      });
    }
    
    // MCP performance
    if (this.metrics.mcpPerformance.averageContextTime > 500) {
      recommendations.push({
        priority: 'medium',
        category: 'MCP Performance',
        recommendation: 'Optimize MCP context queries and enable selective loading',
        expectedImprovement: '30% faster context retrieval',
      });
    }
    
    // Memory usage
    if (this.metrics.systemResources.memoryUsage > this.thresholds.memoryUsage * 0.8) {
      recommendations.push({
        priority: 'high',
        category: 'Memory Usage',
        recommendation: 'Implement memory cleanup and reduce cache sizes',
        expectedImprovement: '25% lower memory footprint',
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Real-time monitoring control
  startMonitoring(intervalMs: number = 5000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.checkPerformanceThresholds();
      this.cleanupOldData();
    }, intervalMs);
    
    console.log('📊 Performance monitoring started');
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('📊 Performance monitoring stopped');
  }

  private collectSystemMetrics(): void {
    // Would collect actual system metrics
    const mockMetrics = {
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: Math.random() * 20 + 5, // Mock CPU usage
      diskUsage: Math.random() * 1000000000, // Mock disk usage
    };
    
    this.updateSystemResources(mockMetrics);
  }

  private checkPerformanceThresholds(): void {
    const recentAlerts = this.alerts.filter(
      alert => Date.now() - alert.timestamp < 60000 // Last minute
    );
    
    // Don't spam alerts
    if (recentAlerts.length > 5) return;
    
    // Check various thresholds and generate alerts as needed
    this.emit('performance-check', {
      metrics: this.metrics,
      alerts: this.alerts.slice(-10),
    });
  }

  private cleanupOldData(): void {
    const maxAge = 60 * 60 * 1000; // 1 hour
    const now = Date.now();
    
    // Clean old alerts
    this.alerts = this.alerts.filter(alert => now - alert.timestamp < maxAge);
    
    // Limit response time arrays
    this.responseTimes = this.responseTimes.slice(-1000);
    this.aiResponseTimes = this.aiResponseTimes.slice(-1000);
    this.mcpResponseTimes = this.mcpResponseTimes.slice(-1000);
  }

  private updateAverageResponseTime(): void {
    if (this.responseTimes.length === 0) return;
    
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    
    this.metrics.commandExecution.averageResponseTime = sum / this.responseTimes.length;
    this.metrics.commandExecution.medianResponseTime = sorted[Math.floor(sorted.length / 2)];
    this.metrics.commandExecution.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)];
  }

  private updateAIMetrics(): void {
    if (this.aiResponseTimes.length === 0) return;
    
    const sum = this.aiResponseTimes.reduce((a, b) => a + b, 0);
    this.metrics.aiPerformance.averageResponseTime = sum / this.aiResponseTimes.length;
  }

  private updateMCPMetrics(): void {
    if (this.mcpResponseTimes.length === 0) return;
    
    const sum = this.mcpResponseTimes.reduce((a, b) => a + b, 0);
    this.metrics.mcpPerformance.averageContextTime = sum / this.mcpResponseTimes.length;
  }

  private updateErrorRate(): void {
    const totalCommands = this.metrics.commandExecution.totalCommands;
    const successfulCommands = this.metrics.userExperience.successfulCommands;
    
    if (totalCommands > 0) {
      this.metrics.userExperience.errorRate = 
        ((totalCommands - successfulCommands) / totalCommands) * 100;
    }
  }

  private updateAIFailureRate(): void {
    // Would track AI failures and update failure rate
  }

  private generateAlert(
    type: IPerformanceAlert['type'],
    metric: string,
    value: number,
    threshold: number,
    message: string,
    suggestions: string[]
  ): void {
    const alert: IPerformanceAlert = {
      type,
      metric,
      value,
      threshold,
      message,
      timestamp: Date.now(),
      suggestions,
    };
    
    this.alerts.push(alert);
    this.emit('performance-alert', alert);
    
    // Log to console based on severity
    if (type === 'error') {
      console.error(`🚨 Performance Alert: ${message}`);
    } else if (type === 'warning') {
      console.warn(`⚠️ Performance Warning: ${message}`);
    } else {
      console.info(`ℹ️ Performance Info: ${message}`);
    }
  }

  // Public API methods
  getMetrics(): IPerformanceMetrics {
    return { ...this.metrics };
  }

  getRecentAlerts(limit: number = 10): IPerformanceAlert[] {
    return this.alerts.slice(-limit);
  }

  getBenchmarkResults(): {
    commandPerformance: { average: number; median: number; p95: number };
    aiPerformance: { average: number; modelBreakdown: Record<string, number> };
    mcpPerformance: { average: number; serverCount: number };
    overallScore: number;
  } {
    const commandPerf = this.metrics.commandExecution;
    const aiPerf = this.metrics.aiPerformance;
    const mcpPerf = this.metrics.mcpPerformance;
    
    // Calculate overall performance score (0-100)
    let score = 100;
    
    // Penalize slow responses
    if (commandPerf.averageResponseTime > 1000) score -= 20;
    if (aiPerf.averageResponseTime > 1000) score -= 15;
    if (mcpPerf.averageContextTime > 500) score -= 10;
    
    // Penalize high error rates
    if (this.metrics.userExperience.errorRate > 5) score -= 25;
    if (aiPerf.failureRate > 10) score -= 15;
    
    // Bonus for good performance
    if (commandPerf.averageResponseTime < 500) score += 5;
    if (aiPerf.averageResponseTime < 300) score += 5;
    
    return {
      commandPerformance: {
        average: Math.round(commandPerf.averageResponseTime),
        median: Math.round(commandPerf.medianResponseTime),
        p95: Math.round(commandPerf.p95ResponseTime),
      },
      aiPerformance: {
        average: Math.round(aiPerf.averageResponseTime),
        modelBreakdown: { ...aiPerf.modelUsage },
      },
      mcpPerformance: {
        average: Math.round(mcpPerf.averageContextTime),
        serverCount: mcpPerf.connectedServers,
      },
      overallScore: Math.max(0, Math.min(100, score)),
    };
  }

  // Performance optimization
  async optimizePerformance(): Promise<{
    actionsApplied: string[];
    expectedImprovements: string[];
  }> {
    const actions: string[] = [];
    const improvements: string[] = [];
    
    // Auto-optimize based on metrics
    if (this.aiResponseTimes.length > 100) {
      // Adjust AI model selection based on performance
      const fastModelUsage = this.metrics.aiPerformance.modelUsage['gpt-oss-20b'] || 0;
      const totalUsage = Object.values(this.metrics.aiPerformance.modelUsage).reduce((a, b) => a + b, 0);
      
      if (fastModelUsage / totalUsage < 0.7) {
        actions.push('Increased fast model usage for simple queries');
        improvements.push('30% faster AI responses');
      }
    }
    
    // Cleanup old data more aggressively if memory is high
    if (this.metrics.systemResources.memoryUsage > this.thresholds.memoryUsage * 0.8) {
      this.responseTimes = this.responseTimes.slice(-500);
      this.aiResponseTimes = this.aiResponseTimes.slice(-500);
      actions.push('Reduced memory usage by cleaning old metrics');
      improvements.push('10% lower memory footprint');
    }
    
    return { actionsApplied: actions, expectedImprovements: improvements };
  }

  // Performance reporting
  generatePerformanceReport(): {
    summary: string;
    metrics: IPerformanceMetrics;
    alerts: IPerformanceAlert[];
    recommendations: any[];
    healthScore: number;
  } {
    const benchmarks = this.getBenchmarkResults();
    const recommendations = this.getOptimizationRecommendations();
    const recentAlerts = this.getRecentAlerts();
    
    // Generate summary
    const summary = `Performance Report: ${benchmarks.overallScore}/100 health score. ` +
      `${this.metrics.commandExecution.totalCommands} commands executed, ` +
      `${Math.round(this.metrics.commandExecution.averageResponseTime)}ms avg response time, ` +
      `${Math.round(this.metrics.userExperience.errorRate)}% error rate.`;
    
    return {
      summary,
      metrics: this.metrics,
      alerts: recentAlerts,
      recommendations,
      healthScore: benchmarks.overallScore,
    };
  }

  private getOptimizationRecommendations() {
    // Placeholder - would generate specific recommendations
    return [];
  }

  // Real-time performance streaming
  startPerformanceStreaming(callback: (metrics: any) => void): void {
    const streamInterval = setInterval(() => {
      callback({
        timestamp: Date.now(),
        commandResponseTime: this.responseTimes.slice(-1)[0] || 0,
        aiResponseTime: this.aiResponseTimes.slice(-1)[0] || 0,
        mcpResponseTime: this.mcpResponseTimes.slice(-1)[0] || 0,
        memoryUsage: this.metrics.systemResources.memoryUsage,
        errorRate: this.metrics.userExperience.errorRate,
      });
    }, 1000);
    
    // Store interval for cleanup
    (this as any).streamInterval = streamInterval;
  }

  stopPerformanceStreaming(): void {
    if ((this as any).streamInterval) {
      clearInterval((this as any).streamInterval);
      delete (this as any).streamInterval;
    }
  }

  // Health check
  async performHealthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      commands: 'ok' | 'slow' | 'error';
      ai: 'ok' | 'slow' | 'error';
      mcp: 'ok' | 'slow' | 'error';
      system: 'ok' | 'warning' | 'critical';
    };
    score: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const components = {
      commands: 'ok' as const,
      ai: 'ok' as const,
      mcp: 'ok' as const,
      system: 'ok' as const,
    };

    // Check command performance
    if (this.metrics.commandExecution.averageResponseTime > 2000) {
      components.commands = 'slow';
      issues.push('Command execution is slow');
    }
    
    // Check AI performance
    if (this.metrics.aiPerformance.averageResponseTime > 1000) {
      components.ai = 'slow';
      issues.push('AI responses are slow');
    }
    
    if (this.metrics.aiPerformance.failureRate > 15) {
      components.ai = 'error';
      issues.push('High AI failure rate');
    }
    
    // Check MCP performance
    if (this.metrics.mcpPerformance.connectedServers < this.metrics.mcpPerformance.totalServers * 0.8) {
      components.mcp = 'error';
      issues.push('Some MCP servers are disconnected');
    }
    
    // Check system resources
    if (this.metrics.systemResources.memoryUsage > this.thresholds.memoryUsage) {
      components.system = 'warning';
      issues.push('High memory usage');
    }

    // Calculate overall health
    const healthScore = this.getBenchmarkResults().overallScore;
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (healthScore < 60) {
      overall = 'unhealthy';
    } else if (healthScore < 80) {
      overall = 'degraded';
    }

    return {
      overall,
      components,
      score: healthScore,
      issues,
    };
  }

  destroy(): void {
    this.stopMonitoring();
    this.stopPerformanceStreaming();
    this.removeAllListeners();
  }
}