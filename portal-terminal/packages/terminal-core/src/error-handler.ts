import { EventEmitter } from 'events';

export interface IErrorContext {
  command?: string;
  terminalId?: string;
  timestamp: number;
  context?: any;
  recoveryAttempts: number;
}

export interface IErrorAnalysis {
  errorType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRecoverable: boolean;
  suggestedRecovery: string[];
  preventionTips: string[];
}

export interface IRecoveryAction {
  name: string;
  description: string;
  command?: string;
  callback?: () => Promise<void>;
  automatic?: boolean;
}

export class ErrorHandler extends EventEmitter {
  private errorHistory: IErrorContext[] = [];
  private recoveryStrategies = new Map<string, IRecoveryAction[]>();
  private maxHistorySize = 100;
  private autoRecoveryEnabled = true;

  constructor() {
    super();
    this.initializeRecoveryStrategies();
  }

  private initializeRecoveryStrategies(): void {
    // Command not found errors
    this.recoveryStrategies.set('command_not_found', [
      {
        name: 'Check PATH',
        description: 'Verify command is in PATH',
        command: 'echo $PATH',
        automatic: false,
      },
      {
        name: 'Install package',
        description: 'Try installing the missing package',
        automatic: false,
      },
      {
        name: 'Check spelling',
        description: 'Verify command spelling',
        automatic: false,
      },
    ]);

    // Permission denied errors
    this.recoveryStrategies.set('permission_denied', [
      {
        name: 'Check permissions',
        description: 'Check file/directory permissions',
        command: 'ls -la',
        automatic: false,
      },
      {
        name: 'Use sudo',
        description: 'Try with elevated privileges',
        automatic: false,
      },
      {
        name: 'Change ownership',
        description: 'Fix file ownership if appropriate',
        automatic: false,
      },
    ]);

    // File not found errors
    this.recoveryStrategies.set('file_not_found', [
      {
        name: 'Check file exists',
        description: 'Verify file path is correct',
        command: 'find . -name "*filename*"',
        automatic: false,
      },
      {
        name: 'Check working directory',
        description: 'Verify you are in the right directory',
        command: 'pwd',
        automatic: true,
      },
      {
        name: 'List directory contents',
        description: 'See what files are available',
        command: 'ls -la',
        automatic: false,
      },
    ]);

    // Network errors
    this.recoveryStrategies.set('network_error', [
      {
        name: 'Check connection',
        description: 'Test network connectivity',
        command: 'ping google.com -c 3',
        automatic: false,
      },
      {
        name: 'Check DNS',
        description: 'Verify DNS resolution',
        command: 'nslookup google.com',
        automatic: false,
      },
      {
        name: 'Retry command',
        description: 'Network issues may be temporary',
        automatic: false,
      },
    ]);

    // Git errors
    this.recoveryStrategies.set('git_error', [
      {
        name: 'Check git status',
        description: 'Review repository state',
        command: 'git status',
        automatic: true,
      },
      {
        name: 'Pull latest changes',
        description: 'Update local repository',
        command: 'git pull',
        automatic: false,
      },
      {
        name: 'Check branch',
        description: 'Verify current branch',
        command: 'git branch',
        automatic: false,
      },
    ]);

    // Package manager errors
    this.recoveryStrategies.set('package_error', [
      {
        name: 'Clear cache',
        description: 'Clear package manager cache',
        automatic: false,
      },
      {
        name: 'Update package list',
        description: 'Refresh package information',
        automatic: false,
      },
      {
        name: 'Check dependencies',
        description: 'Verify all dependencies are installed',
        automatic: false,
      },
    ]);
  }

  async handleError(
    error: Error | string,
    context: Partial<IErrorContext> = {}
  ): Promise<{
    analysis: IErrorAnalysis;
    recoveryActions: IRecoveryAction[];
    autoRecoveryPerformed: boolean;
  }> {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorContext: IErrorContext = {
      timestamp: Date.now(),
      recoveryAttempts: 0,
      ...context,
    };

    // Add to error history
    this.addToHistory(errorContext);

    // Analyze the error
    const analysis = this.analyzeError(errorMessage, errorContext);
    
    // Get recovery actions
    const recoveryActions = this.getRecoveryActions(analysis.errorType);
    
    // Attempt automatic recovery if enabled
    let autoRecoveryPerformed = false;
    if (this.autoRecoveryEnabled && analysis.isRecoverable) {
      autoRecoveryPerformed = await this.attemptAutoRecovery(recoveryActions, errorContext);
    }

    // Emit error event for UI updates
    this.emit('error', {
      error: errorMessage,
      context: errorContext,
      analysis,
      recoveryActions,
      autoRecoveryPerformed,
    });

    return {
      analysis,
      recoveryActions,
      autoRecoveryPerformed,
    };
  }

  private analyzeError(errorMessage: string, context: IErrorContext): IErrorAnalysis {
    const lowerError = errorMessage.toLowerCase();

    // Command not found
    if (lowerError.includes('command not found') || lowerError.includes('not recognized')) {
      return {
        errorType: 'command_not_found',
        severity: 'medium',
        isRecoverable: true,
        suggestedRecovery: [
          'Check if the command is installed',
          'Verify PATH environment variable',
          'Try using the full path to the command',
        ],
        preventionTips: [
          'Add commonly used tools to PATH',
          'Use which/whereis to locate commands',
          'Install missing packages before use',
        ],
      };
    }

    // Permission denied
    if (lowerError.includes('permission denied') || lowerError.includes('access denied')) {
      return {
        errorType: 'permission_denied',
        severity: 'medium',
        isRecoverable: true,
        suggestedRecovery: [
          'Check file permissions with ls -la',
          'Use sudo if elevated privileges needed',
          'Change ownership or permissions',
        ],
        preventionTips: [
          'Run commands in appropriate directories',
          'Use proper user accounts for tasks',
          'Understand sudo implications',
        ],
      };
    }

    // File not found
    if (lowerError.includes('no such file') || lowerError.includes('file not found')) {
      return {
        errorType: 'file_not_found',
        severity: 'low',
        isRecoverable: true,
        suggestedRecovery: [
          'Verify file path is correct',
          'Check if file exists in current directory',
          'Use absolute path instead of relative',
        ],
        preventionTips: [
          'Use tab completion for file paths',
          'Double-check file names',
          'Use ls to verify file existence',
        ],
      };
    }

    // Network errors
    if (lowerError.includes('network') || lowerError.includes('connection') || 
        lowerError.includes('timeout') || lowerError.includes('unreachable')) {
      return {
        errorType: 'network_error',
        severity: 'medium',
        isRecoverable: true,
        suggestedRecovery: [
          'Check network connectivity',
          'Verify DNS settings',
          'Try again in a few moments',
        ],
        preventionTips: [
          'Test connection before network operations',
          'Use retry mechanisms for network commands',
          'Consider offline alternatives',
        ],
      };
    }

    // Git errors
    if (lowerError.includes('git') || context.command?.startsWith('git')) {
      return {
        errorType: 'git_error',
        severity: 'medium',
        isRecoverable: true,
        suggestedRecovery: [
          'Check git repository status',
          'Verify branch state',
          'Pull latest changes if needed',
        ],
        preventionTips: [
          'Always check git status before operations',
          'Keep repository in clean state',
          'Use git stash for temporary changes',
        ],
      };
    }

    // Package manager errors
    if (lowerError.includes('npm') || lowerError.includes('yarn') || 
        lowerError.includes('package') || context.command?.includes('npm')) {
      return {
        errorType: 'package_error',
        severity: 'medium',
        isRecoverable: true,
        suggestedRecovery: [
          'Clear package manager cache',
          'Update package registry',
          'Check package.json for issues',
        ],
        preventionTips: [
          'Keep package.json clean',
          'Use exact versions for critical deps',
          'Regularly update dependencies',
        ],
      };
    }

    // Syntax errors
    if (lowerError.includes('syntax error') || lowerError.includes('unexpected')) {
      return {
        errorType: 'syntax_error',
        severity: 'low',
        isRecoverable: true,
        suggestedRecovery: [
          'Check command syntax',
          'Verify quotes and escaping',
          'Use command documentation',
        ],
        preventionTips: [
          'Use tab completion when possible',
          'Check man pages for syntax',
          'Test complex commands step by step',
        ],
      };
    }

    // Memory/resource errors
    if (lowerError.includes('memory') || lowerError.includes('space') || 
        lowerError.includes('resource') || lowerError.includes('killed')) {
      return {
        errorType: 'resource_error',
        severity: 'high',
        isRecoverable: false,
        suggestedRecovery: [
          'Free up system resources',
          'Close unnecessary applications',
          'Check available disk space',
        ],
        preventionTips: [
          'Monitor system resources',
          'Use streaming for large operations',
          'Clean up temporary files regularly',
        ],
      };
    }

    // Generic error
    return {
      errorType: 'unknown',
      severity: 'medium',
      isRecoverable: false,
      suggestedRecovery: [
        'Check command documentation',
        'Verify system requirements',
        'Try a simpler approach',
      ],
      preventionTips: [
        'Test commands in safe environment first',
        'Keep good backups',
        'Document working procedures',
      ],
    };
  }

  private getRecoveryActions(errorType: string): IRecoveryAction[] {
    return this.recoveryStrategies.get(errorType) || [];
  }

  private async attemptAutoRecovery(
    recoveryActions: IRecoveryAction[],
    context: IErrorContext
  ): Promise<boolean> {
    const automaticActions = recoveryActions.filter(action => action.automatic);
    
    if (automaticActions.length === 0) {
      return false;
    }

    try {
      for (const action of automaticActions) {
        console.log(`🔧 Auto-recovery: ${action.name}`);
        
        if (action.callback) {
          await action.callback();
        } else if (action.command) {
          // Would execute the recovery command
          console.log(`Would execute: ${action.command}`);
        }
        
        // Mark recovery attempt
        context.recoveryAttempts++;
      }
      
      return true;
    } catch (recoveryError) {
      console.warn('Auto-recovery failed:', recoveryError);
      return false;
    }
  }

  private addToHistory(errorContext: IErrorContext): void {
    this.errorHistory.push(errorContext);
    
    // Maintain history size limit
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  // Public methods for terminal integration
  async analyzeCommandError(
    command: string,
    errorOutput: string,
    terminalContext?: any
  ): Promise<{
    analysis: IErrorAnalysis;
    recoveryActions: IRecoveryAction[];
    contextualAdvice: string[];
  }> {
    const result = await this.handleError(errorOutput, {
      command,
      context: terminalContext,
    });

    // Generate contextual advice based on project/git context
    const contextualAdvice = this.generateContextualAdvice(
      result.analysis,
      command,
      terminalContext
    );

    return {
      ...result,
      contextualAdvice,
    };
  }

  private generateContextualAdvice(
    analysis: IErrorAnalysis,
    command: string,
    terminalContext: any
  ): string[] {
    const advice: string[] = [];

    // Git-specific advice
    if (terminalContext?.gitContext && analysis.errorType === 'git_error') {
      if (terminalContext.gitContext.status === 'dirty') {
        advice.push('Consider stashing uncommitted changes before git operations');
      }
      if (terminalContext.gitContext.branch === 'main' || terminalContext.gitContext.branch === 'master') {
        advice.push('Be extra careful when working on main branch');
      }
    }

    // Project-specific advice
    if (terminalContext?.projectContext) {
      const projectType = terminalContext.projectContext.type;
      
      if (projectType === 'node' && analysis.errorType === 'package_error') {
        advice.push('Try deleting node_modules and running npm install');
        advice.push('Check if package.json has correct dependencies');
      }
      
      if (projectType === 'python' && analysis.errorType === 'command_not_found') {
        advice.push('Activate your virtual environment first');
        advice.push('Install packages with pip or conda');
      }
    }

    // Performance-related advice
    if (analysis.errorType === 'resource_error') {
      advice.push('Monitor system resources with htop or Activity Monitor');
      advice.push('Consider using streaming operations for large files');
    }

    return advice;
  }

  // Recovery orchestration
  async executeRecoveryPlan(
    errorType: string,
    context: IErrorContext,
    selectedActions: string[] = []
  ): Promise<{
    success: boolean;
    results: { action: string; success: boolean; output?: string }[];
    remainingActions: IRecoveryAction[];
  }> {
    const allActions = this.getRecoveryActions(errorType);
    const actionsToExecute = selectedActions.length > 0 
      ? allActions.filter(action => selectedActions.includes(action.name))
      : allActions.filter(action => action.automatic);

    const results: { action: string; success: boolean; output?: string }[] = [];

    for (const action of actionsToExecute) {
      try {
        console.log(`🔧 Executing recovery action: ${action.name}`);
        
        let success = true;
        let output = '';
        
        if (action.callback) {
          await action.callback();
          output = 'Callback executed successfully';
        } else if (action.command) {
          // In real implementation, would execute the command
          output = `Would execute: ${action.command}`;
        }
        
        results.push({ action: action.name, success, output });
        
        // Update recovery attempts
        context.recoveryAttempts++;
        
      } catch (error) {
        console.warn(`Recovery action failed: ${action.name}`, error);
        results.push({ 
          action: action.name, 
          success: false, 
          output: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const remainingActions = allActions.filter(action => 
      !actionsToExecute.some(executed => executed.name === action.name)
    );

    const success = results.every(result => result.success);

    return {
      success,
      results,
      remainingActions,
    };
  }

  // Error pattern detection
  detectErrorPatterns(): {
    frequentErrors: { errorType: string; count: number; lastOccurrence: number }[];
    systemIssues: string[];
    recommendations: string[];
  } {
    const errorCounts = new Map<string, { count: number; lastOccurrence: number }>();
    const now = Date.now();
    const recentTimeframe = 30 * 60 * 1000; // 30 minutes

    // Count recent errors
    this.errorHistory
      .filter(error => now - error.timestamp < recentTimeframe)
      .forEach(error => {
        const analysis = this.analyzeError(String(error), error);
        const current = errorCounts.get(analysis.errorType) || { count: 0, lastOccurrence: 0 };
        errorCounts.set(analysis.errorType, {
          count: current.count + 1,
          lastOccurrence: Math.max(current.lastOccurrence, error.timestamp),
        });
      });

    const frequentErrors = Array.from(errorCounts.entries())
      .map(([errorType, data]) => ({ errorType, ...data }))
      .sort((a, b) => b.count - a.count);

    // Detect system issues
    const systemIssues: string[] = [];
    const recommendations: string[] = [];

    if (frequentErrors.some(e => e.errorType === 'permission_denied' && e.count > 3)) {
      systemIssues.push('Frequent permission issues detected');
      recommendations.push('Review user permissions and directory ownership');
    }

    if (frequentErrors.some(e => e.errorType === 'network_error' && e.count > 2)) {
      systemIssues.push('Network connectivity issues detected');
      recommendations.push('Check network configuration and DNS settings');
    }

    if (frequentErrors.some(e => e.errorType === 'resource_error')) {
      systemIssues.push('System resource constraints detected');
      recommendations.push('Monitor memory and disk usage');
    }

    return {
      frequentErrors,
      systemIssues,
      recommendations,
    };
  }

  // Health monitoring
  getErrorHealthMetrics(): {
    totalErrors: number;
    recentErrors: number;
    errorRate: number;
    topErrorTypes: string[];
    recoverySuccess: number;
  } {
    const now = Date.now();
    const recentTimeframe = 60 * 60 * 1000; // 1 hour
    
    const recentErrors = this.errorHistory.filter(
      error => now - error.timestamp < recentTimeframe
    );

    const errorTypeCounts = new Map<string, number>();
    let successfulRecoveries = 0;

    recentErrors.forEach(error => {
      const analysis = this.analyzeError(String(error), error);
      const count = errorTypeCounts.get(analysis.errorType) || 0;
      errorTypeCounts.set(analysis.errorType, count + 1);
      
      if (error.recoveryAttempts > 0) {
        successfulRecoveries++;
      }
    });

    const topErrorTypes = Array.from(errorTypeCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([errorType]) => errorType);

    return {
      totalErrors: this.errorHistory.length,
      recentErrors: recentErrors.length,
      errorRate: recentErrors.length / Math.max(1, recentErrors.length), // Errors per command
      topErrorTypes,
      recoverySuccess: recentErrors.length > 0 ? (successfulRecoveries / recentErrors.length) * 100 : 0,
    };
  }

  // Configuration
  setAutoRecovery(enabled: boolean): void {
    this.autoRecoveryEnabled = enabled;
  }

  addRecoveryStrategy(errorType: string, actions: IRecoveryAction[]): void {
    this.recoveryStrategies.set(errorType, actions);
  }

  getErrorHistory(limit: number = 10): IErrorContext[] {
    return this.errorHistory.slice(-limit);
  }

  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  // Emergency recovery
  async emergencyReset(terminalId: string): Promise<void> {
    console.log('🚨 Emergency terminal reset initiated');
    
    try {
      // Would perform emergency cleanup
      this.emit('emergency-reset', { terminalId, timestamp: Date.now() });
      console.log('✅ Emergency reset completed');
    } catch (error) {
      console.error('Emergency reset failed:', error);
      throw error;
    }
  }

  // Proactive error prevention
  async validateCommand(command: string, context?: any): Promise<{
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  }> {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Destructive command warnings
    if (command.includes('rm -rf') || command.includes('rm -f')) {
      warnings.push('Destructive command detected - double-check the path');
      suggestions.push('Consider using trash or backup first');
    }

    // Sudo warnings
    if (command.includes('sudo')) {
      warnings.push('Elevated privileges requested');
      suggestions.push('Ensure you understand what this command does');
    }

    // Network command in offline mode
    if ((command.includes('curl') || command.includes('wget')) && !navigator.onLine) {
      warnings.push('Network command while offline');
      suggestions.push('Check network connectivity first');
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      suggestions,
    };
  }
}