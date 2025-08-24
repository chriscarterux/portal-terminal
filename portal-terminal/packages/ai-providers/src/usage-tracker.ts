import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { IUsageMetrics, IAIRequest, IAIResponse } from './types';

export interface IUsageReport {
  period: 'today' | 'week' | 'month' | 'all';
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  providerBreakdown: Array<{
    providerId: string;
    requests: number;
    tokens: number;
    cost: number;
    percentage: number;
  }>;
  dailyTrend: Array<{
    date: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
  topCommands: Array<{
    command: string;
    count: number;
    avgCost: number;
  }>;
}

export interface IBudgetAlert {
  type: 'daily' | 'weekly' | 'monthly';
  threshold: number;
  currentUsage: number;
  percentageUsed: number;
  providerId?: string;
}

export class UsageTracker extends EventEmitter {
  private metrics = new Map<string, IUsageMetrics>();
  private commandUsage = new Map<string, { count: number; totalCost: number }>();
  private budgetLimits = new Map<string, { daily: number; weekly: number; monthly: number }>();
  private persistencePath: string;

  constructor(options: { persistencePath?: string; budgets?: Record<string, any> } = {}) {
    super();
    this.persistencePath = options.persistencePath || path.join(process.cwd(), '.portal', 'usage-data.json');
    
    if (options.budgets) {
      for (const [providerId, budget] of Object.entries(options.budgets)) {
        this.budgetLimits.set(providerId, budget as any);
      }
    }

    this.loadPersistedData();
  }

  async trackRequest(
    providerId: string,
    request: IAIRequest,
    response: IAIResponse,
    success: boolean
  ): Promise<void> {
    // Update provider metrics
    this.updateProviderMetrics(providerId, request, response, success);
    
    // Track command usage
    this.updateCommandUsage(request.context.command, response.tokens, this.calculateCost(response));
    
    // Check budget alerts
    await this.checkBudgetAlerts(providerId);
    
    // Persist data
    await this.persistData();
    
    this.emit('usageTracked', {
      providerId,
      tokens: response.tokens,
      cost: this.calculateCost(response),
      responseTime: response.responseTime,
    });
  }

  private updateProviderMetrics(
    providerId: string,
    request: IAIRequest,
    response: IAIResponse,
    success: boolean
  ): void {
    let metrics = this.metrics.get(providerId);
    
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
      this.metrics.set(providerId, metrics);
    }

    // Update counters
    metrics.totalRequests++;
    metrics.totalTokens += response.tokens;
    metrics.totalCost += this.calculateCost(response);
    metrics.lastUsed = new Date();

    // Update rolling averages
    const alpha = 0.1; // Smoothing factor
    metrics.averageResponseTime = alpha * response.responseTime + (1 - alpha) * metrics.averageResponseTime;
    
    const errorAlpha = 0.05;
    metrics.errorRate = errorAlpha * (success ? 0 : 1) + (1 - errorAlpha) * metrics.errorRate;

    // Update daily usage
    this.updateDailyUsage(metrics, response.tokens, this.calculateCost(response));
  }

  private updateDailyUsage(metrics: IUsageMetrics, tokens: number, cost: number): void {
    const today = new Date().toISOString().split('T')[0];
    let dailyRecord = metrics.dailyUsage.find(d => d.date === today);
    
    if (!dailyRecord) {
      dailyRecord = { date: today, requests: 0, tokens: 0, cost: 0 };
      metrics.dailyUsage.push(dailyRecord);
      
      // Keep only last 90 days
      if (metrics.dailyUsage.length > 90) {
        metrics.dailyUsage = metrics.dailyUsage.slice(-90);
      }
    }
    
    dailyRecord.requests++;
    dailyRecord.tokens += tokens;
    dailyRecord.cost += cost;
  }

  private updateCommandUsage(command: string, tokens: number, cost: number): void {
    const baseCommand = command.split(' ')[0]; // First word only
    let usage = this.commandUsage.get(baseCommand);
    
    if (!usage) {
      usage = { count: 0, totalCost: 0 };
      this.commandUsage.set(baseCommand, usage);
    }
    
    usage.count++;
    usage.totalCost += cost;
  }

  private calculateCost(response: IAIResponse): number {
    // This would normally use provider-specific pricing
    // For now, use generic estimates
    const costPer1kTokens = this.getProviderCostRate(response.model);
    return (response.tokens / 1000) * costPer1kTokens;
  }

  private getProviderCostRate(modelId: string): number {
    // Approximate cost rates per 1k tokens (as of 2025)
    const rates: Record<string, number> = {
      'gpt-oss-20b': 0, // Local model
      'gpt-oss-120b': 0, // Local model
      'openai-gpt-4o': 0.005,
      'openai-gpt-4o-mini': 0.0015,
      'claude-sonnet': 0.003,
      'claude-haiku': 0.0015,
      'gemini-pro': 0.002,
      'gemini-flash': 0.001,
      'deepseek-coder': 0.001,
      'qwen-coder': 0.0008,
    };
    
    // Find matching rate or use default
    for (const [pattern, rate] of Object.entries(rates)) {
      if (modelId.includes(pattern)) {
        return rate;
      }
    }
    
    return 0.002; // Default rate
  }

  private async checkBudgetAlerts(providerId: string): Promise<void> {
    const budget = this.budgetLimits.get(providerId);
    if (!budget) return;

    const metrics = this.metrics.get(providerId);
    if (!metrics) return;

    const today = new Date().toISOString().split('T')[0];
    const thisWeek = this.getWeekStart(new Date());
    const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Check daily budget
    const todayUsage = metrics.dailyUsage.find(d => d.date === today);
    if (todayUsage && budget.daily && todayUsage.cost >= budget.daily * 0.8) {
      this.emit('budgetAlert', {
        type: 'daily',
        threshold: budget.daily,
        currentUsage: todayUsage.cost,
        percentageUsed: (todayUsage.cost / budget.daily) * 100,
        providerId,
      } as IBudgetAlert);
    }

    // Check weekly budget
    const weeklyUsage = this.calculatePeriodUsage(metrics, thisWeek, 'week');
    if (budget.weekly && weeklyUsage >= budget.weekly * 0.8) {
      this.emit('budgetAlert', {
        type: 'weekly',
        threshold: budget.weekly,
        currentUsage: weeklyUsage,
        percentageUsed: (weeklyUsage / budget.weekly) * 100,
        providerId,
      } as IBudgetAlert);
    }

    // Check monthly budget
    const monthlyUsage = this.calculatePeriodUsage(metrics, thisMonth, 'month');
    if (budget.monthly && monthlyUsage >= budget.monthly * 0.8) {
      this.emit('budgetAlert', {
        type: 'monthly',
        threshold: budget.monthly,
        currentUsage: monthlyUsage,
        percentageUsed: (monthlyUsage / budget.monthly) * 100,
        providerId,
      } as IBudgetAlert);
    }
  }

  private calculatePeriodUsage(metrics: IUsageMetrics, period: string, type: 'week' | 'month'): number {
    return metrics.dailyUsage
      .filter(d => {
        if (type === 'week') {
          return d.date >= period;
        } else {
          return d.date.startsWith(period);
        }
      })
      .reduce((sum, d) => sum + d.cost, 0);
  }

  private getWeekStart(date: Date): string {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay()); // Go to Sunday
    return start.toISOString().split('T')[0];
  }

  generateReport(period: 'today' | 'week' | 'month' | 'all' = 'week'): IUsageReport {
    const allMetrics = Array.from(this.metrics.values());
    const startDate = this.getStartDate(period);
    
    let totalRequests = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let totalResponseTime = 0;
    const providerBreakdown: any[] = [];
    const dailyTrend = new Map<string, { requests: number; tokens: number; cost: number }>();

    for (const metrics of allMetrics) {
      const periodUsage = this.calculatePeriodMetrics(metrics, startDate);
      
      totalRequests += periodUsage.requests;
      totalTokens += periodUsage.tokens;
      totalCost += periodUsage.cost;
      totalResponseTime += metrics.averageResponseTime * periodUsage.requests;

      if (periodUsage.requests > 0) {
        providerBreakdown.push({
          providerId: metrics.providerId,
          requests: periodUsage.requests,
          tokens: periodUsage.tokens,
          cost: periodUsage.cost,
          percentage: 0, // Will calculate after totals
        });
      }

      // Aggregate daily trend
      for (const daily of metrics.dailyUsage) {
        if (daily.date >= startDate) {
          const existing = dailyTrend.get(daily.date) || { requests: 0, tokens: 0, cost: 0 };
          existing.requests += daily.requests;
          existing.tokens += daily.tokens;
          existing.cost += daily.cost;
          dailyTrend.set(daily.date, existing);
        }
      }
    }

    // Calculate percentages
    for (const provider of providerBreakdown) {
      provider.percentage = totalRequests > 0 ? (provider.requests / totalRequests) * 100 : 0;
    }

    // Generate top commands report
    const topCommands = Array.from(this.commandUsage.entries())
      .map(([command, usage]) => ({
        command,
        count: usage.count,
        avgCost: usage.totalCost / usage.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      period,
      totalRequests,
      totalTokens,
      totalCost,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      providerBreakdown: providerBreakdown.sort((a, b) => b.requests - a.requests),
      dailyTrend: Array.from(dailyTrend.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topCommands,
    };
  }

  private getStartDate(period: 'today' | 'week' | 'month' | 'all'): string {
    const now = new Date();
    
    switch (period) {
      case 'today':
        return now.toISOString().split('T')[0];
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return weekAgo.toISOString().split('T')[0];
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return monthAgo.toISOString().split('T')[0];
      case 'all':
      default:
        return '2020-01-01'; // Far in the past
    }
  }

  private calculatePeriodMetrics(metrics: IUsageMetrics, startDate: string) {
    const periodDaily = metrics.dailyUsage.filter(d => d.date >= startDate);
    
    return {
      requests: periodDaily.reduce((sum, d) => sum + d.requests, 0),
      tokens: periodDaily.reduce((sum, d) => sum + d.tokens, 0),
      cost: periodDaily.reduce((sum, d) => sum + d.cost, 0),
    };
  }

  setBudget(providerId: string, limits: { daily?: number; weekly?: number; monthly?: number }): void {
    const existing = this.budgetLimits.get(providerId) || { daily: 0, weekly: 0, monthly: 0 };
    this.budgetLimits.set(providerId, { ...existing, ...limits });
    
    this.emit('budgetUpdated', { providerId, limits });
  }

  getBudgetStatus(providerId: string): {
    daily: { used: number; limit: number; percentage: number };
    weekly: { used: number; limit: number; percentage: number };
    monthly: { used: number; limit: number; percentage: number };
  } | null {
    const budget = this.budgetLimits.get(providerId);
    const metrics = this.metrics.get(providerId);
    
    if (!budget || !metrics) return null;

    const today = new Date().toISOString().split('T')[0];
    const thisWeek = this.getWeekStart(new Date());
    const thisMonth = new Date().toISOString().slice(0, 7);

    const dailyUsed = metrics.dailyUsage.find(d => d.date === today)?.cost || 0;
    const weeklyUsed = this.calculatePeriodMetrics(metrics, thisWeek).cost;
    const monthlyUsed = this.calculatePeriodMetrics(metrics, thisMonth + '-01').cost;

    return {
      daily: {
        used: dailyUsed,
        limit: budget.daily,
        percentage: budget.daily > 0 ? (dailyUsed / budget.daily) * 100 : 0,
      },
      weekly: {
        used: weeklyUsed,
        limit: budget.weekly,
        percentage: budget.weekly > 0 ? (weeklyUsed / budget.weekly) * 100 : 0,
      },
      monthly: {
        used: monthlyUsed,
        limit: budget.monthly,
        percentage: budget.monthly > 0 ? (monthlyUsed / budget.monthly) * 100 : 0,
      },
    };
  }

  private getWeekStart(date: Date): string {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    return start.toISOString().split('T')[0];
  }

  async exportData(): Promise<{
    metrics: IUsageMetrics[];
    commandUsage: Array<{ command: string; count: number; totalCost: number }>;
    budgets: Array<{ providerId: string; limits: any }>;
    exportDate: string;
  }> {
    return {
      metrics: Array.from(this.metrics.values()),
      commandUsage: Array.from(this.commandUsage.entries()).map(([command, usage]) => ({
        command,
        ...usage,
      })),
      budgets: Array.from(this.budgetLimits.entries()).map(([providerId, limits]) => ({
        providerId,
        limits,
      })),
      exportDate: new Date().toISOString(),
    };
  }

  async importData(data: any): Promise<void> {
    if (data.metrics) {
      for (const metric of data.metrics) {
        this.metrics.set(metric.providerId, metric);
      }
    }
    
    if (data.commandUsage) {
      for (const cmd of data.commandUsage) {
        this.commandUsage.set(cmd.command, { count: cmd.count, totalCost: cmd.totalCost });
      }
    }
    
    if (data.budgets) {
      for (const budget of data.budgets) {
        this.budgetLimits.set(budget.providerId, budget.limits);
      }
    }

    await this.persistData();
    this.emit('dataImported');
  }

  private async loadPersistedData(): Promise<void> {
    try {
      const data = await fs.readFile(this.persistencePath, 'utf8');
      await this.importData(JSON.parse(data));
    } catch (error) {
      // File doesn't exist or is invalid - start fresh
      console.log('Starting with fresh usage data');
    }
  }

  private async persistData(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.persistencePath), { recursive: true });
      const data = await this.exportData();
      await fs.writeFile(this.persistencePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('Failed to persist usage data:', error);
    }
  }

  resetMetrics(providerId?: string): void {
    if (providerId) {
      this.metrics.delete(providerId);
    } else {
      this.metrics.clear();
      this.commandUsage.clear();
    }
    
    this.persistData();
    this.emit('metricsReset', { providerId });
  }

  getMetrics(providerId?: string): IUsageMetrics[] {
    if (providerId) {
      const metrics = this.metrics.get(providerId);
      return metrics ? [metrics] : [];
    }
    
    return Array.from(this.metrics.values());
  }

  getCostSummary(): {
    today: number;
    week: number;
    month: number;
    total: number;
    topProvider: string;
    savings: number; // How much saved by using local models
  } {
    const report = this.generateReport('all');
    const todayReport = this.generateReport('today');
    const weekReport = this.generateReport('week');
    const monthReport = this.generateReport('month');

    // Calculate savings from local models
    const localTokens = report.providerBreakdown
      .filter(p => p.providerId.includes('oss'))
      .reduce((sum, p) => sum + p.tokens, 0);
    
    const estimatedSavings = (localTokens / 1000) * 0.003; // Estimate $0.003 per 1k tokens saved

    return {
      today: todayReport.totalCost,
      week: weekReport.totalCost,
      month: monthReport.totalCost,
      total: report.totalCost,
      topProvider: report.providerBreakdown[0]?.providerId || 'none',
      savings: estimatedSavings,
    };
  }
}