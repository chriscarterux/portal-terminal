import { spawn, ChildProcess } from 'child_process';
import { ShellDetector, IShellInfo } from './shell-detector';
import { CommandBlock } from './command-block';

export interface ICommandExecutorOptions {
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class CommandExecutor {
  private currentProcess: ChildProcess | null = null;
  private shellInfo: IShellInfo;
  private maxRetries: number;
  private retryDelay: number;

  constructor(private options: ICommandExecutorOptions = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 100;
    
    this.shellInfo = options.shell 
      ? { name: options.shell, path: options.shell, args: [], env: {} }
      : ShellDetector.detectDefaultShell();
  }

  async executeCommand(command: string): Promise<CommandBlock> {
    const block = new CommandBlock(command);
    block.setRunning();

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.runCommand(command, block);
        block.setCompleted(result.exitCode);
        return block;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.maxRetries) {
          // Exponential backoff: delay = baseDelay * (2 ^ attempt)
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Clear previous error output for retry
          if (block.output) {
            block.output = '';
          }
        }
      }
    }

    // All retries failed
    block.addOutput(`Error: ${lastError?.message || 'Unknown error'}\n`);
    block.setCompleted(1);
    return block;
  }

  private runCommand(command: string, block: CommandBlock): Promise<{ exitCode: number }> {
    return new Promise((resolve, reject) => {
      const cwd = this.options.cwd || process.cwd();
      const env = {
        ...process.env,
        ...this.shellInfo.env,
        ...this.options.env,
      };

      // Parse command for basic shell execution
      const args = this.parseCommand(command);
      
      this.currentProcess = spawn(args[0], args.slice(1), {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.currentProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        block.addOutput(output);
      });

      this.currentProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        block.addOutput(output);
      });

      this.currentProcess.on('close', (code) => {
        resolve({ exitCode: code || 0 });
      });

      this.currentProcess.on('error', (error) => {
        reject(error);
      });

      // Set timeout if specified
      if (this.options.timeout) {
        setTimeout(() => {
          if (this.currentProcess && !this.currentProcess.killed) {
            this.currentProcess.kill();
            block.addOutput(`Command timed out after ${this.options.timeout}ms\n`);
            reject(new Error(`Command timed out after ${this.options.timeout}ms`));
          }
        }, this.options.timeout);
      }
    });
  }

  private parseCommand(command: string): string[] {
    // Basic command parsing - will be enhanced later
    const trimmed = command.trim();
    
    // Handle shell built-ins and common patterns
    if (process.platform === 'win32') {
      return ['cmd', '/c', trimmed];
    } else {
      return [this.shellInfo.path, '-c', trimmed];
    }
  }

  kill(): void {
    if (this.currentProcess && !this.currentProcess.killed) {
      this.currentProcess.kill();
    }
  }

  isRunning(): boolean {
    return this.currentProcess !== null && !this.currentProcess.killed;
  }
}