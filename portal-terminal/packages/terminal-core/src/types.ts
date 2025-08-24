export interface CommandBlock {
  id: string;
  command: string;
  output: string;
  timestamp: Date;
  status: 'pending' | 'running' | 'completed' | 'error';
  exitCode?: number;
}

export interface TerminalSession {
  id: string;
  name: string;
  blocks: CommandBlock[];
  workingDirectory: string;
  environment: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TerminalOptions {
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  maxConcurrentCommands?: number;
  memoryThreshold?: number;
}