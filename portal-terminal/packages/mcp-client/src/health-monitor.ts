import { EventEmitter } from 'events';
import { IMCPServerStatus } from './types';

export interface IHealthCheckResult {
  serverId: string;
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: Date;
}

export interface IHealthMetrics {
  serverId: string;
  uptime: number;
  totalChecks: number;
  failedChecks: number;
  averageResponseTime: number;
  lastSuccessfulCheck?: Date;
  lastFailedCheck?: Date;
}

export class HealthMonitor extends EventEmitter {
  private metrics = new Map<string, IHealthMetrics>();
  private checkHistory = new Map<string, IHealthCheckResult[]>();
  private readonly maxHistorySize = 100;

  recordHealthCheck(result: IHealthCheckResult): void {
    this.updateMetrics(result);
    this.updateHistory(result);
    
    this.emit('healthCheck', result);
    
    if (!result.isHealthy) {
      this.emit('healthCheckFailed', result);
    }
  }

  private updateMetrics(result: IHealthCheckResult): void {
    let metrics = this.metrics.get(result.serverId);
    
    if (!metrics) {
      metrics = {
        serverId: result.serverId,
        uptime: 0,
        totalChecks: 0,
        failedChecks: 0,
        averageResponseTime: 0,
        lastSuccessfulCheck: undefined,
        lastFailedCheck: undefined,
      };
      this.metrics.set(result.serverId, metrics);
    }

    metrics.totalChecks++;
    
    if (result.isHealthy) {
      metrics.lastSuccessfulCheck = result.timestamp;
      metrics.uptime = this.calculateUptime(result.serverId);
    } else {
      metrics.failedChecks++;
      metrics.lastFailedCheck = result.timestamp;
    }

    // Update average response time (rolling average)
    const alpha = 0.1; // Smoothing factor
    if (metrics.averageResponseTime === 0) {
      metrics.averageResponseTime = result.responseTime;
    } else {
      metrics.averageResponseTime = 
        alpha * result.responseTime + (1 - alpha) * metrics.averageResponseTime;
    }
  }

  private updateHistory(result: IHealthCheckResult): void {
    let history = this.checkHistory.get(result.serverId);
    
    if (!history) {
      history = [];
      this.checkHistory.set(result.serverId, history);
    }

    history.push(result);
    
    // Keep only recent history
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  private calculateUptime(serverId: string): number {
    const history = this.checkHistory.get(serverId) || [];
    if (history.length === 0) return 0;

    const recentHistory = history.slice(-20); // Last 20 checks
    const successfulChecks = recentHistory.filter(check => check.isHealthy).length;
    
    return (successfulChecks / recentHistory.length) * 100;
  }

  getMetrics(serverId: string): IHealthMetrics | null {
    return this.metrics.get(serverId) || null;
  }

  getAllMetrics(): IHealthMetrics[] {
    return Array.from(this.metrics.values());
  }

  getHealthHistory(serverId: string, limit: number = 20): IHealthCheckResult[] {
    const history = this.checkHistory.get(serverId) || [];
    return history.slice(-limit);
  }

  isServerHealthy(serverId: string): boolean {
    const metrics = this.metrics.get(serverId);
    if (!metrics) return false;

    // Consider server healthy if:
    // 1. Recent uptime > 80%
    // 2. Last check was successful (within reasonable time)
    const recentHistory = this.getHealthHistory(serverId, 10);
    const recentSuccessRate = recentHistory.filter(check => check.isHealthy).length / Math.max(recentHistory.length, 1);
    
    const lastCheck = recentHistory[recentHistory.length - 1];
    const lastCheckRecent = lastCheck && (Date.now() - lastCheck.timestamp.getTime()) < 60000; // Within 1 minute
    
    return recentSuccessRate >= 0.8 && lastCheckRecent && lastCheck.isHealthy;
  }

  getServerHealthSummary(serverId: string): {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    uptime: number;
    averageResponseTime: number;
    lastCheck?: Date;
  } {
    const metrics = this.metrics.get(serverId);
    
    if (!metrics) {
      return {
        status: 'unknown',
        uptime: 0,
        averageResponseTime: 0,
      };
    }

    let status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' = 'unknown';
    
    if (metrics.uptime >= 95) {
      status = 'healthy';
    } else if (metrics.uptime >= 80) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      uptime: metrics.uptime,
      averageResponseTime: metrics.averageResponseTime,
      lastCheck: metrics.lastSuccessfulCheck || metrics.lastFailedCheck,
    };
  }

  clearMetrics(serverId?: string): void {
    if (serverId) {
      this.metrics.delete(serverId);
      this.checkHistory.delete(serverId);
    } else {
      this.metrics.clear();
      this.checkHistory.clear();
    }
  }

  async generateHealthReport(): Promise<{
    timestamp: Date;
    summary: {
      totalServers: number;
      healthyServers: number;
      degradedServers: number;
      unhealthyServers: number;
    };
    servers: Array<{
      serverId: string;
      status: string;
      uptime: number;
      responseTime: number;
      lastCheck?: Date;
    }>;
  }> {
    const allMetrics = this.getAllMetrics();
    const serverSummaries = allMetrics.map(metrics => {
      const summary = this.getServerHealthSummary(metrics.serverId);
      return {
        serverId: metrics.serverId,
        status: summary.status,
        uptime: summary.uptime,
        responseTime: summary.averageResponseTime,
        lastCheck: summary.lastCheck,
      };
    });

    const summary = {
      totalServers: serverSummaries.length,
      healthyServers: serverSummaries.filter(s => s.status === 'healthy').length,
      degradedServers: serverSummaries.filter(s => s.status === 'degraded').length,
      unhealthyServers: serverSummaries.filter(s => s.status === 'unhealthy').length,
    };

    return {
      timestamp: new Date(),
      summary,
      servers: serverSummaries,
    };
  }
}