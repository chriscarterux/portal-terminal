export interface IElectronAPI {
  terminal: {
    create: (options?: ITerminalCreateOptions) => Promise<string>;
    createIntegrated: (options?: IIntegratedTerminalOptions) => Promise<string>;
    write: (terminalId: string, data: string) => Promise<void>;
    resize: (terminalId: string, cols: number, rows: number) => Promise<void>;
    kill: (terminalId: string) => Promise<void>;
    executeCommand: (terminalId: string, command: string) => Promise<any>;
    executeEnhanced: (terminalId: string, command: string, options?: any) => Promise<any>;
    getSystemStatus: (terminalId: string) => Promise<any>;
    getContext: (terminalId: string) => Promise<any>;
    getPerformanceMetrics: (terminalId: string) => Promise<any>;
    healthCheck: (terminalId: string) => Promise<any>;
    onData: (callback: (terminalId: string, data: string) => void) => void;
    onExit: (callback: (terminalId: string, exitCode: number) => void) => void;
    onCommandComplete: (callback: (terminalId: string, block: any) => void) => void;
  };
  ai: {
    getSuggestions: (terminalId: string, command: string) => Promise<any>;
    getContextualHelp: (terminalId: string, query: string) => Promise<string>;
    onSuggestion: (callback: (terminalId: string, suggestion: string) => void) => void;
  };
  mcp: {
    getContext: (terminalId: string) => Promise<any>;
    searchContext: (terminalId: string, query: string) => Promise<any[]>;
    getHealthReport: (terminalId: string) => Promise<any>;
    callTool: (terminalId: string, toolCall: any) => Promise<any>;
    readResource: (terminalId: string, request: any) => Promise<any>;
    onContextUpdate: (callback: (terminalId: string, context: any) => void) => void;
  };
  window: {
    close: () => Promise<void>;
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
}

export interface ITerminalCreateOptions {
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface IIntegratedTerminalOptions extends ITerminalCreateOptions {
  aiEnabled?: boolean;
  mcpEnabled?: boolean;
  autoSuggestions?: boolean;
  errorAnalysis?: boolean;
  performanceMonitoring?: boolean;
}

export interface ITerminalData {
  id: string;
  data: string;
  timestamp: number;
}

export interface ITerminalExit {
  id: string;
  exitCode: number;
  timestamp: number;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}